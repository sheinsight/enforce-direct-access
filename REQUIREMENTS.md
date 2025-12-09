# Enforce Direct Access - 功能需求文档

## 概述

`enforce-direct-access` 是一个 Babel 和 SWC 插件，用于强制对配置的对象路径进行直接属性访问，禁止使用可选链操作符（`?.`）和解构配置路径本身。

## 规则目的

强制对配置的对象路径进行直接属性访问，确保构建工具（如 webpack DefinePlugin）能够正确替换环境变量。

## ⚠️ 与 oxc 原始实现的差异

本实现与 `oxc_linter` 中的原始 `enforce_direct_access` 规则有以下**关键差异**：

### 解构行为差异

**oxc 原始实现**：
- 配置 `["process.env"]` 时，禁止任何从 `process.env` 的解构
- `const { API_KEY } = process.env` ❌ 报错

**本实现**：
- 配置 `["process.env"]` 时，只禁止解构 `process.env` 本身
- `const { env } = process` ❌ 报错（解构了 process.env）
- `const { API_KEY } = process.env` ✅ 允许（只是从 process.env 读取属性）

### 差异原因

本实现的设计更符合 DefinePlugin 的实际使用场景：

```javascript
// DefinePlugin 配置
new webpack.DefinePlugin({
  'process.env.NODE_ENV': JSON.stringify('production'),
  'process.env.API_KEY': JSON.stringify('xxx')
})

// 场景 1：从 process.env 读取属性（实际上是安全的）
const { API_KEY } = process.env;
// 等价于：
const API_KEY = process.env.API_KEY;  // ✅ 会被 DefinePlugin 替换

// 场景 2：解构 process.env 本身（这才是不安全的）
const { env } = process;
// 等价于：
const env = process.env;  // ❌ DefinePlugin 无法替换这种方式
```

## 为什么需要这个规则？

### 核心原因：配合 webpack DefinePlugin 的文本替换机制

**webpack DefinePlugin 的工作原理**：

DefinePlugin 在编译时执行**简单的文本替换**（string replacement），而不是语义分析。

例如配置：
```javascript
new webpack.DefinePlugin({
  'process.env.NODE_ENV': JSON.stringify('production'),
  'process.env.API_URL': JSON.stringify('https://api.example.com')
})
```

DefinePlugin 会在代码中搜索 `process.env.NODE_ENV` 这个**完整的字符串**，然后直接替换为 `"production"`。

---

### ❌ 为什么可选链会导致问题？

#### 问题 1：可选链破坏文本匹配

```javascript
// 源代码
const env = process?.env.NODE_ENV;

// DefinePlugin 查找: 'process.env.NODE_ENV'
// 实际代码中是: 'process?.env.NODE_ENV'
// ❌ 字符串不匹配！DefinePlugin 无法替换

// 构建后的代码（未被替换）
const env = process?.env.NODE_ENV;  // 运行时错误！process 可能未定义
```

#### 问题 2：属性上的可选链同样无法匹配

```javascript
// 源代码
const env = process.env?.NODE_ENV;

// DefinePlugin 查找: 'process.env.NODE_ENV'
// 实际代码中是: 'process.env?.NODE_ENV'
// ❌ 字符串不匹配！DefinePlugin 无法替换

// 构建后的代码（未被替换）
const env = process.env?.NODE_ENV;  // env 的值是 undefined！
```

---

### ❌ 为什么解构会导致问题？

#### 问题 3：解构语法中没有完整的访问路径

```javascript
// 源代码
const { NODE_ENV, API_URL } = process.env;

// DefinePlugin 查找: 'process.env.NODE_ENV' 和 'process.env.API_URL'
// 解构语法中没有这些完整的字符串！
// ❌ 无法匹配！DefinePlugin 无法替换

// 构建后的代码（未被替换）
const { NODE_ENV, API_URL } = process.env;
// NODE_ENV 和 API_URL 的值是 undefined！

console.log(NODE_ENV);  // undefined（而不是 'production'）
```

#### 问题 4：解构 + 可选链更加无法匹配

```javascript
// 源代码
const { NODE_ENV } = process?.env;

// DefinePlugin 完全无法识别这种模式
// ❌ 无法替换

// 构建后的代码
const { NODE_ENV } = process?.env;  // 运行时错误 + 变量是 undefined
```

