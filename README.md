<div align="center">
  <img src="src-tauri/icons/128x128.png" width="104" height="104" alt="FluentMD Logo">

  <h1>FluentMD</h1>

  <p>轻量、原生、专注写作的 Markdown 桌面编辑器</p>

  <p>
    <img src="https://img.shields.io/badge/version-0.1.2-111827?style=flat-square" alt="Version 0.1.2">
    <img src="https://img.shields.io/badge/Tauri-2-24C8D8?style=flat-square&logo=tauri&logoColor=white" alt="Tauri 2">
    <img src="https://img.shields.io/badge/Vue-3-42B883?style=flat-square&logo=vuedotjs&logoColor=white" alt="Vue 3">
    <img src="https://img.shields.io/badge/Windows-10%20%7C%2011-0078D4?style=flat-square&logo=windows&logoColor=white" alt="Windows 10 and 11">
  </p>

  <p>
    <a href="https://github.com/fkwhao/FluentMD/releases/latest"><strong>下载最新版本</strong></a>
    ·
    <a href="#核心体验">核心体验</a>
    ·
    <a href="#本地开发">本地开发</a>
    ·
    <a href="docs/PACKAGING.md">打包文档</a>
  </p>
</div>

---

FluentMD 基于 Tauri 2、Vue 3 与 CodeMirror 6 构建，在一个简洁的本地应用中提供源码分屏和所见即所得两种编辑方式。它面向日常 Markdown 写作，也兼顾代码、数学公式与较长文档。

## 下载

前往 [GitHub Releases](https://github.com/fkwhao/FluentMD/releases/latest) 下载适合你的 Windows 版本。

| 文件 | 用途 |
| --- | --- |
| `fluentmd_<version>_x64-setup.exe` | 标准安装版，推荐大多数用户使用 |
| `fluentmd.exe` | 免安装主程序，下载后直接运行 |
| `fluentmd_<version>_x64_en-US.msi` | MSI 安装包，适合系统部署 |

> 当前发布包面向 Windows 10/11 64 位系统。

## 核心体验

| 专注编辑 | 完整渲染 | 本地工作流 |
| --- | --- | --- |
| 分屏与所见即所得自由切换 | KaTeX 行内、块级数学公式 | 当前目录 Markdown 文件树 |
| 浅色、深色主题 | highlight.js 代码高亮 | 文档目录与标题跳转 |
| 跨模式保留撤销与编辑位置 | 表格、引用、列表与本地图片 | 保存状态和退出保护 |

### 双编辑模式

- **分屏模式**：左侧编辑 Markdown 源码，右侧实时查看排版结果。
- **所见即所得**：在正文中直接编辑，隐藏不需要展示的 Markdown 标记。
- 两种模式之间切换时保留撤销历史、选区和滚动位置。

### Markdown 渲染

- 标题、链接、引用、行内代码、代码块、列表和表格具有统一的排版层级。
- 代码块支持语法高亮、语言标签和可搜索的语言快速选择器。
- 使用 KaTeX 渲染行内公式与多行块级公式。
- 根据当前文档位置解析本地相对图片路径。
- 预览区使用虚拟滚动，降低长文档的渲染开销。

### 文档导航

- 自动提取标题并生成文档目录，支持点击跳转。
- 打开文档后展示同目录及子目录中的 `.md`、`.markdown` 文件。
- 文件切换、异步保存和关闭窗口均带有未保存内容保护。

## 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl/Cmd + N` | 新建文档 |
| `Ctrl/Cmd + O` | 打开文档 |
| `Ctrl/Cmd + S` | 保存文档 |
| `Ctrl/Cmd + Z` | 撤销 |
| `Ctrl + Y` / `Cmd + Shift + Z` | 重做 |
| `Ctrl/Cmd + F` | 文档内搜索 |

## 技术架构

| 技术 | 职责 |
| --- | --- |
| [Tauri 2](https://tauri.app/) | 桌面应用外壳与受控文件访问 |
| [Vue 3](https://vuejs.org/) + [Pinia](https://pinia.vuejs.org/) | 界面与应用状态 |
| [CodeMirror 6](https://codemirror.net/) | 编辑器内核 |
| [markdown-it](https://github.com/markdown-it/markdown-it) | Markdown 解析 |
| [highlight.js](https://highlightjs.org/) | 代码语法高亮 |
| [KaTeX](https://katex.org/) | 数学公式渲染 |
| [Vite](https://vite.dev/) | 前端开发与构建 |

## 本地开发

### 环境要求

- Node.js `20.19+` 或 `22.12+`
- Rust `1.77.2+`
- 当前系统所需的 [Tauri 前置依赖](https://v2.tauri.app/start/prerequisites/)

### 启动项目

```bash
git clone https://github.com/fkwhao/FluentMD.git
cd FluentMD
npm install
npm run tauri dev
```

`npm run tauri dev` 会自动启动 Vite。不要同时运行另一个 `npm run dev`，否则 5173 端口会发生冲突。

仅调试前端界面时可以运行 `npm run dev`，但浏览器模式无法使用文件对话框、本地文件读写和文件树等 Tauri 功能。

### 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run tauri dev` | 启动完整桌面应用 |
| `npm run dev` | 只启动前端开发服务器 |
| `npm test` | 运行自动化回归测试 |
| `npm run build` | 只构建前端资源 |
| `npm run tauri build` | 构建 Release 主程序与安装包 |

完整的版本升级、Windows 打包、产物校验与 Release 发布步骤请查看 [打包开发文档](docs/PACKAGING.md)。

## 项目结构

```text
FluentMD/
├─ src/
│  ├─ components/       Vue 界面组件
│  ├─ composables/      编辑器、主题与文件操作逻辑
│  ├─ stores/           Pinia 状态管理
│  ├─ styles/           全局主题与编辑器样式
│  └─ utils/            Markdown、公式与虚拟滚动
├─ src-tauri/
│  ├─ capabilities/     Tauri 权限配置
│  └─ src/              Rust 桌面端与文件树扫描
├─ tests/               自动化回归测试
└─ docs/                开发维护文档
```

## 文件访问

FluentMD 只会在用户通过系统文件对话框授权后访问文件。文件树仅扫描当前文档所在目录中的 Markdown 文件，并跳过符号链接、隐藏目录和常见构建目录。

## 反馈

项目仍在持续迭代中。提交 Issue 时，请附上操作系统、复现步骤、使用的编辑模式，以及能够触发问题的 Markdown 示例。
