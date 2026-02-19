use git2::{Repository, Signature};
use std::fs;
use std::path::Path;
use tempfile::TempDir;

use tasuki_lib::git;

/// Helper: create a temp git repo with an initial commit containing multiple files
fn setup_repo() -> (TempDir, String) {
    let dir = TempDir::new().unwrap();
    let repo = Repository::init(dir.path()).unwrap();

    // Create initial files
    fs::write(dir.path().join("hello.txt"), "hello world\n").unwrap();
    fs::create_dir_all(dir.path().join("src")).unwrap();
    fs::write(dir.path().join("src/main.rs"), "fn main() {}\n").unwrap();

    let mut index = repo.index().unwrap();
    index.add_path(Path::new("hello.txt")).unwrap();
    index.add_path(Path::new("src/main.rs")).unwrap();
    index.write().unwrap();
    let tree_id = index.write_tree().unwrap();
    let tree = repo.find_tree(tree_id).unwrap();
    let sig = Signature::now("Test", "test@test.com").unwrap();
    repo.commit(Some("HEAD"), &sig, &sig, "initial commit", &tree, &[])
        .unwrap();

    let path = dir.path().to_string_lossy().to_string();
    (dir, path)
}

/// Helper: stage all changes and create a commit
fn commit_all(dir: &TempDir, message: &str) {
    let repo = Repository::open(dir.path()).unwrap();
    let mut index = repo.index().unwrap();
    index
        .add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)
        .unwrap();
    index.write().unwrap();
    let tree_id = index.write_tree().unwrap();
    let tree = repo.find_tree(tree_id).unwrap();
    let sig = Signature::now("Test", "test@test.com").unwrap();
    let head = repo.head().unwrap().peel_to_commit().unwrap();
    repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &[&head])
        .unwrap();
}

#[test]
fn staged_diff_contains_modified_file() {
    let (dir, repo_path) = setup_repo();

    // Modify and stage
    fs::write(dir.path().join("hello.txt"), "hello updated\n").unwrap();
    let repo = Repository::open(dir.path()).unwrap();
    let mut index = repo.index().unwrap();
    index.add_path(Path::new("hello.txt")).unwrap();
    index.write().unwrap();

    let result = git::get_staged_diff(&repo_path).unwrap();
    let file = result.files.iter().find(|f| f.file.path == "hello.txt");
    assert!(file.is_some(), "Staged modified file should appear");
    assert_eq!(file.unwrap().file.status, "modified");
}

#[test]
fn staged_diff_has_correct_hunk_structure() {
    let (dir, repo_path) = setup_repo();

    // Add a multi-line file so the diff has context lines
    fs::write(
        dir.path().join("multi.txt"),
        "line1\nline2\nline3\nline4\nline5\n",
    )
    .unwrap();
    commit_all(&dir, "add multi.txt");

    // Modify a middle line and stage
    fs::write(
        dir.path().join("multi.txt"),
        "line1\nline2\nchanged\nline4\nline5\n",
    )
    .unwrap();
    let repo = Repository::open(dir.path()).unwrap();
    let mut index = repo.index().unwrap();
    index.add_path(Path::new("multi.txt")).unwrap();
    index.write().unwrap();

    let result = git::get_staged_diff(&repo_path).unwrap();
    let file = result
        .files
        .iter()
        .find(|f| f.file.path == "multi.txt")
        .unwrap();

    assert!(!file.hunks.is_empty(), "Should have at least one hunk");
    let hunk = &file.hunks[0];
    assert!(!hunk.lines.is_empty(), "Hunk should have lines");

    // File stats should reflect the change
    assert!(file.file.additions > 0, "Should have additions");
    assert!(file.file.deletions > 0, "Should have deletions");

    // Check line number consistency for each origin type
    for line in &hunk.lines {
        match line.origin {
            '+' => {
                assert!(line.new_lineno.is_some());
                assert!(line.old_lineno.is_none());
            }
            '-' => {
                assert!(line.old_lineno.is_some());
                assert!(line.new_lineno.is_none());
            }
            ' ' => {
                assert!(line.old_lineno.is_some());
                assert!(line.new_lineno.is_some());
            }
            _ => {}
        }
    }
}

#[test]
fn working_diff_contains_unstaged_changes() {
    let (dir, repo_path) = setup_repo();

    // Modify without staging
    fs::write(dir.path().join("hello.txt"), "hello modified\n").unwrap();

    let result = git::get_working_diff(&repo_path).unwrap();
    let file = result.files.iter().find(|f| f.file.path == "hello.txt");
    assert!(file.is_some(), "Unstaged modified file should appear");
    assert_eq!(file.unwrap().file.status, "modified");
}