---

### ✅ 正确的用法：直接属性访问

```javascript
// 源代码
const env = process.env.NODE_ENV;
const url = process.env.API_URL;

// DefinePlugin 查找: 'process.env.NODE_ENV' ✅ 完全匹配！
// 直接替换整个表达式

// 构建后的代码（已被替换）
const env = "production";
const url = "https://api.example.com";

// ✅ 完美！变量被正确替换为常量值
```

---

### 实际影响

使用可选链或解构会导致：

1. **构建时替换失败**：DefinePlugin 无法识别和替换环境变量
2. **运行时错误**：代码尝试访问 `process.env`，但在浏览器环境中 `process` 不存在
3. **变量值错误**：变量的值是 `undefined`，而不是预期的配置值
4. **Dead code elimination 失败**：无法根据环境变量进行 tree shaking

#### 示例：条件代码无法被优化

```javascript
// ❌ 错误：使用解构
const { NODE_ENV } = process.env;
if (NODE_ENV === 'production') {
  // 生产代码
} else {
  // 开发代码
}
// 两个分支都会保留在最终 bundle 中！

// ✅ 正确：直接访问
if (process.env.NODE_ENV === 'production') {
  // 生产代码
} else {
  // 开发代码
}
// DefinePlugin 替换后：
if ("production" === 'production') {
  // 生产代码
} else {
  // 开发代码  ← 会被 minifier 删除
}
```

---

### 其他构建工具

这个规则不仅适用于 webpack DefinePlugin，还适用于其他使用文本替换的构建工具：

- **Vite**: `define` 配置项也使用文本替换
- **esbuild**: `define` 选项同样是文本替换
- **Rollup**: `@rollup/plugin-replace` 也是文本替换
- **SWC**: `jsc.transform.optimizer.globals` 使用文本替换

所有这些工具都需要**完整的、直接的属性访问路径**才能正确工作。

## 配置选项

### `paths` (string[])

要检查的对象路径数组。

- **类型**：`string[]`
- **必填**：是
- **示例**：`["process.env"]`, `["import.meta.env"]`, `["process.env", "import.meta.env"]`

每个路径使用点分隔的字符串表示（例如：`"process.env"`, `"import.meta.env"`, `"process.env.host"`）。

**重要**：必须显式配置 `paths`，不提供默认值。如果未配置或为空数组，插件不会执行任何检查。

### 配置行为详解

**重要**：配置的路径是**精确匹配**的。规则只检查与配置路径**完全匹配**的访问。

#### 示例 1：配置 `["process.env"]`

```javascript
// ❌ 禁止：对 process.env 使用可选链
const x = process?.env.API_KEY;      // 报错：process.env 使用了可选链
const y = process.env?.API_KEY;      // 报错：process.env 使用了可选链

// ❌ 禁止：解构 process.env 本身
const { env } = process;             // 报错：解构了 process.env

// ✅ 允许：直接访问 process.env
const x = process.env.API_KEY;       // 正确：直接访问
const y = process.env.PORT;          // 正确：直接访问

// ✅ 允许：从 process.env 读取属性（不是解构 process.env 本身）
const { API_KEY } = process.env;     // 正确：从 process.env 读取属性
const { PORT, HOST } = process.env;  // 正确：从 process.env 读取属性
```

#### 示例 2：配置 `["process.env.host"]`（精确匹配特定属性）

```javascript
// ❌ 禁止：对 process.env.host 使用可选链
const host = process?.env.host;      // 报错：process.env.host 使用了可选链
const host = process.env?.host;      // 报错：process.env.host 使用了可选链

// ❌ 禁止：解构 process.env.host 本身
const { host } = process.env;        // 报错：解构了 process.env.host
const { host, name } = process.env;  // 报错：包含 host

// ✅ 允许：直接访问 process.env.host
const host = process.env.host;       // 正确：直接访问

// ✅ 允许：访问或解构其他属性（不在配置中）
const name = process.env?.name;      // 正确：process.env.name 不在配置中
const { name } = process.env;        // 正确：解构的是 name，不是 host
const { port, name } = process.env;  // 正确：解构的都不是 host
```

