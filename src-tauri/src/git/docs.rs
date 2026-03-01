use crate::error::TasukiError;
use super::repo::{open_repo, read_working_file};

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
                            && !path_str.starts_with(".worktrees/")
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

#[cfg(test)]
mod tests {
    use super::*;
    use git2::Repository;
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
    fn test_list_doc_files_finds_markdown() {
        let (dir, repo_path) = setup_repo();
        fs::create_dir_all(dir.path().join("docs")).unwrap();
        fs::write(dir.path().join("docs/guide.md"), "# Guide\n").unwrap();
        fs::write(dir.path().join("docs/api.md"), "# API\n").unwrap();

        let docs = list_doc_files(&repo_path).unwrap();
        assert!(docs.contains(&"docs/guide.md".to_string()));
        assert!(docs.contains(&"docs/api.md".to_string()));
    }

    #[test]
    fn test_read_file_returns_content() {
        let (_dir, repo_path) = setup_repo();
        let result = read_file(&repo_path, "hello.txt").unwrap();
        assert_eq!(result, "hello world\n");
    }
}
