use git2::{Delta, DiffFindOptions, DiffFormat, DiffOptions, Repository};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::path::Path;

use crate::error::TasukiError;
use super::repo::{open_repo, read_working_file};

/// A single changed file in a diff
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffFile {
    pub path: String,
    pub old_path: Option<String>,
    pub status: String,
    pub additions: usize,
    pub deletions: usize,
    pub is_binary: bool,
    pub is_generated: bool,
}

/// A diff hunk (section of changes)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffHunk {
    pub header: String,
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub lines: Vec<DiffLine>,
}

/// A single line in a diff
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffLine {
    pub origin: char,
    pub old_lineno: Option<u32>,
    pub new_lineno: Option<u32>,
    pub content: String,
}

/// Complete diff result for a single file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileDiff {
    pub file: DiffFile,
    pub hunks: Vec<DiffHunk>,
    pub old_content: Option<String>,
    pub new_content: Option<String>,
}

/// Complete diff result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffResult {
    pub files: Vec<FileDiff>,
    pub stats: DiffStats,
}

/// Diff statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffStats {
    pub files_changed: usize,
    pub additions: usize,
    pub deletions: usize,
}

/// Known generated file patterns
const GENERATED_PATTERNS: &[&str] = &[
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "Cargo.lock",
    "Gemfile.lock",
    "poetry.lock",
    "composer.lock",
    ".min.js",
    ".min.css",
    ".map",
    ".generated.",
    "__generated__",
];
const MAX_INLINE_FILE_BYTES: u64 = 1_000_000;

fn is_generated_file(path: &str) -> bool {
    GENERATED_PATTERNS
        .iter()
        .any(|pattern| path.contains(pattern))
}

fn delta_to_status(delta: Delta) -> &'static str {
    match delta {
        Delta::Added | Delta::Untracked => "added",
        Delta::Deleted => "deleted",
        Delta::Modified => "modified",
        Delta::Renamed => "renamed",
        Delta::Copied => "copied",
        Delta::Typechange => "typechange",
        _ => "unknown",
    }
}

/// Get the diff between working tree and index (unstaged changes)
pub fn get_working_diff(repo_path: &str) -> Result<DiffResult, TasukiError> {
    let repo = open_repo(repo_path)?;
    let mut opts = DiffOptions::new();
    opts.include_untracked(true);
    opts.recurse_untracked_dirs(true);
    opts.show_untracked_content(true);

    let mut diff = repo.diff_index_to_workdir(None, Some(&mut opts))?;
    parse_diff(&repo, &mut diff)
}

/// Get the diff of staged changes (index vs HEAD)
pub fn get_staged_diff(repo_path: &str) -> Result<DiffResult, TasukiError> {
    let repo = open_repo(repo_path)?;
    let head = repo.head().and_then(|h| h.peel_to_tree())?;
    let mut diff = repo.diff_tree_to_index(Some(&head), None, None)?;
    parse_diff(&repo, &mut diff)
}

/// Get all uncommitted changes (staged + unstaged + untracked)
pub fn get_uncommitted_diff(repo_path: &str) -> Result<DiffResult, TasukiError> {
    let repo = open_repo(repo_path)?;
    let head_tree = repo.head().and_then(|h| h.peel_to_tree()).ok();

    let mut opts = DiffOptions::new();
    opts.include_untracked(true);
    opts.recurse_untracked_dirs(true);
    opts.show_untracked_content(true);

    // Use diff_tree_to_workdir_with_index to get HEAD vs workdir in one pass.
    // Unlike merge(staged, working), this preserves untracked entries.
    let mut diff = repo.diff_tree_to_workdir_with_index(head_tree.as_ref(), Some(&mut opts))?;

    parse_diff(&repo, &mut diff)
}