#### 示例 3：配置多个路径 `["process.env", "import.meta.env"]`

```javascript
// ❌ 禁止：对配置的路径使用可选链
const x = process?.env.API_KEY;      // 报错：process.env 使用可选链
const y = import.meta?.env.MODE;     // 报错：import.meta.env 使用可选链

// ❌ 禁止：解构配置的路径本身
const { env } = process;             // 报错：解构 process.env
const { env } = import.meta;         // 报错：解构 import.meta.env

// ✅ 允许：直接访问
const x = process.env.API_KEY;       // 正确
const y = import.meta.env.MODE;      // 正确

// ✅ 允许：从配置路径读取属性
const { API_KEY } = process.env;     // 正确：从 process.env 读取
const { MODE } = import.meta.env;    // 正确：从 import.meta.env 读取
```

### 配置示例

#### Babel 配置

```json
{
  "plugins": [
    ["@shined/babel-plugin-enforce-direct-access", {
      "paths": ["process.env"]
    }]
  ]
}
```

或配置多个路径：

```json
{
  "plugins": [
    ["@shined/babel-plugin-enforce-direct-access", {
      "paths": ["process.env", "import.meta.env"]
    }]
  ]
}
```

#### SWC 配置

```json
{
  "jsc": {
    "experimental": {
      "plugins": [
        ["@shined/swc-plugin-enforce-direct-access", {
          "paths": ["process.env"]
        }]
      ]
    }
  }
}
```

或配置多个路径：

```json
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

#### 不配置或空数组

如果不配置 `paths` 或 `paths` 为空数组，插件不会执行任何检查：

```json
{
  "plugins": [
    ["@shined/babel-plugin-enforce-direct-access", {
      "paths": []
    }]
  ]
}
```

## 检测的不安全模式

**前提**：以下所有示例假设配置为 `["process.env"]`。规则**只检查与配置路径完全匹配的访问**。

### Pattern 1: 在对象链中使用可选链（路径匹配时）

当表达式构建的完整路径与配置的路径匹配，且使用了可选链时报错。

❌ **错误示例**（配置：`["process.env"]`）：

```javascript
// 在 process 上使用可选链（构建的路径是 process.env.API_KEY）
const apiKey = process?.env.API_KEY;      // ❌ 匹配 process.env
const port = process?.env['PORT'];        // ❌ 匹配 process.env
const host = process?.['env'].HOST;       // ❌ 匹配 process.env

// 在 env 上使用可选链（构建的路径是 process.env.API_KEY）
const apiKey = process.env?.API_KEY;      // ❌ 匹配 process.env
const port = process['env']?.PORT;        // ❌ 匹配 process.env
```

✅ **允许**（不匹配配置路径）：

```javascript
// 配置：["process.env"]
const other = process?.other.value;       // ✅ 不匹配 process.env
const pid = process?.pid;                 // ✅ 不匹配 process.env

// 配置：["process.env.host"]
const name = process.env?.name;           // ✅ 不匹配 process.env.host
```

**诊断信息**：
- 错误：`Optional chaining with 'process.env' is unsafe.`
- 帮助：`Remove the optional chaining operator ('?.'). Access properties directly instead.`

---

### Pattern 2: 解构 + 可选链

当解构的 init 表达式与配置路径匹配，且使用了可选链时报错。

❌ **错误示例**（配置：`["process.env"]`）：

```javascript
// 解构 + 可选链
const { API_KEY } = process?.env;         // ❌ 匹配 process.env
const { PORT, HOST } = process?.env;      // ❌ 匹配 process.env
const { DB } = process?.['env'];          // ❌ 匹配 process.env
```

✅ **允许**（init 不匹配配置路径）：

```javascript
// 配置：["process.env"]
const { x } = process?.other;             // ✅ 不匹配 process.env
const { y } = other?.env;                 // ✅ 不匹配 process.env
```

**诊断信息**：
- 错误：`Destructuring with optional chaining on 'process.env' is unsafe.`
- 帮助：`Remove both destructuring and optional chaining. Access properties directly from 'process.env'.`

---

### Pattern 3: 纯解构（不带可选链）

检查解构是否直接解构了配置的路径本身。

**关键**：组合 `init 表达式 + 解构的属性名` 来判断是否匹配配置路径。

❌ **错误示例**（配置：`["process.env"]`）：

```javascript
// 解构 process.env 本身
const { env } = process;                  // ❌ process + env = process.env
const { env } = process?.something;       // ❌ 包含 env

