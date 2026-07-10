use serde::Serialize;
use std::{fs, path::{Path, PathBuf}};
use tauri_plugin_fs::FsExt;

const MAX_WORKSPACE_DEPTH: usize = 8;
const MAX_WORKSPACE_ENTRIES: usize = 800;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceNode {
  #[serde(rename = "type")]
  node_type: String,
  name: String,
  path: String,
  #[serde(skip_serializing_if = "Vec::is_empty")]
  children: Vec<WorkspaceNode>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MarkdownWorkspace {
  root_path: String,
  nodes: Vec<WorkspaceNode>,
  truncated: bool,
}

fn is_markdown_file(path: &Path) -> bool {
  path.extension()
    .and_then(|extension| extension.to_str())
    .map(|extension| matches!(extension.to_ascii_lowercase().as_str(), "md" | "markdown"))
    .unwrap_or(false)
}

fn should_skip_directory(name: &str) -> bool {
  name.starts_with('.') || matches!(
    name,
    "node_modules" | "target" | "dist" | "build" | ".cache"
  )
}

fn scan_markdown_directory(
  path: &Path,
  depth: usize,
  scope: &tauri::fs::Scope,
  entries_seen: &mut usize,
  truncated: &mut bool,
) -> Vec<WorkspaceNode> {
  if depth > MAX_WORKSPACE_DEPTH || *entries_seen >= MAX_WORKSPACE_ENTRIES {
    *truncated = true;
    return Vec::new();
  }

  let Ok(entries) = fs::read_dir(path) else {
    return Vec::new();
  };
  let mut nodes = Vec::new();

  for entry in entries.flatten() {
    if *entries_seen >= MAX_WORKSPACE_ENTRIES {
      *truncated = true;
      break;
    }

    let entry_path = entry.path();
    let name = entry.file_name().to_string_lossy().into_owned();
    let Ok(file_type) = entry.file_type() else {
      continue;
    };

    if file_type.is_symlink() {
      continue;
    }

    if file_type.is_file() && is_markdown_file(&entry_path) {
      *entries_seen += 1;
      if scope.allow_file(&entry_path).is_ok() {
        nodes.push(WorkspaceNode {
          node_type: "file".into(),
          name,
          path: entry_path.to_string_lossy().into_owned(),
          children: Vec::new(),
        });
      }
    } else if file_type.is_dir() && !should_skip_directory(&name) {
      *entries_seen += 1;
      let children = scan_markdown_directory(
        &entry_path,
        depth + 1,
        scope,
        entries_seen,
        truncated,
      );
      if !children.is_empty() {
        nodes.push(WorkspaceNode {
          node_type: "directory".into(),
          name,
          path: entry_path.to_string_lossy().into_owned(),
          children,
        });
      }
    }
  }

  nodes.sort_by(|left, right| {
    let left_directory = left.node_type == "directory";
    let right_directory = right.node_type == "directory";
    right_directory
      .cmp(&left_directory)
      .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
  });
  nodes
}

#[tauri::command]
fn authorize_markdown_workspace(window: tauri::Window, file_path: String) -> Result<MarkdownWorkspace, String> {
  let file = PathBuf::from(file_path);
  let scope = window.fs_scope();

  // The file picker (or a previously authorized workspace) must have granted
  // the current file before its parent directory can become the workspace.
  if !scope.is_allowed(&file) {
    return Err("当前文件不在已授权的访问范围内".into());
  }

  let parent = file
    .parent()
    .ok_or_else(|| "无法确定当前文件所在目录".to_string())?
    .canonicalize()
    .map_err(|err| format!("无法读取当前文件所在目录：{err}"))?;

  let mut entries_seen = 0;
  let mut truncated = false;
  let nodes = scan_markdown_directory(
    &parent,
    0,
    &scope,
    &mut entries_seen,
    &mut truncated,
  );

  Ok(MarkdownWorkspace {
    root_path: parent.to_string_lossy().into_owned(),
    nodes,
    truncated,
  })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![authorize_markdown_workspace])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