/// Get diff between two refs (commits, branches, tags)
pub fn get_ref_diff(
    repo_path: &str,
    from_ref: &str,
    to_ref: &str,
) -> Result<DiffResult, TasukiError> {
    let repo = open_repo(repo_path)?;

    let from_obj = repo
        .revparse_single(from_ref)
        .map_err(|e| TasukiError::Git(format!("Cannot resolve '{}': {}", from_ref, e.message())))?;
    let to_obj = repo
        .revparse_single(to_ref)
        .map_err(|e| TasukiError::Git(format!("Cannot resolve '{}': {}", to_ref, e.message())))?;

    let from_tree = from_obj.peel_to_tree()?;
    let to_tree = to_obj.peel_to_tree()?;
    let mut diff = repo.diff_tree_to_tree(Some(&from_tree), Some(&to_tree), None)?;
    parse_diff(&repo, &mut diff)
}

/// Get diff for a specific commit (commit vs its parent)
pub fn get_commit_diff(repo_path: &str, commit_ref: &str) -> Result<DiffResult, TasukiError> {
    let repo = open_repo(repo_path)?;

    let obj = repo.revparse_single(commit_ref).map_err(|e| {
        TasukiError::Git(format!("Cannot resolve '{}': {}", commit_ref, e.message()))
    })?;

    let commit = obj.peel_to_commit()?;
    let commit_tree = commit.tree()?;
    let parent_tree = if commit.parent_count() > 0 {
        Some(commit.parent(0).and_then(|p| p.tree())?)
    } else {
        None
    };

    let mut diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&commit_tree), None)?;
    parse_diff(&repo, &mut diff)
}

/// Compute a SHA-256 hash of a DiffResult for change detection
pub fn compute_diff_hash(diff_result: &DiffResult) -> String {
    let json = serde_json::to_string(diff_result).unwrap_or_default();
    let hash = Sha256::digest(json.as_bytes());
    hash.iter().map(|b| format!("{:02x}", b)).collect()
}

// ---------------------------------------------------------------------------
// DiffParser: encapsulates mutable state for diff.print() callback
// ---------------------------------------------------------------------------

struct DiffParser {
    files: Vec<FileDiff>,
    path_to_idx: HashMap<String, usize>,
    current_file_idx: Option<usize>,
    current_hunk_header: String,
    current_hunk_old_start: u32,
    current_hunk_old_lines: u32,
    current_hunk_new_start: u32,
    current_hunk_new_lines: u32,
    current_lines: Vec<DiffLine>,
    additions_count: Vec<usize>,
    deletions_count: Vec<usize>,
}

impl DiffParser {
    fn new(files: Vec<FileDiff>) -> Self {
        let path_to_idx: HashMap<String, usize> = files
            .iter()
            .enumerate()
            .map(|(i, f)| (f.file.path.clone(), i))
            .collect();
        let len = files.len();
        Self {
            files,
            path_to_idx,
            current_file_idx: None,
            current_hunk_header: String::new(),
            current_hunk_old_start: 0,
            current_hunk_old_lines: 0,
            current_hunk_new_start: 0,
            current_hunk_new_lines: 0,
            current_lines: Vec::new(),
            additions_count: vec![0; len],
            deletions_count: vec![0; len],
        }
    }

    fn flush_hunk(&mut self) {
        if let Some(idx) = self.current_file_idx {
            if !self.current_lines.is_empty() {
                self.files[idx].hunks.push(DiffHunk {
                    header: self.current_hunk_header.clone(),
                    old_start: self.current_hunk_old_start,
                    old_lines: self.current_hunk_old_lines,
                    new_start: self.current_hunk_new_start,
                    new_lines: self.current_hunk_new_lines,
                    lines: std::mem::take(&mut self.current_lines),
                });
            }
        }
    }