// 使用 let 或 var 也一样
let { env } = process;                    // ❌ 不允许
var { env } = process;                    // ❌ 不允许
```

✅ **允许**（配置：`["process.env"]`）：

```javascript
// 从 process.env 读取属性（不是解构 process.env 本身）
const { API_KEY } = process.env;          // ✅ process.env + API_KEY = process.env.API_KEY（不匹配）
const { PORT, HOST } = process.env;       // ✅ 可以
const { DB } = process['env'];            // ✅ 可以

// 在函数内部也可以
function test() {
  const { NODE_ENV } = process.env;       // ✅ 可以
}
```

❌ **错误示例**（配置：`["process.env.host"]`）：

```javascript
// 解构 process.env.host 本身
const { host } = process.env;             // ❌ process.env + host = process.env.host
const { host, name } = process.env;       // ❌ 包含 host
```

✅ **允许**（配置：`["process.env.host"]`）：

```javascript
// 解构其他属性（不匹配配置）
const { name } = process.env;             // ✅ process.env.name 不匹配
const { port } = process.env;             // ✅ process.env.port 不匹配
const { name, port } = process.env;       // ✅ 都不匹配
```

**诊断信息**：
- 错误：`Destructuring 'process.env' is unsafe.` 或 `Destructuring 'process.env.host' is unsafe.`
- 帮助：`Access properties directly from 'process.env' instead of destructuring.`

---

## 核心逻辑总结

规则的检查逻辑可以概括为：

### 对于可选链（Optional Chaining）

1. 遍历整个可选链表达式
2. 构建完整的访问路径（忽略可选链操作符）
3. 检查构建的路径是否与配置的路径匹配
4. 如果匹配，报错

**示例**：
```javascript
// 配置：["process.env"]
process?.env.API_KEY
  ↓ 构建路径
"process.env.API_KEY"
  ↓ 检查前缀
"process.env" ✓ 匹配配置
  ↓ 报错
```

### 对于解构（Destructuring）

1. 检查 init 表达式的类型和路径
2. 遍历解构的每个属性
3. 对每个属性：组合 `init + 属性名` 构建完整路径，检查是否匹配配置路径
4. 如果匹配，报错

**关键**：无论配置是什么，都是组合 `init + 属性名` 来判断。

**示例 1**（配置：`["process.env"]`）：

```javascript
// 解构 process.env 本身
const { env } = process
  ↓ 组合路径
"process" + "env" = "process.env"
  ↓ 检查
"process.env" ✓ 匹配配置
  ↓ 报错
```

```javascript
// 从 process.env 读取属性
const { API_KEY } = process.env
  ↓ 组合路径
"process.env" + "API_KEY" = "process.env.API_KEY"
  ↓ 检查
"process.env.API_KEY" ✗ 不匹配配置 "process.env"
  ↓ 通过
```

**示例 2**（配置：`["process.env.host"]`）：

```javascript
// 解构 process.env.host 本身
const { host } = process.env
  ↓ 组合路径
"process.env" + "host" = "process.env.host"
  ↓ 检查
"process.env.host" ✓ 匹配配置
  ↓ 报错
```

```javascript
// 解构其他属性
const { name } = process.env
  ↓ 组合路径
"process.env" + "name" = "process.env.name"
  ↓ 检查
"process.env.name" ✗ 不匹配配置 "process.env.host"
  ↓ 通过
```

---

## 正确的用法

✅ **正确示例**：

```javascript
// 直接属性访问（点表示法）
const apiKey = process.env.API_KEY;
const dbUrl = process.env.DATABASE_URL;
const port = process.env.PORT;

// 直接属性访问（括号表示法）
const value = process.env['DATABASE_URL'];
const key = 'API_KEY';
const apiKey = process.env[key];

// import.meta.env 场景
const mode = import.meta.env.MODE;
const isDev = import.meta.env.DEV;

