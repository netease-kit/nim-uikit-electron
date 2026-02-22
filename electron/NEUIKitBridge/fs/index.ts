/**
 * 文件系统模块入口
 * @description 导出文件系统相关的 API 和处理器
 */

// Preload API（渲染进程）
export { createFsAPI, type FsAPI, type AppPathName, type FileStat } from "./fs.api";

// 类型导出
export type {
  OpenDialogOptions,
  ChooseFileOptions,
  ChooseFileResult,
  SaveClipboardFileOptions,
  FileType,
} from "./fs.types";

// IPC 处理器（主进程）
export { registerFsHandlers } from "./fs.handler";

// 协议相关（主进程）
export {
  registerLocalFileProtocol,
  initLocalFileProtocol,
  toLocalFileUrl,
  fromLocalFileUrl,
  LOCAL_FILE_PROTOCOL,
} from "./fs.protocol";

// 服务层（主进程）
export * as fsService from "./fs.service";