#[test]
fn uncommitted_diff_includes_staged_working_and_untracked() {
    let (dir, repo_path) = setup_repo();

    // Stage a change
    fs::write(dir.path().join("hello.txt"), "staged change\n").unwrap();
    let repo = Repository::open(dir.path()).unwrap();
    let mut index = repo.index().unwrap();
    index.add_path(Path::new("hello.txt")).unwrap();
    index.write().unwrap();

    // Working change (different file)
    fs::write(
        dir.path().join("src/main.rs"),
        "fn main() { println!(\"hi\"); }\n",
    )
    .unwrap();

    // Untracked file
    fs::write(dir.path().join("new_file.txt"), "new\n").unwrap();

    let result = git::get_uncommitted_diff(&repo_path).unwrap();

    let staged = result.files.iter().find(|f| f.file.path == "hello.txt");
    assert!(staged.is_some(), "Staged file should appear");

    let working = result.files.iter().find(|f| f.file.path == "src/main.rs");
    assert!(working.is_some(), "Working tree change should appear");

    let untracked = result.files.iter().find(|f| f.file.path == "new_file.txt");
    assert!(untracked.is_some(), "Untracked file should appear");
    assert_eq!(untracked.unwrap().file.status, "added");
}

#[test]
fn commit_diff_returns_changes_from_commit() {
    let (dir, repo_path) = setup_repo();

    // Make a second commit
    fs::write(dir.path().join("hello.txt"), "updated content\n").unwrap();
    commit_all(&dir, "second commit");

    let result = git::get_commit_diff(&repo_path, "HEAD").unwrap();
    let file = result.files.iter().find(|f| f.file.path == "hello.txt");
    assert!(
        file.is_some(),
        "Committed file should appear in commit diff"
    );
    assert_eq!(file.unwrap().file.status, "modified");
}

#[test]
fn range_diff_returns_changes_between_commits() {
    let (dir, repo_path) = setup_repo();

    // Second commit
    fs::write(dir.path().join("hello.txt"), "second version\n").unwrap();
    commit_all(&dir, "second commit");

    // Third commit
    fs::write(
        dir.path().join("src/main.rs"),
        "fn main() { println!(\"v3\"); }\n",
    )
    .unwrap();
    commit_all(&dir, "third commit");

    // Range diff: HEAD~2 to HEAD should include both changes
    let result = git::get_ref_diff(&repo_path, "HEAD~2", "HEAD").unwrap();
    assert!(
        result.files.len() >= 2,
        "Range diff should include changes from both commits, got {}",
        result.files.len()
    );
}

#[test]
fn old_content_and_new_content_set_for_modified_file() {
    let (dir, repo_path) = setup_repo();

    fs::write(dir.path().join("hello.txt"), "updated content\n").unwrap();

    let result = git::get_uncommitted_diff(&repo_path).unwrap();
    let file = result
        .files
        .iter()
        .find(|f| f.file.path == "hello.txt")
        .unwrap();

    assert!(
        file.old_content.is_some(),
        "Modified file should have old_content"
    );
    assert!(
        file.new_content.is_some(),
        "Modified file should have new_content"
    );
    assert!(file.old_content.as_ref().unwrap().contains("hello world"));
    assert!(file
        .new_content
        .as_ref()
        .unwrap()
        .contains("updated content"));
}

#[test]
fn added_file_has_no_old_content() {
    let (dir, repo_path) = setup_repo();

    fs::write(dir.path().join("brand_new.txt"), "brand new\n").unwrap();

    let result = git::get_uncommitted_diff(&repo_path).unwrap();
    let file = result
        .files
        .iter()
        .find(|f| f.file.path == "brand_new.txt")
        .unwrap();

    assert_eq!(file.file.status, "added");
    assert!(
        file.old_content.is_none(),
        "Added file should have no old_content"
    );
    assert!(
        file.new_content.is_some(),
        "Added file should have new_content"
    );
}

#[test]
fn deleted_file_has_no_new_content() {
    let (dir, repo_path) = setup_repo();

    // Delete a tracked file and stage it
    fs::remove_file(dir.path().join("hello.txt")).unwrap();
    let repo = Repository::open(dir.path()).unwrap();
    let mut index = repo.index().unwrap();
    index.remove_path(Path::new("hello.txt")).unwrap();
    index.write().unwrap();

    let result = git::get_staged_diff(&repo_path).unwrap();
    let file = result
        .files
        .iter()
        .find(|f| f.file.path == "hello.txt")
        .unwrap();

    assert_eq!(file.file.status, "deleted");
    assert!(
        file.old_content.is_some(),
        "Deleted file should have old_content"
    );
    assert!(
        file.new_content.is_none(),
        "Deleted file should have no new_content"
    );
}