// 访问 process 的其他属性（不会触发规则）
const pid = process.pid;
const args = process.argv;
const platform = process.platform;

// 访问其他对象（不会触发规则）
const config = other.env.value;
const { x } = other.env;
```

## 不触发规则的场景

以下场景不会触发规则报错：

### 1. 非配置路径的对象

```javascript
// 访问其他对象
const foo = other?.env.x;
const bar = process?.other;
const { x } = other.env;
```

### 2. process 的其他属性

```javascript
// 访问 process 的其他属性
const pid = process.pid;
const args = process.argv;
const platform = process.platform;
```

### 3. 局部变量遮蔽

```javascript
// 函数参数遮蔽全局 process
function test(process) {
  const { x } = process.env; // 不会报错，因为 process 是局部变量
}

// 局部变量遮蔽
const process = {};
const { x } = process.env; // 不会报错
```

### 4. 自定义配置下的排除

```javascript
// 配置：{ "paths": ["import.meta.env"] }
// 以下代码不会报错，因为只检查 import.meta.env
const { API_KEY } = process.env;
const x = process?.env.PORT;
```

## 实现要点

### 1. 路径匹配算法

- 支持点分隔的路径：`"process.env"`
- 支持 MetaProperty：`"import.meta.env"`
- 支持静态成员访问：`process.env`
- 支持计算成员访问：`process['env']`
- 需要验证基础标识符是全局引用（不是局部变量）

### 2. AST 节点检测

#### Babel 需要检测的节点：

1. **OptionalMemberExpression** / **OptionalCallExpression**
   - 检测 Pattern 1：可选链
   - 需要遍历整个可选链，构建完整路径
   - 检查构建的路径是否与配置的路径匹配

2. **VariableDeclarator**
   - 检测 Pattern 2 和 Pattern 3：解构模式
   - 检查 `id` 是否为 `ObjectPattern`
   - 检查 `init` 表达式：
     - 如果 `init` 是 OptionalChaining：检测 Pattern 2（解构 + 可选链）
     - 如果 `init` 是普通 MemberExpression：检测 Pattern 3（纯解构）
   - 解构检查逻辑（统一逻辑）：
     - 遍历 ObjectPattern 中的每个解构属性
     - 对每个属性：组合 `init 路径 + 属性名` 构建完整路径
     - 检查构建的完整路径是否与配置的路径匹配
     - 示例：
       - `const { env } = process` → `process.env` → 匹配 `["process.env"]` → 报错
       - `const { API_KEY } = process.env` → `process.env.API_KEY` → 不匹配 `["process.env"]` → 通过
       - `const { host } = process.env` → `process.env.host` → 匹配 `["process.env.host"]` → 报错

#### SWC 需要检测的节点：

1. **OptionalChainingExpression**
   - 对应 Babel 的 OptionalMemberExpression
   - 检测可选链模式

2. **VariableDeclarator**
   - 对应 Babel 的 VariableDeclarator
   - 检测解构模式

### 3. 作用域检查

必须验证标识符是全局引用：

- `process` 必须是全局对象，不能是局部变量
- `import.meta` 是特殊的 MetaProperty，需要特殊处理
- 使用作用域分析（Scope Analysis）来判断

### 4. 路径构建

对于可选链表达式，需要构建完整的路径：

```javascript
// 对于 process?.env
// 需要构建 "process.env" 并与配置的路径比较

// 对于 import.meta?.env
// 需要构建 "import.meta.env" 并与配置的路径比较
```

### 5. 边界情况处理

- **空配置或未配置**：不执行任何检查，直接返回
- 嵌套的可选链：`process?.env?.API_KEY`
- 括号包裹：`(process?.env).API_KEY`
- 计算属性：`process['env']?.API_KEY`
- 混合访问：`process.env?.['API_KEY']`

## 错误消息格式

### Pattern 1: 可选链

```
Optional chaining with '{path}' is unsafe.

Remove the optional chaining operator ('?.'). Access properties directly instead.
```

其中 `{path}` 是匹配的配置路径，如 `process.env` 或 `process.env.host`。

### Pattern 2: 解构 + 可选链

```
Destructuring with optional chaining on '{path}' is unsafe.

