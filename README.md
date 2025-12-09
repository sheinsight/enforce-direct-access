# enforce-direct-access

[![npm version](https://img.shields.io/npm/v/@shined/babel-plugin-enforce-direct-access.svg)](https://www.npmjs.com/package/@shined/babel-plugin-enforce-direct-access)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Babel and SWC plugins that enforce direct access patterns to ensure compatibility with build-time text replacement tools like webpack's DefinePlugin.

[English](#english) | [中文](#中文)

---

## English

### Why This Plugin?

When using build-time text replacement tools (e.g., webpack's DefinePlugin, Vite's define), these tools perform simple **string replacement** without semantic analysis. This means they can only replace code that follows specific patterns:

**✅ Works with DefinePlugin:**
```javascript
const apiKey = process.env.API_KEY;  // Direct access
```

**❌ Breaks with DefinePlugin:**
```javascript
const apiKey = process?.env.API_KEY;  // Optional chaining prevents replacement
const { env } = process;              // Destructuring breaks the chain
const { API_KEY } = process?.env;     // Both issues combined
```

This plugin helps you catch these incompatible patterns at build time, preventing runtime errors in production.

### Features

- 🚀 **Zero runtime overhead** - Catches issues at build time
- 🎯 **Precise detection** - Identifies three unsafe patterns
- 🔍 **Scope-aware** - Only checks global references, ignores local variables
- ⚙️ **Configurable** - Specify which paths to check
- 🔄 **Dual implementation** - Both Babel and SWC versions available
- 📦 **TypeScript support** - Full type definitions included

### Installation

#### Babel Plugin

```bash
npm install -D @shined/babel-plugin-enforce-direct-access
# or
pnpm add -D @shined/babel-plugin-enforce-direct-access
# or
yarn add -D @shined/babel-plugin-enforce-direct-access
```

#### SWC Plugin

```bash
npm install -D @shined/swc-plugin-enforce-direct-access
# or
pnpm add -D @shined/swc-plugin-enforce-direct-access
```

### Usage

#### Babel Configuration

```javascript
// babel.config.js
module.exports = {
  plugins: [
    ['@shined/babel-plugin-enforce-direct-access', {
      paths: ['process.env', 'import.meta.env']
    }]
  ]
};
```

#### SWC Configuration

```javascript
// .swcrc
{
  "jsc": {
    "experimental": {
      "plugins": [
        ["@shined/swc-plugin-enforce-direct-access", {
          "paths": ["process.env", "import.meta.env"]
        }]
      ]
    }
  }
}
```

### Configuration Options

```typescript
interface PluginOptions {
  /**
   * Array of object paths to check
   * Example: ["process.env", "import.meta.env"]
   *
   * Required - no default values provided
   * If empty array or not configured, plugin performs no checks
   */
  paths: string[];
}
```

### Detected Patterns

The plugin detects three unsafe patterns:

#### Pattern 1: Optional Chaining

**❌ Unsafe:**
```javascript
const apiKey = process?.env.API_KEY;
const mode = import.meta?.env.MODE;
```

**✅ Safe:**
```javascript
const apiKey = process.env.API_KEY;
const mode = import.meta.env.MODE;
```

**Why?** Optional chaining (`?.`) prevents static analysis tools from identifying the complete property access path during build-time replacement.

#### Pattern 2: Destructuring with Optional Chaining

**❌ Unsafe:**
```javascript
const { API_KEY } = process?.env;
const { MODE } = import.meta?.env;
```

**✅ Safe:**
```javascript
const API_KEY = process.env.API_KEY;
const MODE = import.meta.env.MODE;
```

**Why?** The combination of destructuring and optional chaining makes it impossible for static analysis tools to track the property access chain.

#### Pattern 3: Destructuring Configured Paths

**❌ Unsafe (when config includes `process.env`):**
```javascript
const { env } = process;  // Creates process.env reference
```

**✅ Safe:**
```javascript
const apiKey = process.env.API_KEY;
```

**❌ Unsafe (when config includes `process.env.PORT`):**
```javascript
const { PORT } = process.env;  // Creates process.env.PORT reference
```

**✅ Safe:**
```javascript
const PORT = process.env.PORT;
```

**Why?** Destructuring breaks the static property access chain that build-time text replacement relies on. The check logic: `init_path + property_name` must match the configured path exactly.

### Scope Checking

The plugin only checks **global references** and ignores local variables:

**✅ No error (local variable):**
```javascript
const process = { env: { API_KEY: 'test' } };
const x = process?.env.API_KEY;  // OK - process is local
```

**❌ Error (global reference):**
```javascript
const x = process?.env.API_KEY;  // Error - process is global
```

**Note:** `import.meta` is always checked as it has no scope binding.

### Complete Example

```javascript
// .babelrc.js or babel.config.js
module.exports = {
  plugins: [
    ['@shined/babel-plugin-enforce-direct-access', {
      paths: [
        'process.env',
        'import.meta.env',
        'process.env.PORT',  // Check specific nested path
      ]
    }]
  ]
};
```

```javascript
// Your code
// ✅ These will work
const apiKey = process.env.API_KEY;
const mode = import.meta.env.MODE;
const { API_KEY, SECRET } = process.env;  // OK - doesn't create process.env

// ❌ These will throw errors
const x = process?.env.API_KEY;           // Error: Optional chaining
const { env } = process;                   // Error: Creates process.env
const { MODE } = import.meta?.env;         // Error: Destructuring + optional
```

### Error Messages

The plugin provides clear, actionable error messages:

```
Optional chaining with 'process.env' is unsafe for build-time replacement.
Remove the optional chaining operator ('?.') and access properties directly:
  ✗ Bad:  process?.env.API_KEY
  ✓ Good: process.env.API_KEY
```

```
Destructuring 'process.env' is unsafe for build-time replacement.
Remove destructuring pattern and access properties directly:
  ✗ Bad:  const { env } = process;
  ✓ Good: process.env.API_KEY
```

### Integration with Build Tools

#### Webpack + Babel

```javascript
// webpack.config.js
const webpack = require('webpack');

module.exports = {
  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/,
        use: {
          loader: 'babel-loader',
          options: {
            plugins: [
              ['@shined/babel-plugin-enforce-direct-access', {
                paths: ['process.env']
              }]
            ]
          }
        }
      }
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    })
  ]
};
```

#### Vite + Babel

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import babel from '@rollup/plugin-babel';

export default defineConfig({
  plugins: [
    babel({
      plugins: [
        ['@shined/babel-plugin-enforce-direct-access', {
          paths: ['import.meta.env']
        }]
      ]
    })
  ],
  define: {
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV),
  }
});
```

### Packages

This monorepo contains two plugin implementations:

- [`@shined/babel-plugin-enforce-direct-access`](./packages/babel) - Babel plugin (JavaScript/TypeScript)
- [`@shined/swc-plugin-enforce-direct-access`](./packages/swc) - SWC plugin (Rust/WASM)

### Project Structure

```
enforce-direct-access/
├── packages/
│   ├── babel/          # Babel plugin implementation
│   │   ├── src/
│   │   │   ├── index.ts       # Main plugin logic
│   │   │   ├── types.ts       # TypeScript type definitions
│   │   │   ├── utils.ts       # Utility functions
│   │   │   └── __tests__/     # Unit tests
│   │   └── package.json
│   └── swc/            # SWC plugin implementation
│       ├── src/
│       │   ├── lib.rs         # Plugin entry point
│       │   ├── transform.rs   # Core transformation logic
│       │   └── errors.rs      # Error reporting
│       └── Cargo.toml
├── e2e-tests/          # End-to-end tests for both plugins
├── script/             # Build and release scripts
├── REQUIREMENTS.md     # Detailed requirements documentation
└── README.md
```

### Development

#### Prerequisites

- Node.js v24.11.1 (see `.node-version`)
- pnpm 10.20.0
- Rust 1.88.0 (for SWC plugin development)

#### Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

#### Development Workflow

```bash
# Build specific package
cd packages/babel && pnpm build
cd packages/swc && cargo build --release

# Run unit tests
cd packages/babel && pnpm test

# Run E2E tests
cd e2e-tests && pnpm test

# Watch mode for development
cd packages/babel && pnpm test:watch
```

### Contributing

Contributions are welcome! Please read our [contributing guidelines](./CONTRIBUTING.md) before submitting PRs.

### License

MIT © [shined](https://github.com/shined)

---

## 中文

### 为什么需要这个插件？

在使用构建时文本替换工具（如 webpack 的 DefinePlugin、Vite 的 define）时，这些工具执行的是简单的**字符串替换**，不进行语义分析。这意味着它们只能替换遵循特定模式的代码：

**✅ DefinePlugin 可以正常工作：**
```javascript
const apiKey = process.env.API_KEY;  // 直接访问
```

**❌ DefinePlugin 无法工作：**
```javascript
const apiKey = process?.env.API_KEY;  // 可选链阻止替换
const { env } = process;              // 解构破坏访问链
const { API_KEY } = process?.env;     // 两个问题结合
```

这个插件帮助你在构建时捕获这些不兼容的模式，防止生产环境中的运行时错误。

### 特性

- 🚀 **零运行时开销** - 在构建时捕获问题
- 🎯 **精确检测** - 识别三种不安全模式
- 🔍 **作用域感知** - 只检查全局引用，忽略局部变量
- ⚙️ **可配置** - 指定要检查的路径
- 🔄 **双重实现** - 提供 Babel 和 SWC 两个版本
- 📦 **TypeScript 支持** - 包含完整的类型定义

### 安装

#### Babel 插件

```bash
npm install -D @shined/babel-plugin-enforce-direct-access
# 或
pnpm add -D @shined/babel-plugin-enforce-direct-access
# 或
yarn add -D @shined/babel-plugin-enforce-direct-access
```

#### SWC 插件

```bash
npm install -D @shined/swc-plugin-enforce-direct-access
# 或
pnpm add -D @shined/swc-plugin-enforce-direct-access
```

### 使用方法

#### Babel 配置

```javascript
// babel.config.js
module.exports = {
  plugins: [
    ['@shined/babel-plugin-enforce-direct-access', {
      paths: ['process.env', 'import.meta.env']
    }]
  ]
};
```

#### SWC 配置

```javascript
// .swcrc
{
  "jsc": {
    "experimental": {
      "plugins": [
        ["@shined/swc-plugin-enforce-direct-access", {
          "paths": ["process.env", "import.meta.env"]
        }]
      ]
    }
  }
}
```

### 配置选项

```typescript
interface PluginOptions {
  /**
   * 要检查的对象路径数组
   * 例如：["process.env", "import.meta.env"]
   *
   * 必填 - 不提供默认值
   * 如果为空数组或未配置，插件不会执行任何检查
   */
  paths: string[];
}
```

### 检测模式

插件检测三种不安全模式：

#### 模式 1：可选链

**❌ 不安全：**
```javascript
const apiKey = process?.env.API_KEY;
const mode = import.meta?.env.MODE;
```

**✅ 安全：**
```javascript
const apiKey = process.env.API_KEY;
const mode = import.meta.env.MODE;
```

**原因：** 可选链（`?.`）阻止静态分析工具在构建时识别完整的属性访问路径。

#### 模式 2：解构 + 可选链

**❌ 不安全：**
```javascript
const { API_KEY } = process?.env;
const { MODE } = import.meta?.env;
```

**✅ 安全：**
```javascript
const API_KEY = process.env.API_KEY;
const MODE = import.meta.env.MODE;
```

**原因：** 解构和可选链的组合使得静态分析工具无法追踪属性访问链。

#### 模式 3：解构配置的路径

**❌ 不安全（当配置包含 `process.env` 时）：**
```javascript
const { env } = process;  // 创建了 process.env 引用
```

**✅ 安全：**
```javascript
const apiKey = process.env.API_KEY;
```

**❌ 不安全（当配置包含 `process.env.PORT` 时）：**
```javascript
const { PORT } = process.env;  // 创建了 process.env.PORT 引用
```

**✅ 安全：**
```javascript
const PORT = process.env.PORT;
```

**原因：** 解构破坏了构建时文本替换所依赖的静态属性访问链。检查逻辑：`init_path + property_name` 必须精确匹配配置的路径。

### 作用域检查

插件只检查**全局引用**，忽略局部变量：

**✅ 不报错（局部变量）：**
```javascript
const process = { env: { API_KEY: 'test' } };
const x = process?.env.API_KEY;  // OK - process 是局部变量
```

**❌ 报错（全局引用）：**
```javascript
const x = process?.env.API_KEY;  // 错误 - process 是全局变量
```

**注意：** `import.meta` 始终会被检查，因为它没有作用域绑定。

### 完整示例

```javascript
// .babelrc.js 或 babel.config.js
module.exports = {
  plugins: [
    ['@shined/babel-plugin-enforce-direct-access', {
      paths: [
        'process.env',
        'import.meta.env',
        'process.env.PORT',  // 检查特定的嵌套路径
      ]
    }]
  ]
};
```

```javascript
// 你的代码
// ✅ 这些可以正常工作
const apiKey = process.env.API_KEY;
const mode = import.meta.env.MODE;
const { API_KEY, SECRET } = process.env;  // OK - 不会创建 process.env

// ❌ 这些会抛出错误
const x = process?.env.API_KEY;           // 错误：可选链
const { env } = process;                   // 错误：创建了 process.env
const { MODE } = import.meta?.env;         // 错误：解构 + 可选链
```

### 错误信息

插件提供清晰、可操作的错误信息：

```
Optional chaining with 'process.env' is unsafe for build-time replacement.
Remove the optional chaining operator ('?.') and access properties directly:
  ✗ Bad:  process?.env.API_KEY
  ✓ Good: process.env.API_KEY
```

```
Destructuring 'process.env' is unsafe for build-time replacement.
Remove destructuring pattern and access properties directly:
  ✗ Bad:  const { env } = process;
  ✓ Good: process.env.API_KEY
```

### 与构建工具集成

#### Webpack + Babel

```javascript
// webpack.config.js
const webpack = require('webpack');

module.exports = {
  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/,
        use: {
          loader: 'babel-loader',
          options: {
            plugins: [
              ['@shined/babel-plugin-enforce-direct-access', {
                paths: ['process.env']
              }]
            ]
          }
        }
      }
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    })
  ]
};
```

#### Vite + Babel

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import babel from '@rollup/plugin-babel';

export default defineConfig({
  plugins: [
    babel({
      plugins: [
        ['@shined/babel-plugin-enforce-direct-access', {
          paths: ['import.meta.env']
        }]
      ]
    })
  ],
  define: {
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV),
  }
});
```

### 开发

#### 环境要求

- Node.js v24.11.1（参见 `.node-version`）
- pnpm 10.20.0
- Rust 1.88.0（用于 SWC 插件开发）

#### 安装

```bash
# 安装依赖
pnpm install

# 构建所有包
pnpm build

# 运行测试
pnpm test
```

#### 开发流程

```bash
# 构建特定包
cd packages/babel && pnpm build
cd packages/swc && cargo build --release

# 运行单元测试
cd packages/babel && pnpm test

# 运行 E2E 测试
cd e2e-tests && pnpm test

# 开发模式（监听模式）
cd packages/babel && pnpm test:watch
```

### 贡献

欢迎贡献！在提交 PR 之前，请阅读我们的[贡献指南](./CONTRIBUTING.md)。

### 许可证

MIT © [shined](https://github.com/shined)
