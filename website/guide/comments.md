# Comments & Verdicts

## Adding Comments

### Single Line

1. Hover over a line number in the diff
2. Click the `+` button
3. Write your comment
4. Submit with **Add Comment** or `Cmd/Ctrl+Enter`

### Multi-Line Range

1. Click and drag across multiple line numbers
2. Click the `+` button on the selection
3. The comment form shows the range (e.g., `L10-L15`)

### Comment Types

Comments support plain text. The copied format includes code context:

```
src/components/DiffViewer.tsx:L14
> setCommentFormOpen(true);
Consider debouncing this to avoid rapid open/close cycles.
```

## Review Panel

The Review Panel at the bottom of the screen shows all comments. Each entry displays:

- File path and line number
- Code snippet
- Comment body
- Action buttons (copy, resolve, delete)

## Resolving Comments

1. Click the **✓** button next to a comment
2. Optionally add a resolution note
3. Click **Confirm** — the comment appears with strikethrough styling
4. Click **↩** to unresolve if needed

## Copying Comments

### Single Comment

Click the clipboard icon next to any comment. The copied text includes:

```
file-path:L12 > code snippet
Comment body
```

### All Comments

Click **Copy All** in the Review Panel. The output uses Markdown:

```markdown
## Review Result:

### src/components/DiffViewer.tsx

**L14** `setCommentFormOpen(true);`
Consider debouncing this.

**L26** `await copyToClipboard(text);`
Handle clipboard API unavailability.
```

::: tip
The **Copy All** button is disabled when there are no comments.
:::

## Verdicts

### Approve

- Requires all comments to be resolved
- Writes a gate file (`/tmp/tasuki/{repo}/{branch}/review.json`)
- The git pre-commit hook checks this file and allows the commit

### Reject

- Available at any time, regardless of comment status
- Blocks the commit via the gate file
- Unresolved comments are available for export
