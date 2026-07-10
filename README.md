# FluentMD

一个基于 Tauri 2、Vue 3 和 CodeMirror 6 构建的轻量 Markdown 桌面编辑器，提供分屏预览与所见即所得两种编辑体验。

## 功能特性

- **双编辑模式**：支持源码/预览分屏和所见即所得模式，并可随时切换。
- **一致的 Markdown 排版**：针对标题、引用、行内代码、代码块、列表和表格统一了阅读层级与间距。
- **浅色与深色主题**：编辑区、预览区、弹出菜单和语法高亮均适配两种主题。
- **代码块体验**：支持语法高亮、语言标签以及可搜索、可键盘操作的语言快速选择器。
- **数学公式**：通过 KaTeX 渲染行内公式与块级公式。
- **图片与本地资源**：支持 Markdown 图片，并根据当前文档路径解析本地相对资源。
- **文档目录**：自动提取 Markdown 标题，显示当前章节并支持点击跳转。
- **Markdown 文件树**：打开文件后展示同目录及子目录中的 `.md`、`.markdown` 文件，可直接切换文档。
- **大文档预览**：预览区使用虚拟滚动，减少长文档的渲染开销。
- **状态持久化**：记住主题、编辑模式、字号、分栏比例、同步预览和侧边栏状态。

## 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl/Cmd + N` | 新建文档 |
| `Ctrl/Cmd + O` | 打开文档 |
| `Ctrl/Cmd + S` | 保存文档 |

编辑器还支持 CodeMirror 默认的撤销、重做、搜索和文本选择快捷键。

## 技术栈

- [Tauri 2](https://tauri.app/)：桌面应用外壳与安全文件访问
- [Vue 3](https://vuejs.org/) + [Pinia](https://pinia.vuejs.org/)：界面与状态管理
- [CodeMirror 6](https://codemirror.net/)：编辑器内核
- [markdown-it](https://github.com/markdown-it/markdown-it)：Markdown 解析
- [highlight.js](https://highlightjs.org/)：代码语法高亮
- [KaTeX](https://katex.org/)：数学公式渲染
- [Vite](https://vite.dev/)：前端开发与构建

## 开发环境

开始前请安装：

- Node.js `20.19+` 或 `22.12+`
- Rust `1.77.2+`
- 当前系统所需的 [Tauri 前置依赖](https://v2.tauri.app/start/prerequisites/)

安装项目依赖：

```bash
npm install
```

启动完整桌面应用：

```bash
npm run tauri dev
```

只启动前端开发服务器：

```bash
npm run dev
```

> 文件对话框、本地文件读写和文件树依赖 Tauri API，在普通浏览器页面中不可用。开发这些功能时请使用 `npm run tauri dev`。

## 构建

构建桌面安装包：

```bash
npm run tauri build
```

只构建前端资源：

```bash
npm run build
```

检查 Rust 桌面端代码：

```bash
cd src-tauri
cargo check
```

## 项目结构

```text
src/
├─ components/       Vue 界面组件
├─ composables/      编辑器、主题和文件操作逻辑
├─ stores/           Pinia 状态管理
├─ styles/           全局主题与编辑器样式
└─ utils/            Markdown、公式、装饰器与虚拟滚动

src-tauri/
├─ capabilities/     Tauri 权限配置
└─ src/              Rust 桌面端入口与文件树扫描
```

## 文件访问说明

FluentMD 只会在用户通过系统文件对话框打开文件后访问该文件。文件树仅扫描当前文件所在目录中的 Markdown 文件，跳过符号链接、隐藏目录和常见构建目录，并只为扫描到的 Markdown 文件授予读取权限。

## 当前状态

项目仍在持续迭代中。提交问题时，请附上操作系统、复现步骤、使用的编辑模式，以及相关 Markdown 示例。
