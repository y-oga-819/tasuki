# Contributing to Tasuki

Thank you for your interest in contributing to Tasuki! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 20+
- Rust 1.77+
- npm
- System libraries for Tauri (see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/))

### Getting Started

```bash
git clone https://github.com/y-oga-819/tasuki.git
cd tasuki
npm install
```

### Development

```bash
# Frontend only (browser dev with mock data)
npm run dev

# Tauri desktop app
npm run tauri dev
```

## Before Submitting

Please run the following checks before submitting a pull request:

```bash
npm run lint        # ESLint
npm test            # Vitest unit tests
npm run build       # TypeScript compile + Vite build
```

All three must pass.

## Pull Request Process

1. Fork the repository and create your branch from `main`
2. Make your changes
3. Ensure lint, tests, and build pass
4. Submit a pull request with a clear description of your changes

## Reporting Issues

- Use GitHub Issues to report bugs or suggest features
- Include steps to reproduce for bug reports
- Include your OS, Node.js version, and Rust version if relevant

## Code Style

- TypeScript: Follow the existing ESLint configuration
- Rust: Follow standard `rustfmt` formatting
- Keep changes focused and minimal

## License

By contributing to Tasuki, you agree that your contributions will be licensed under the MIT License.
