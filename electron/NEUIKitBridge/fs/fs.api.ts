/**
 * 文件系统 Preload API
 * @description 暴露给渲染进程的文件系统相关 API
 */
import { ipcRenderer } from "electron";
import type {
  AppPathName,
  FileStat,
  FsAPI,
  OpenDialogOptions,
  ChooseFileOptions,
  ChooseFileResult,
  SaveClipboardFileOptions,
} from "./fs.types";

/**
 * 本地文件协议名称
 */
const LOCAL_FILE_PROTOCOL = "local-file";

/**
 * 将本地文件路径转换为 local-file:// 协议 URL
 * @description 纯函数，无需 IPC 调用
 * @param filePath 本地文件路径
 * @returns local-file:// 协议 URL
 */
function toLocalFileUrl(filePath: string): string {
  if (!filePath) return "";

  // 如果已经是 URL（http/https/blob/data），直接返回
  if (/^(https?|blob|data):/.test(filePath)) {
    return filePath;
  }

  // 如果已经是自定义协议 URL，直接返回
  if (filePath.startsWith(`${LOCAL_FILE_PROTOCOL}:`)) {
    return filePath;
  }

  // 标准化路径分隔符
  const normalizedPath = filePath.replace(/\\/g, "/");

  // 确保路径以 / 开头
  const urlPath = normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`;

  // 使用 localhost 作为主机名，避免路径被当作主机名处理（主机名会被转为小写）
  return `${LOCAL_FILE_PROTOCOL}://localhost${urlPath}`;
}

/**
 * 从 local-file:// 协议 URL 提取本地文件路径
 * @description 纯函数，无需 IPC 调用
 * @param url local-file:// 协议 URL
 * @returns 本地文件路径
 */
function fromLocalFileUrl(url: string): string {
  if (!url) return "";

  try {
    const urlObj = new URL(url);
    let filePath = decodeURIComponent(urlObj.pathname);

    // Windows 路径处理：移除开头的 / (如 /C:/...)
    if (/^\/[A-Za-z]:/.test(filePath)) {
      filePath = filePath.slice(1);
    }

    return filePath;
  } catch {
    // URL 解析失败时的后备方案
    const protocolSeparator = "://";
    const separatorIndex = url.indexOf(protocolSeparator);

    if (separatorIndex === -1) return url;

    let filePath = url.slice(separatorIndex + protocolSeparator.length);

    // 移除 localhost 主机名
    if (filePath.startsWith("localhost/")) {
      filePath = filePath.slice("localhost".length);
    } else if (filePath.startsWith("localhost")) {
      filePath = filePath.slice("localhost".length);
    }

    filePath = decodeURIComponent(filePath);

    // Windows 路径处理
    if (/^\/[A-Za-z]:/.test(filePath)) {
      filePath = filePath.slice(1);
    }

    return filePath;
  }
}

/**
 * 创建文件系统相关的 Preload API
 */
export function createFsAPI(): FsAPI {
  return {
    // ============ 目录操作 ============
    getAppPath: (name: AppPathName): Promise<string> => {
      return ipcRenderer.invoke("fs:get-app-path", { name });
    },

    ensureDir: (dirPath: string): Promise<void> => {
      return ipcRenderer.invoke("fs:ensure-dir", { dirPath });
    },

    readDir: (dirPath: string): Promise<string[]> => {
      return ipcRenderer.invoke("fs:read-dir", { dirPath });
    },

    // ============ 文件操作 ============
    exists: (path: string): Promise<boolean> => {
      return ipcRenderer.invoke("fs:exists", { path });
    },

    stat: (path: string): Promise<FileStat | null> => {
      return ipcRenderer.invoke("fs:stat", { path });
    },

    readTextFile: (path: string, encoding?: string): Promise<string> => {
      return ipcRenderer.invoke("fs:read-text-file", { path, encoding });
    },

    writeFile: (path: string, content: string): Promise<void> => {
      return ipcRenderer.invoke("fs:write-file", { path, content });
    },

    deleteFile: (path: string): Promise<boolean> => {
      return ipcRenderer.invoke("fs:delete-file", { path });
    },

    // ============ 临时文件操作 ============
    writeTempFile: (content: string, fileName: string): Promise<string> => {
      return ipcRenderer.invoke("fs:write-temp-file", { content, fileName });
    },

    deleteTempFile: (filePath: string): Promise<boolean> => {
      return ipcRenderer.invoke("fs:delete-temp-file", { filePath });
    },

    // ============ 协议转换（纯函数，无需 IPC） ============
    toLocalFileUrl,
    fromLocalFileUrl,

    // ============ 文件选择对话框 ============
    showOpenDialog: async (options?: OpenDialogOptions): Promise<string | undefined> => {
      const result = await ipcRenderer.invoke("fs:show-open-dialog", {
        ...options,
        properties: ["openFile"],
      });
      return result?.[0];
    },

    showOpenDialogMultiple: async (options?: OpenDialogOptions): Promise<string[]> => {
      const result = await ipcRenderer.invoke("fs:show-open-dialog", {
        ...options,
        properties: ["openFile", "multiSelections"],
      });
      return result || [];
    },

    chooseFile: (options: ChooseFileOptions): Promise<ChooseFileResult | undefined> => {
      return ipcRenderer.invoke("fs:choose-file", options);
    },

    saveClipboardFile: (
      options: SaveClipboardFileOptions
    ): Promise<ChooseFileResult | undefined> => {
      return ipcRenderer.invoke("fs:save-clipboard-file", options);
    },
  };
}

// 导出类型供外部使用
export type { AppPathName, FileStat, FsAPI } from "./fs.types";
