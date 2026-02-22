/**
 * 文件系统模块类型定义
 * @description 定义文件系统 IPC 模块的类型
 */

/**
 * Electron app.getPath() 支持的路径名称
 * @see https://www.electronjs.org/docs/latest/api/app#appgetpathname
 */
export type AppPathName =
  | "home"
  | "appData"
  | "userData"
  | "temp"
  | "exe"
  | "module"
  | "desktop"
  | "documents"
  | "downloads"
  | "music"
  | "pictures"
  | "videos"
  | "logs";

/**
 * 文件状态信息
 */
export interface FileStat {
  /** 文件大小（字节） */
  size: number;
  /** 是否为文件 */
  isFile: boolean;
  /** 是否为目录 */
  isDirectory: boolean;
  /** 最后修改时间（毫秒时间戳） */
  mtime: number;
  /** 创建时间（毫秒时间戳） */
  ctime: number;
}

/**
 * 文件系统 API 接口定义
 * @description 暴露给渲染进程的文件系统 API
 */
export interface FsAPI {
  // ============ 目录操作 ============
  /**
   * 获取系统标准目录路径
   * @param name 目录名称
   * @returns 目录绝对路径
   */
  getAppPath: (name: AppPathName) => Promise<string>;

  /**
   * 确保目录存在（如不存在则递归创建）
   * @param dirPath 目录路径
   */
  ensureDir: (dirPath: string) => Promise<void>;

  /**
   * 读取目录内容
   * @param dirPath 目录路径
   * @returns 目录中的文件名数组
   */
  readDir: (dirPath: string) => Promise<string[]>;

  // ============ 文件操作 ============
  /**
   * 检查文件或目录是否存在
   * @param path 文件路径
   * @returns 是否存在
   */
  exists: (path: string) => Promise<boolean>;

  /**
   * 获取文件状态信息
   * @param path 文件路径
   * @returns 文件状态，不存在返回 null
   */
  stat: (path: string) => Promise<FileStat | null>;

  /**
   * 读取文本文件
   * @param path 文件路径
   * @param encoding 编码，默认 utf-8
   * @returns 文件文本内容
   */
  readTextFile: (path: string, encoding?: string) => Promise<string>;

  /**
   * 写入文件
   * @param path 文件路径（仅支持 temp 或 userData 目录）
   * @param content 文件内容
   */
  writeFile: (path: string, content: string) => Promise<void>;

  /**
   * 删除文件
   * @param path 文件路径（仅支持 temp 或 userData 目录）
   * @returns 是否删除成功
   */
  deleteFile: (path: string) => Promise<boolean>;

  // ============ 临时文件操作 ============
  /**
   * 写入临时文件
   * @param content 文件内容
   * @param fileName 文件名
   * @returns 写入后的完整文件路径
   */
  writeTempFile: (content: string, fileName: string) => Promise<string>;

  /**
   * 删除临时文件
   * @param filePath 文件路径
   * @returns 是否删除成功
   */
  deleteTempFile: (filePath: string) => Promise<boolean>;

  // ============ 协议转换 ============
  /**
   * 将本地文件路径转换为 local-file:// 协议 URL
   * @param filePath 本地文件路径
   * @returns local-file:// 协议 URL
   */
  toLocalFileUrl: (filePath: string) => string;

  /**
   * 从 local-file:// 协议 URL 提取本地文件路径
   * @param url local-file:// 协议 URL
   * @returns 本地文件路径
   */
  fromLocalFileUrl: (url: string) => string;

  // ============ 文件选择对话框 ============
  /**
   * 显示打开文件对话框（单选）
   * @param options 对话框选项
   * @returns 选中的文件路径，取消则返回 undefined
   */
  showOpenDialog: (options?: OpenDialogOptions) => Promise<string | undefined>;

  /**
   * 显示打开文件对话框（多选）
   * @param options 对话框选项
   * @returns 选中的文件路径数组，取消返回空数组
   */
  showOpenDialogMultiple: (options?: OpenDialogOptions) => Promise<string[]>;

  /**
   * 选择文件并返回完整的文件信息
   * @param options 选择选项
   * @returns 文件信息，取消则返回 undefined
   */
  chooseFile: (options: ChooseFileOptions) => Promise<ChooseFileResult | undefined>;

  /**
   * 保存剪贴板文件到临时目录并返回文件信息
   * @param options 保存选项
   * @returns 文件信息，失败则返回 undefined
   */
  saveClipboardFile: (options: SaveClipboardFileOptions) => Promise<ChooseFileResult | undefined>;
}

// ============ 文件选择相关类型 ============

/**
 * 打开文件对话框选项
 */
export interface OpenDialogOptions {
  /** 对话框标题 */
  title?: string;
  /** 文件类型过滤器 */
  filters?: Array<{ name: string; extensions: string[] }>;
  /** 对话框属性 */
  properties?: Array<"openFile" | "openDirectory" | "multiSelections">;
}

/**
 * 文件类型
 */
export type FileType = "file" | "image" | "video";

/**
 * 选择文件选项
 */
export interface ChooseFileOptions {
  /** 文件类型 */
  type: FileType;
  /** 允许的文件扩展名 */
  extensions?: string[];
  /** 对话框标题 */
  title?: string;
}

/**
 * 保存剪贴板文件选项
 */
export interface SaveClipboardFileOptions {
  /** 文件二进制数据（数组形式） */
  buffer: number[];
  /** MIME 类型 */
  mimeType: string;
  /** 可选的文件名 */
  fileName?: string;
}

/**
 * 文件选择结果
 */
export interface ChooseFileResult {
  /** 文件类型 */
  type: FileType;
  /** 文件信息 */
  file: {
    /** 文件完整路径 */
    url: string;
    /** 文件名 */
    name: string;
    /** 文件大小（字节） */
    size: number;
    /** 图片/视频预览图 base64（可选） */
    base64?: string;
    /** 图片/视频宽度（可选） */
    width?: number;
    /** 图片/视频高度（可选） */
    height?: number;
    /** 视频时长，单位秒（可选） */
    duration?: number;
  };
}
