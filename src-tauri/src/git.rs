use git2::{Delta, DiffFindOptions, DiffFormat, DiffOptions, Repository, Sort};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::Path;

use crate::error::TasukiError;

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

/// Commit info for log display
#[derive(Debug, Clone, Serialize)]
pub struct CommitInfo {
    pub id: String,
    pub short_id: String,
    pub message: String,
    pub author: String,
    pub time: i64,
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

fn is_generated_file(path: &str) -> bool {
    GENERATED_PATTERNS.iter().any(|pattern| path.contains(pattern))
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

/// Open a git repository at the given path
pub fn open_repo(repo_path: &str) -> Result<Repository, TasukiError> {
    Ok(Repository::discover(repo_path)?)
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

/// Get all uncommitted changes (staged + unstaged)
pub fn get_uncommitted_diff(repo_path: &str) -> Result<DiffResult, TasukiError> {
    let repo = open_repo(repo_path)?;
    let head_tree = repo.head().and_then(|h| h.peel_to_tree()).ok();

    let mut opts = DiffOptions::new();
    opts.include_untracked(true);
    opts.recurse_untracked_dirs(true);
    opts.show_untracked_content(true);

    let mut diff = if let Some(tree) = head_tree {
        let staged = repo.diff_tree_to_index(Some(&tree), None, None)?;
        let working = repo.diff_index_to_workdir(None, Some(&mut opts))?;

        let mut merged = staged;
        merged.merge(&working)?;
        merged
    } else {
        // No HEAD yet (initial commit scenario)
        repo.diff_index_to_workdir(None, Some(&mut opts))?
    };

    parse_diff(&repo, &mut diff)
}

/// Get diff between two refs (commits, branches, tags)
pub fn get_ref_diff(repo_path: &str, from_ref: &str, to_ref: &str) -> Result<DiffResult, TasukiError> {
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

    let obj = repo
        .revparse_single(commit_ref)
        .map_err(|e| TasukiError::Git(format!("Cannot resolve '{}': {}", commit_ref, e.message())))?;

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

/// Parse a git2::Diff into our DiffResult structure
fn parse_diff(repo: &Repository, diff: &mut git2::Diff) -> Result<DiffResult, TasukiError> {
    // Enable rename/copy detection
    let mut find_opts = DiffFindOptions::new();
    find_opts.renames(true);
    find_opts.copies(true);
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
        let old_path = if delta.status() == Delta::Renamed {
            delta.old_file().path().map(|p| p.to_string_lossy().to_string())
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

    // Parse hunks and lines using the print callback
    let mut current_file_idx: Option<usize> = None;
    let mut current_hunk_header = String::new();
    let mut current_hunk_old_start = 0u32;
    let mut current_hunk_old_lines = 0u32;
    let mut current_hunk_new_start = 0u32;
    let mut current_hunk_new_lines = 0u32;
    let mut current_lines: Vec<DiffLine> = Vec::new();
    let mut additions_count: Vec<usize> = vec![0; files.len()];
    let mut deletions_count: Vec<usize> = vec![0; files.len()];

    diff.print(DiffFormat::Patch, |delta, hunk, line| {
        let file_path = delta
            .new_file()
            .path()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        // Find the matching file index
        let file_idx = files
            .iter()
            .position(|f| f.file.path == file_path)
            .unwrap_or(0);

        if current_file_idx != Some(file_idx) {
            // Flush previous hunk if any
            if let Some(prev_idx) = current_file_idx {
                if !current_lines.is_empty() {
                    files[prev_idx].hunks.push(DiffHunk {
                        header: current_hunk_header.clone(),
                        old_start: current_hunk_old_start,
                        old_lines: current_hunk_old_lines,
                        new_start: current_hunk_new_start,
                        new_lines: current_hunk_new_lines,
                        lines: std::mem::take(&mut current_lines),
                    });
                }
            }
            current_file_idx = Some(file_idx);
            current_hunk_header.clear();
        }

        if let Some(h) = hunk {
            // If we have accumulated lines for a previous hunk, flush them
            if !current_lines.is_empty() {
                if let Some(idx) = current_file_idx {
                    files[idx].hunks.push(DiffHunk {
                        header: current_hunk_header.clone(),
                        old_start: current_hunk_old_start,
                        old_lines: current_hunk_old_lines,
                        new_start: current_hunk_new_start,
                        new_lines: current_hunk_new_lines,
                        lines: std::mem::take(&mut current_lines),
                    });
                }
            }
            current_hunk_header = String::from_utf8_lossy(h.header()).trim().to_string();
            current_hunk_old_start = h.old_start();
            current_hunk_old_lines = h.old_lines();
            current_hunk_new_start = h.new_start();
            current_hunk_new_lines = h.new_lines();
        }

        let origin = line.origin();
        let content = String::from_utf8_lossy(line.content()).to_string();

        match origin {
            '+' | '>' => {
                additions_count[file_idx] += 1;
            }
            '-' | '<' => {
                deletions_count[file_idx] += 1;
            }
            _ => {}
        }

        if matches!(origin, '+' | '-' | ' ') {
            current_lines.push(DiffLine {
                origin,
                old_lineno: line.old_lineno(),
                new_lineno: line.new_lineno(),
                content,
            });
        }

        true
    })?;

    // Flush the last hunk
    if let Some(idx) = current_file_idx {
        if !current_lines.is_empty() {
            files[idx].hunks.push(DiffHunk {
                header: current_hunk_header,
                old_start: current_hunk_old_start,
                old_lines: current_hunk_old_lines,
                new_start: current_hunk_new_start,
                new_lines: current_hunk_new_lines,
                lines: current_lines,
            });
        }
    }

    // Update file stats
    for (i, file) in files.iter_mut().enumerate() {
        file.file.additions = additions_count[i];
        file.file.deletions = deletions_count[i];
    }

    // Get old/new content for non-binary files
    for file_diff in files.iter_mut() {
        if !file_diff.file.is_binary {
            file_diff.old_content = get_file_content_at_ref(repo, "HEAD", &file_diff.file.path).ok();
            file_diff.new_content = read_working_file(repo, &file_diff.file.path).ok();
        }
    }

    Ok(DiffResult {
        stats: DiffStats {
            files_changed: stats.files_changed(),
            additions: stats.insertions(),
            deletions: stats.deletions(),
        },
        files,
    })
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

    Ok(String::from_utf8_lossy(blob.content()).to_string())
}

/// Read a file from the working directory
fn read_working_file(repo: &Repository, file_path: &str) -> Result<String, TasukiError> {
    let workdir = repo
        .workdir()
        .ok_or_else(|| TasukiError::Git("Bare repository".to_string()))?;
    let full_path = workdir.join(file_path);
    std::fs::read_to_string(full_path)
        .map_err(|e| TasukiError::Io(format!("Cannot read {}: {}", file_path, e)))
}

/// Get recent commit log
pub fn get_log(repo_path: &str, max_count: usize) -> Result<Vec<CommitInfo>, TasukiError> {
    let repo = open_repo(repo_path)?;
    let mut revwalk = repo.revwalk()?;
    revwalk.push_head()?;
    revwalk.set_sorting(Sort::TIME)?;

    let mut commits = Vec::new();
    for (i, oid) in revwalk.enumerate() {
        if i >= max_count {
            break;
        }
        let oid = oid?;
        let commit = repo.find_commit(oid)?;

        let short_id = commit
            .as_object()
            .short_id()
            .map(|b| b.as_str().unwrap_or("").to_string())
            .unwrap_or_else(|_| oid.to_string()[..7].to_string());

        commits.push(CommitInfo {
            id: oid.to_string(),
            short_id,
            message: commit.message().unwrap_or("").to_string(),
            author: commit.author().name().unwrap_or("").to_string(),
            time: commit.time().seconds(),
        });
    }

    Ok(commits)
}

/// List markdown doc files in a directory
pub fn list_doc_files(repo_path: &str) -> Result<Vec<String>, TasukiError> {
    let repo = open_repo(repo_path)?;
    let workdir = repo
        .workdir()
        .ok_or_else(|| TasukiError::Git("Bare repository".to_string()))?;

    let mut doc_files = Vec::new();

    // Search for .md files in common doc directories
    let search_dirs = ["docs", "doc", "design", "."];
    for dir in &search_dirs {
        let search_path = workdir.join(dir);
        if search_path.is_dir() {
            let pattern = format!("{}/**/*.md", search_path.display());
            if let Ok(entries) = glob::glob(&pattern) {
                for entry in entries.flatten() {
                    if let Ok(relative) = entry.strip_prefix(workdir) {
                        let path_str = relative.to_string_lossy().to_string();
                        if !path_str.starts_with("node_modules/")
                            && !path_str.starts_with("target/")
                            && !path_str.starts_with(".git/")
                            && !doc_files.contains(&path_str)
                        {
                            doc_files.push(path_str);
                        }
                    }
                }
            }
        }
    }

    doc_files.sort();
    Ok(doc_files)
}

/// Read a file's content from the working directory
pub fn read_file(repo_path: &str, file_path: &str) -> Result<String, TasukiError> {
    let repo = open_repo(repo_path)?;
    read_working_file(&repo, file_path)
}

/// Get the HEAD commit SHA
pub fn get_head_sha(repo_path: &str) -> Result<String, TasukiError> {
    let repo = open_repo(repo_path)?;
    let head = repo.head()?;
    let commit = head.peel_to_commit()?;
    Ok(commit.id().to_string())
}

/// Compute a SHA-256 hash of a DiffResult for change detection
pub fn compute_diff_hash(diff_result: &DiffResult) -> String {
    let json = serde_json::to_string(diff_result).unwrap_or_default();
    let hash = Sha256::digest(json.as_bytes());
    format!("{:x}", hash)
}
