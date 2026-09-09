# FluentMD Windows 打包流程

本文档记录 FluentMD 已验证可用的 Windows 开发与发布打包流程。

## 1. 准备环境

- Node.js `20.19+` 或 `22.12+`
- Rust `1.77.2+`
- Windows WebView2 和 Tauri 所需的系统构建依赖
- 安装项目依赖：`npm install`

## 2. 启动开发环境

```bash
npm run tauri dev
```

`src-tauri/tauri.conf.json` 已配置 `beforeDevCommand`，该命令会自动启动 Vite。不要同时在另一个终端运行 `npm run dev`，否则会出现 `Port 5173 is already in use`。

如果只需要调试前端界面，可以运行：

```bash
npm run dev
```

浏览器模式无法使用文件对话框、本地文件读写和文件树等 Tauri 功能。

## 3. 升级版本

发布新版本前，确保以下位置的应用版本完全一致：

- `package.json`
- `package-lock.json` 的根版本及 `packages[""]` 版本
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock` 中名为 `fluentmd` 的包版本
- `src-tauri/tauri.conf.json`

只重命名生成的 EXE 不会更新内部产品版本，必须先修改上述版本再重新构建。

## 4. 构建前验证

```bash
npm test
```

需要单独检查 Rust 时：

```bash
cd src-tauri
cargo check
cd ..
```

## 5. 正式打包

在项目根目录运行：

```bash
npm run tauri build
```

Tauri 会通过 `beforeBuildCommand` 自动执行 `npm run build`，不需要提前单独构建前端。首次构建可能需要下载 WiX 工具，并且会比后续构建耗时更长。

## 6. 构建产物

```text
src-tauri/target/release/fluentmd.exe
src-tauri/target/release/bundle/nsis/fluentmd_<version>_x64-setup.exe
src-tauri/target/release/bundle/msi/fluentmd_<version>_x64_en-US.msi
```

- `fluentmd.exe`：免安装主程序。
- `fluentmd_<version>_x64-setup.exe`：NSIS 安装版，建议作为 GitHub Release 的主要下载文件。
- `fluentmd_<version>_x64_en-US.msi`：MSI 安装包。

## 7. 核对产物

在 PowerShell 中检查 EXE 内部版本和 SHA-256：

```powershell
(Get-Item .\src-tauri\target\release\fluentmd.exe).VersionInfo.ProductVersion
Get-FileHash .\src-tauri\target\release\fluentmd.exe -Algorithm SHA256
Get-FileHash .\src-tauri\target\release\bundle\nsis\fluentmd_<version>_x64-setup.exe -Algorithm SHA256
```

确认内部版本、文件名和准备发布的 Git 标签一致。

## 8. 发布到 GitHub

1. 提交版本修改并推送源码。
2. 创建 `v<version>` 标签对应的 GitHub Release。
3. 上传 NSIS 安装版 EXE。
4. 按需附加免安装 EXE 和 MSI 安装包。

`dist` 和 `src-tauri/target` 是构建产物，不通过普通 Git 提交发布。
