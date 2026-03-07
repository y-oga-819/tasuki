# Document Viewer

Tasuki lets you read documentation alongside the diff — useful for checking if implementation matches the spec.

## Split Mode

In **Split** display mode, the screen is divided into two panes:

- **Left**: Diff viewer
- **Right**: Document pane

Click a document in the sidebar's **Documents** section to display it in the right pane.

## Viewer Mode

The **Viewer** tab in the toolbar switches to a documentation-focused layout:

- **Left**: Full-width Markdown viewer
- **Right**: Terminal pane

This mode hides diff-related controls and the Changed Files section, letting you focus on reading.

## Supported Content

### Markdown

Full GitHub-Flavored Markdown rendering:

- Headings, lists, blockquotes
- Tables
- Code blocks with syntax highlighting (powered by Shiki)
- Task lists
- Links and images

### Mermaid Diagrams

Mermaid diagrams render as interactive SVGs:

- Hover to reveal a **zoom button**
- Click zoom to open a fullscreen modal
- Use **+/−** buttons or mouse wheel to zoom in/out
- Drag to pan
- Click the percentage display to reset zoom
- Press `Escape` or click outside to close

### Design Docs

Design documents from `~/.claude/designs/{repo-name}/` appear in the sidebar under **Design Docs**. These are read-only and useful for referencing architectural decisions during review.

## External Folders

In the Tauri desktop app, you can add external folders:

1. Click **Add Folder** in the sidebar
2. Select a folder containing `.md` files
3. The folder appears as a new sidebar section
4. Click any file to preview it
5. Click **✕** to remove the folder

Multiple folders can be added independently.

## Layout

- The divider between panes is **draggable** — resize by dragging the border
- The document pane has a **max width of 900px** in Split mode (diff takes priority)
- In Viewer mode, the terminal pane has the max width instead (documents take priority)
