# Getting Started

## Installation

### Download a Release

Download the latest release for your platform from [GitHub Releases](https://github.com/y-oga-819/tasuki/releases).

| Platform | File |
|----------|------|
| macOS (Apple Silicon) | `tasuki_x.x.x_aarch64.dmg` |
| macOS (Intel) | `tasuki_x.x.x_x64.dmg` |
| Linux (.deb) | `tasuki_x.x.x_amd64.deb` |
| Linux (.AppImage) | `tasuki_x.x.x_amd64.AppImage` |
| Windows | `tasuki_x.x.x_x64-setup.exe` |

### Build from Source

```bash
git clone https://github.com/y-oga-819/tasuki.git
cd tasuki
npm install
npm run tauri build
```

::: tip Prerequisites
Building from source requires [Node.js 22+](https://nodejs.org/), [Rust](https://rustup.rs/), and platform-specific dependencies for Tauri. See the [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/).
:::

## Quick Start

### 1. Open a Review

```bash
cd your-project

# Review all uncommitted changes (default)
tasuki

# Review only staged changes
tasuki --staged

# Review diff from a branch
tasuki --ref main

# Review a specific commit
tasuki --ref abc1234

# Review a range of commits
tasuki --ref v1.0..v2.0
```

### 2. Navigate the Diff

- The **sidebar** lists all changed files with status icons
- Click a file name to scroll to its diff
- Use the **toolbar** to switch between Split and Unified views

### 3. Add Comments

1. Hover over a line number — a `+` button appears
2. Click `+` to open the comment form
3. Type your comment
4. Press `Cmd/Ctrl+Enter` or click **Add Comment**

For multi-line comments, drag to select a range of lines first.

### 4. Copy and Share

- **Single comment**: Click the clipboard icon next to any comment
- **All comments**: Click **Copy All** in the Review Panel

The copied format includes file paths, line numbers, and code context — ready to paste into Claude Code.

### 5. Verdict

| Action | Condition | Effect |
|--------|-----------|--------|
| **Approve** | All comments resolved | Writes gate file, allows commit |
| **Reject** | Any time | Blocks commit, exports comments |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Cmd/Ctrl+F` | Search in diff |
| `Cmd/Ctrl+Enter` | Submit comment |
| `Escape` | Close form / modal |

## Browser Development Mode

You can preview the frontend without building the Tauri app:

```bash
npm run dev
# Open http://localhost:1420
```

Mock data is automatically provided when running outside of Tauri, so you can develop and test UI changes without a git repository.