    fn handle_line(
        &mut self,
        delta: git2::DiffDelta<'_>,
        hunk: Option<git2::DiffHunk<'_>>,
        line: git2::DiffLine<'_>,
    ) -> bool {
        let file_path = delta
            .new_file()
            .path()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        let Some(&file_idx) = self.path_to_idx.get(&file_path) else {
            eprintln!("Skipping diff line for unmatched path: {}", file_path);
            return true;
        };

        if self.current_file_idx != Some(file_idx) {
            self.flush_hunk();
            self.current_file_idx = Some(file_idx);
            self.current_hunk_header.clear();
        }

        if let Some(h) = hunk {
            self.flush_hunk();
            self.current_hunk_header = String::from_utf8_lossy(h.header()).trim().to_string();
            self.current_hunk_old_start = h.old_start();
            self.current_hunk_old_lines = h.old_lines();
            self.current_hunk_new_start = h.new_start();
            self.current_hunk_new_lines = h.new_lines();
        }

        let origin = line.origin();
        let content = String::from_utf8_lossy(line.content()).to_string();

        match origin {
            '+' | '>' => {
                self.additions_count[file_idx] += 1;
            }
            '-' | '<' => {
                self.deletions_count[file_idx] += 1;
            }
            _ => {}
        }

        if matches!(origin, '+' | '-' | ' ') {
            self.current_lines.push(DiffLine {
                origin,
                old_lineno: line.old_lineno(),
                new_lineno: line.new_lineno(),
                content,
            });
        }

        true
    }

    fn finish(mut self, stats: git2::DiffStats) -> DiffResult {
        self.flush_hunk();

        for (i, file) in self.files.iter_mut().enumerate() {
            file.file.additions = self.additions_count[i];
            file.file.deletions = self.deletions_count[i];
        }

        DiffResult {
            stats: DiffStats {
                files_changed: stats.files_changed(),
                additions: stats.insertions(),
                deletions: stats.deletions(),
            },
            files: self.files,
        }
    }
}

/// Parse a git2::Diff into our DiffResult structure
fn parse_diff(repo: &Repository, diff: &mut git2::Diff) -> Result<DiffResult, TasukiError> {
    // Enable rename/copy detection (including untracked files as rename targets)
    let mut find_opts = DiffFindOptions::new();
    find_opts.renames(true);
    find_opts.copies(true);
    find_opts.for_untracked(true);
    diff.find_similar(Some(&mut find_opts))?;

    let mut files: Vec<FileDiff> = Vec::new();
    let stats = diff.stats()?;

    let num_deltas = diff.deltas().len();
    for i in 0..num_deltas {
        let delta = diff.get_delta(i).unwrap();
        let new_file_path = delta
            .new_file()
            .path()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        // Skip files inside .worktrees/ directory (git worktree checkouts)
        if new_file_path.starts_with(".worktrees/") {
            continue;
        }

        let old_path = if delta.status() == Delta::Renamed {
            delta
                .old_file()
                .path()
                .map(|p| p.to_string_lossy().to_string())
        } else {
            None
        };

        let is_binary = delta.new_file().is_binary() || delta.old_file().is_binary();

        let diff_file = DiffFile {
            path: new_file_path.clone(),
            old_path,
            status: delta_to_status(delta.status()).to_string(),
            additions: 0,
            deletions: 0,
            is_binary,
            is_generated: is_generated_file(&new_file_path),
        };

        files.push(FileDiff {
            file: diff_file,
            hunks: Vec::new(),
            old_content: None,
            new_content: None,
        });
    }

    // Parse hunks and lines using DiffParser
    let mut parser = DiffParser::new(files);

    diff.print(DiffFormat::Patch, |delta, hunk, line| {
        parser.handle_line(delta, hunk, line)
    })?;

    let mut result = parser.finish(stats);

    // Get old/new content for render-friendly files only.
    // Large or generated files still render via patch hunks without inline fulltext.
    for file_diff in result.files.iter_mut() {
        if should_load_inline_contents(repo, &file_diff.file) {
            if file_diff.file.status != "added" {
                file_diff.old_content =
                    get_file_content_at_ref(repo, "HEAD", &file_diff.file.path).ok();
            }
            if file_diff.file.status != "deleted" {
                file_diff.new_content = read_working_file(repo, &file_diff.file.path).ok();
            }
        }
    }

    Ok(result)
}

