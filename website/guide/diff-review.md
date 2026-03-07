# Diff Review

Tasuki's diff viewer is built on `@pierre/diffs`, which renders diffs inside Shadow DOM for complete style isolation.

## View Modes

### Split View

Side-by-side comparison showing the old file on the left and the new file on the right. This is the default and most intuitive way to review changes.

### Unified View

Single-column view with deletions and additions shown inline. Useful for smaller changes or when screen width is limited.

Toggle between views using the **Split / Unified** buttons in the toolbar.

## Toolbar Controls

| Control | Description |
|---------|-------------|
| **Split / Unified** | Switch diff layout |
| **Scroll / Wrap** | Toggle long line handling |
| **Expand / Collapse** | Show/hide unchanged context lines |
| **Stats** | Shows files changed, additions, deletions |

## File Navigation

The sidebar lists all changed files with status indicators:

| Icon | Status |
|------|--------|
| **M** (blue) | Modified |
| **A** (green) | Added |
| **D** (red) | Deleted |
| **R** (purple) | Renamed |

Click a file name to scroll directly to its diff. Click a file header (the bar showing the file name) to collapse/expand that file's diff.

## Generated Files

Files marked as `is_generated` (like `package-lock.json`) are automatically collapsed when first loaded. Click the file header to expand them if needed.

## Search

Press `Cmd/Ctrl+F` to open the search bar. Type to search across all visible diff content.
