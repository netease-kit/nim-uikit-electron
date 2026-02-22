/**
 * 文件系统 IPC 处理器
 * @description 处理文件系统相关的 IPC 通信
 */
import { ipcMain } from "electron";
import * as fsService from "./fs.service";
import type { AppPathName } from "./fs.types";
import { showOpenDialogHandler, chooseFileHandler, saveClipboardFileHandler } from "./fs.dialog";

/**
 * 注册文件系统相关的 IPC 处理器
 */
export function registerFsHandlers(): void {
  // 获取系统目录路径
  ipcMain.handle("fs:get-app-path", (_, { name }: { name: AppPathName }) => {
    return fsService.getAppPath(name);
  });

  // 确保目录存在
  ipcMain.handle("fs:ensure-dir", async (_, { dirPath }: { dirPath: string }) => {
    await fsService.ensureDir(dirPath);
  });

  // 读取目录内容
  ipcMain.handle("fs:read-dir", async (_, { dirPath }: { dirPath: string }) => {
    return fsService.readDir(dirPath);
  });

  // 检查文件/目录是否存在
  ipcMain.handle("fs:exists", (_, { path }: { path: string }) => {
    return fsService.exists(path);
  });

  // 获取文件状态
  ipcMain.handle("fs:stat", async (_, { path }: { path: string }) => {
    return fsService.stat(path);
  });

  // 读取文本文件
  ipcMain.handle(
    "fs:read-text-file",
    async (_, { path, encoding }: { path: string; encoding?: string }) => {
      return fsService.readTextFile(path, encoding as BufferEncoding);
    }
  );

  // 写入文件
  ipcMain.handle(
    "fs:write-file",
    async (_, { path, content }: { path: string; content: string }) => {
      await fsService.writeFile(path, content);
    }
  );

  // 删除文件
  ipcMain.handle("fs:delete-file", async (_, { path }: { path: string }) => {
    return fsService.deleteFile(path);
  });

  // ============ 临时文件操作 ============
  // 写入临时文件
  ipcMain.handle(
    "fs:write-temp-file",
    async (_, { content, fileName }: { content: string; fileName: string }) => {
      return fsService.writeTempFile(content, fileName);
    }
  );

  // 删除临时文件
  ipcMain.handle("fs:delete-temp-file", async (_, { filePath }: { filePath: string }) => {
    return fsService.deleteTempFile(filePath);
  });

  // ============ 文件选择对话框 ============
  // 显示打开文件对话框
  ipcMain.handle("fs:show-open-dialog", showOpenDialogHandler);

  // 选择文件（图片/视频/普通文件）
  ipcMain.handle("fs:choose-file", chooseFileHandler);

  // 保存剪贴板文件
  ipcMain.handle("fs:save-clipboard-file", saveClipboardFileHandler);

  console.log("[FsHandler] IPC handlers registered");
}