Remove both destructuring and optional chaining. Access properties directly from '{path}'.
```

### Pattern 3: 纯解构

```
Destructuring '{path}' is unsafe.

Access properties directly from '{path}' instead of destructuring.
```

## 测试用例

### 通过的测试（不报错）

```javascript
// ✅ 直接访问
const apiKey = process.env.API_KEY;
const port = process.env.PORT;
const value = process.env['DATABASE_URL'];

// ✅ 从 process.env 读取属性（配置：["process.env"]）
const { API_KEY } = process.env;
const { PORT, HOST } = process.env;
const { DB } = process['env'];

// ✅ 非配置路径
const foo = other?.env.x;
const bar = process?.other;
const { x } = other.env;

// ✅ process 的其他属性
const pid = process.pid;
const args = process.argv;

// ✅ 局部变量遮蔽
function test(process) {
  const { env } = process;  // process 是局部变量
}
const process = {};
const { env } = process;    // process 是局部变量

// ✅ 自定义配置排除
// 配置：{ "paths": ["import.meta.env"] }
const { env } = process;           // process.env 不在配置中
const { API_KEY } = process.env;   // process.env 不在配置中
const port = import.meta.env.PORT;

// ✅ 解构其他属性（配置：["process.env.host"]）
const { name } = process.env;      // process.env.name 不匹配
const { port } = process.env;      // process.env.port 不匹配
```

### 失败的测试（报错）

```javascript
// ❌ Pattern 1: 可选链（配置：["process.env"]）
const x = process?.env.API_KEY;
const y = process?.env['PORT'];
const z = process?.['env'].HOST;
const a = process.env?.API_KEY;
const b = process['env']?.PORT;
const c = process?.env?.API_KEY;  // 多层可选链

// ❌ Pattern 2: 解构 + 可选链（配置：["process.env"]）
const { env } = process?.something;

// ❌ Pattern 3: 解构配置路径本身（配置：["process.env"]）
const { env } = process;
let { env } = process;
var { env } = process;
function test() {
  const { env } = process;
}

// ❌ 复杂场景
const x = (process?.env).API_KEY;

// ❌ 配置：["process.env.host"]
const host = process?.env.host;       // 可选链
const host = process.env?.host;       // 可选链
const { host } = process.env;         // 解构 process.env.host
const { host, name } = process.env;   // 包含 host

// ❌ import.meta.env（配置：["import.meta.env"]）
const { env } = import.meta;          // 解构 import.meta.env
const x = import.meta?.env.PORT;      // 可选链
const y = import.meta.env?.PORT;      // 可选链
```

## 性能考虑

1. **路径查找优化**：使用 HashSet 存储配置的路径，提供 O(1) 查找
2. **早期返回**：尽早判断是否需要检查，避免不必要的遍历
3. **作用域缓存**：Babel 和 SWC 都提供作用域信息，充分利用

## 兼容性

- **Babel**: 支持 Babel 7.x
- **SWC**: 支持 SWC 1.x
- **JavaScript**: ES2015+
- **TypeScript**: 完全支持
- **JSX/TSX**: 完全支持

## 实现优先级

### 第一阶段（核心功能）
1. ✅ 项目骨架搭建
2. ⏳ 实现配置解析（无默认值，空配置不执行检查）
3. ⏳ 实现基础的路径匹配算法
4. ⏳ 实现 Pattern 1（可选链检测）
5. ⏳ 实现 Pattern 3（纯解构检测）

### 第二阶段（完善功能）
6. ⏳ 实现 Pattern 2（解构 + 可选链）
7. ⏳ 实现作用域检查（全局引用验证）
8. ⏳ 支持 import.meta.env
9. ⏳ 完善错误消息

### 第三阶段（测试和文档）
10. ⏳ 编写单元测试
11. ⏳ 编写 E2E 测试
12. ⏳ 完善文档和示例
13. ⏳ 性能优化

## 参考资料

- 原始实现：`oxc_fork/crates/oxc_linter/src/rules/oxc/enforce_direct_access.rs`
- Babel AST 规范：https://github.com/babel/babel/blob/main/packages/babel-parser/ast/spec.md
- SWC AST 文档：https://swc.rs/docs/plugin/ecmascript/ast