fn should_load_inline_contents(repo: &Repository, file: &DiffFile) -> bool {
    if file.is_binary || file.is_generated {
        return false;
    }
    let Some(workdir) = repo.workdir() else {
        return false;
    };
    let full_path = workdir.join(&file.path);
    match std::fs::metadata(full_path) {
        Ok(meta) => meta.len() <= MAX_INLINE_FILE_BYTES,
        // Deleted files won't exist on disk; the caller guards old_content
        // loading via get_file_content_at_ref which has its own size check.
        Err(_) => true,
    }
}

/// Get file content at a specific git ref
fn get_file_content_at_ref(
    repo: &Repository,
    ref_name: &str,
    file_path: &str,
) -> Result<String, TasukiError> {
    let obj = repo.revparse_single(ref_name)?;
    let tree = obj.peel_to_tree()?;
    let entry = tree.get_path(Path::new(file_path))?;
    let blob = repo.find_blob(entry.id())?;

    if blob.is_binary() {
        return Err(TasukiError::Git("Binary file".to_string()));
    }
    if blob.size() as u64 > MAX_INLINE_FILE_BYTES {
        return Err(TasukiError::Git(format!(
            "File too large: {} bytes (limit: {} bytes)",
            blob.size(),
            MAX_INLINE_FILE_BYTES
        )));
    }

    Ok(String::from_utf8_lossy(blob.content()).to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use git2::Repository as Git2Repo;
    use std::fs;
    use tempfile::TempDir;

    fn setup_repo() -> (TempDir, String) {
        let dir = TempDir::new().unwrap();
        let repo = Git2Repo::init(dir.path()).unwrap();
        let file_path = dir.path().join("hello.txt");
        fs::write(&file_path, "hello world\n").unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(Path::new("hello.txt")).unwrap();
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let sig = git2::Signature::now("Test", "test@test.com").unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "initial", &tree, &[])
            .unwrap();
        let path = dir.path().to_string_lossy().to_string();
        (dir, path)
    }

    #[test]
    fn test_untracked_file_appears_in_diff() {
        let (dir, repo_path) = setup_repo();
        fs::write(dir.path().join("new_file.txt"), "new content\n").unwrap();

        let result = get_uncommitted_diff(&repo_path).unwrap();
        let new_file = result.files.iter().find(|f| f.file.path == "new_file.txt");
        assert!(new_file.is_some(), "Untracked file should appear in diff");
        assert_eq!(new_file.unwrap().file.status, "added");
    }

    #[test]
    fn test_rename_detected() {
        let (dir, repo_path) = setup_repo();
        fs::rename(
            dir.path().join("hello.txt"),
            dir.path().join("hello_renamed.txt"),
        )
        .unwrap();

        let result = get_uncommitted_diff(&repo_path).unwrap();
        let renamed = result.files.iter().find(|f| f.file.status == "renamed");
        assert!(
            renamed.is_some(),
            "Rename should be detected by find_similar"
        );
        assert_eq!(renamed.unwrap().file.path, "hello_renamed.txt");
        assert_eq!(renamed.unwrap().file.old_path.as_deref(), Some("hello.txt"));
    }

    #[test]
    fn test_is_generated_file() {
        assert!(is_generated_file("package-lock.json"));
        assert!(is_generated_file("node_modules/foo/package-lock.json"));
        assert!(is_generated_file("dist/app.min.js"));
        assert!(is_generated_file("styles.min.css"));
        assert!(is_generated_file("Cargo.lock"));
        assert!(!is_generated_file("src/main.rs"));
        assert!(!is_generated_file("README.md"));
        assert!(!is_generated_file("package.json"));
    }

    #[test]
    fn test_compute_diff_hash_deterministic() {
        let result = DiffResult {
            files: vec![],
            stats: DiffStats {
                files_changed: 0,
                additions: 0,
                deletions: 0,
            },
        };
        let hash1 = compute_diff_hash(&result);
        let hash2 = compute_diff_hash(&result);
        assert_eq!(hash1, hash2, "Same input should produce same hash");
        assert!(!hash1.is_empty());
    }
}
