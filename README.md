# enforce-direct-access

Babel and SWC plugins for enforcing direct access patterns in JavaScript/TypeScript code.

## Packages

This monorepo contains two plugin implementations:

- [`@shined/babel-plugin-enforce-direct-access`](./packages/babel) - Babel plugin
- [`@shined/swc-plugin-enforce-direct-access`](./packages/swc) - SWC plugin (WASM)

## Project Structure

```
enforce-direct-access/
├── packages/
│   ├── babel/          # Babel plugin implementation
│   └── swc/            # SWC plugin implementation (Rust)
├── e2e-tests/          # End-to-end tests for both plugins
├── script/             # Build and release scripts
└── README.md
```

## Development

### Prerequisites

- Node.js v24.11.1 (see `.node-version`)
- pnpm 10.20.0
- Rust 1.88.0 (for SWC plugin)

### Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

### Development Workflow

```bash
# Start development mode (watch mode)
pnpm dev

# Test specific plugin
pnpm test:babel
pnpm test:swc

# Run e2e tests
pnpm test:e2e
```

## Publishing

```bash
# Interactive release workflow
pnpm prerelease
```

## License

MIT
