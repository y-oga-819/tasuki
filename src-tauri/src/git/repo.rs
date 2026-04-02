use git2::{Repository, Sort};
use serde::{Deserialize, Serialize};

use crate::error::TasukiError;

/// Commit info for log display
#[derive(Debug, Clone, Serialize)]
pub struct CommitInfo {
    pub id: String,
    pub short_id: String,
    pub message: String,
    pub author: String,
    pub time: i64,
}

/// Repository information (branch, worktree status)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoInfo {
    pub repo_name: String,
    pub branch_name: Option<String>,
    pub is_worktree: bool,
}

/// Discover the git workdir root from an arbitrary path.
///
/// Walks up the directory tree to find the `.git` directory, then returns
/// the workdir path. This correctly resolves the repo root even when the
/// starting path is a subdirectory (e.g. `src-tauri/` during `tauri dev`)
/// or inside a git worktree.
pub fn discover_repo_root(start: &std::path::Path) -> Result<String, TasukiError> {
    let repo = Repository::discover(start)?;
    let workdir = repo
        .workdir()
        .ok_or_else(|| TasukiError::Git("Bare repository".to_string()))?;
    Ok(workdir
        .to_string_lossy()
        .trim_end_matches('/')
        .to_string())
}

/// Open a git repository at the given path
pub fn open_repo(repo_path: &str) -> Result<Repository, TasukiError> {
    Ok(Repository::open(repo_path)?)
}

/// Get repository info (name, branch, worktree status)
pub fn get_repo_info(repo_path: &str) -> Result<RepoInfo, TasukiError> {
    let repo = open_repo(repo_path)?;
    let repo_name = resolve_repo_name(&repo);
    let branch_name = repo
        .head()
        .ok()
        .and_then(|h| h.shorthand().map(|s| s.to_string()));
    let is_worktree = repo.is_worktree();
    Ok(RepoInfo {
        repo_name,
        branch_name,
        is_worktree,
    })
}

/// Get the HEAD commit SHA
pub fn get_head_sha(repo_path: &str) -> Result<String, TasukiError> {
    let repo = open_repo(repo_path)?;
    let head = repo.head()?;
    let commit = head.peel_to_commit()?;
    Ok(commit.id().to_string())
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

/// Read a file from the working directory
pub(crate) fn read_working_file(repo: &Repository, file_path: &str) -> Result<String, TasukiError> {
    let workdir = repo
        .workdir()
        .ok_or_else(|| TasukiError::Git("Bare repository".to_string()))?;
    let full_path = workdir.join(file_path);
    std::fs::read_to_string(full_path)
        .map_err(|e| TasukiError::Io(format!("Cannot read {}: {}", file_path, e)))
}

/// Resolve the repository name. For worktrees, trace back through commondir()
/// to find the original repository name.
fn resolve_repo_name(repo: &Repository) -> String {
    if repo.is_worktree() {
        let commondir = repo.commondir();
        commondir
            .ancestors()
            .find(|p| p.file_name().map_or(false, |n| n == ".git"))
            .and_then(|git_dir| git_dir.parent())
            .and_then(|p| p.file_name())
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown".to_string())
    } else {
        repo.workdir()
            .and_then(|p| p.file_name())
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;
    use tempfile::TempDir;

    fn setup_repo() -> (TempDir, String) {
        let dir = TempDir::new().unwrap();
        let repo = Repository::init(dir.path()).unwrap();
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
    fn test_get_repo_info_branch_name() {
        let (_dir, repo_path) = setup_repo();
        let info = get_repo_info(&repo_path).unwrap();
        assert!(info.branch_name.is_some());
        assert!(!info.is_worktree);
        assert!(!info.repo_name.is_empty());
    }

    #[test]
    fn test_get_repo_info_not_worktree() {
        let (_dir, repo_path) = setup_repo();
        let info = get_repo_info(&repo_path).unwrap();
        assert!(!info.is_worktree);
    }

    /// Canonicalize a path for comparison (resolves symlinks like /var → /private/var on macOS)
    fn canonical(p: &str) -> String {
        std::fs::canonicalize(p)
            .unwrap()
            .to_string_lossy()
            .to_string()
    }

    #[test]
    fn test_discover_repo_root_from_root() {
        let (_dir, repo_path) = setup_repo();
        let root = discover_repo_root(Path::new(&repo_path)).unwrap();
        assert_eq!(canonical(&root), canonical(&repo_path));
    }

    #[test]
    fn test_discover_repo_root_from_subdirectory() {
        let (dir, repo_path) = setup_repo();
        let subdir = dir.path().join("subdir");
        fs::create_dir(&subdir).unwrap();
        let root = discover_repo_root(&subdir).unwrap();
        assert_eq!(canonical(&root), canonical(&repo_path));
    }
}
