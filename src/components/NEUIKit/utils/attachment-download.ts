/**
 * 附件下载管理工具
 * @description 提供消息附件的下载和本地缓存管理功能
 */
import { getContextState } from "./init";
import type {
  V2NIMMessageAttachment,
  V2NIMMessageImageAttachment,
  V2NIMMessageVideoAttachment,
  V2NIMMessageAudioAttachment,
  V2NIMMessageFileAttachment,
} from "node-nim/types/v2_def/v2_nim_struct_def";

/**
 * 将本地文件路径转换为可在渲染进程中使用的 URL
 * @description 使用 fs 模块提供的协议转换函数
 * @param filePath 本地文件绝对路径
 * @returns 自定义协议 URL，可直接用于 img/video/audio 标签的 src 属性
 *
 * @example
 * toLocalFileUrl('/Users/xxx/file.jpg')
 * // => 'local-file://localhost/Users/xxx/file.jpg'
 */
export function toLocalFileUrl(filePath: string): string {
  return window.electronAPI.fs.toLocalFileUrl(filePath);
}

/**
 * 判断是否为本地文件路径
 * @param urlOrPath URL 或文件路径
 * @returns 是否为本地文件路径
 */
export function isLocalFilePath(urlOrPath: string): boolean {
  if (!urlOrPath) return false;

  // 排除常见的 URL 协议
  if (/^(https?|blob|data|local-file):/.test(urlOrPath)) {
    return false;
  }

  // Windows 路径 (如 C:\...) 或 Unix 路径 (如 /...)
  return /^([A-Za-z]:[/\\]|\/|\\\\)/.test(urlOrPath);
}

/**
 * 下载附件类型枚举
 * @see V2NIMDownloadAttachmentType
 */
export const DownloadAttachmentType = {
  /** 原始资源 */
  SOURCE: 0,
  /** 图片缩略图 */
  THUMBNAIL: 1,
  /** 视频封面 */
  VIDEO_COVER: 2,
} as const;

export type DownloadAttachmentTypeValue =
  (typeof DownloadAttachmentType)[keyof typeof DownloadAttachmentType];

/**
 * 进度回调类型
 */
export type ProgressCallback = (progress: number) => void;

/**
 * 下载结果接口
 */
export interface DownloadResult {
  /** 是否成功 */
  success: boolean;
  /** 本地文件路径（成功时返回） */
  localPath?: string;
  /** 错误信息（失败时返回） */
  error?: string;
}

/**
 * 检查本地文件是否存在
 * @param filePath 文件路径
 * @returns 是否存在
 */
export async function checkLocalFileExists(filePath: string): Promise<boolean> {
  if (!filePath) return false;
  try {
    return await window.electronAPI.fs.exists(filePath);
  } catch {
    return false;
  }
}

/**
 * 下载附件通用方法
 * @param attachment 附件对象
 * @param type 下载类型（源文件/缩略图/视频封面）
 * @param messageClientId 消息客户端ID（用于自动填充本地路径）
 * @param onProgress 进度回调
 * @param thumbSize 缩略图尺寸，仅在下载缩略图或视频封面时生效，默认 { width: 320, height: 180 }
 * @returns 下载结果
 */
export async function downloadAttachment(
  attachment: V2NIMMessageAttachment,
  type: DownloadAttachmentTypeValue,
  messageClientId?: string,
  onProgress?: ProgressCallback,
  thumbSize?: { width: number; height: number }
): Promise<DownloadResult> {
  const { nim } = getContextState();

  if (!nim) {
    return { success: false, error: "NIM 实例未初始化" };
  }

  try {
    const needsThumbSize =
      type === DownloadAttachmentType.THUMBNAIL || type === DownloadAttachmentType.VIDEO_COVER;

    const downloadParam = {
      attachment,
      type,
      messageClientId,
      ...(needsThumbSize ? { thumbSize: thumbSize ?? { width: 640, height: 480 } } : {}),
    };

    const progressCallback = onProgress ? (progress: number) => onProgress(progress) : () => {};

    const localPath = await nim.storageService?.downloadAttachment(downloadParam, progressCallback);

    return { success: true, localPath };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[AttachmentDownload] 下载失败:", error);
    return { success: false, error };
  }
}

/**
 * 下载图片缩略图
 * @param attachment 图片附件
 * @param messageClientId 消息客户端ID
 * @returns 下载结果
 */
export async function downloadImageThumbnail(
  attachment: V2NIMMessageImageAttachment,
  messageClientId?: string
): Promise<DownloadResult> {
  return downloadAttachment(attachment, DownloadAttachmentType.THUMBNAIL, messageClientId);
}

/**
 * 下载图片源文件
 * @param attachment 图片附件
 * @param messageClientId 消息客户端ID
 * @param onProgress 进度回调
 * @returns 下载结果
 */
export async function downloadImageSource(
  attachment: V2NIMMessageImageAttachment,
  messageClientId?: string,
  onProgress?: ProgressCallback
): Promise<DownloadResult> {
  return downloadAttachment(attachment, DownloadAttachmentType.SOURCE, messageClientId, onProgress);
}

/**
 * 下载视频封面
 * @param attachment 视频附件
 * @param messageClientId 消息客户端ID
 * @returns 下载结果
 */
export async function downloadVideoCover(
  attachment: V2NIMMessageVideoAttachment,
  messageClientId?: string
): Promise<DownloadResult> {
  return downloadAttachment(attachment, DownloadAttachmentType.VIDEO_COVER, messageClientId);
}

/**
 * 下载视频源文件
 * @param attachment 视频附件
 * @param messageClientId 消息客户端ID
 * @param onProgress 进度回调
 * @returns 下载结果
 */
export async function downloadVideoSource(
  attachment: V2NIMMessageVideoAttachment,
  messageClientId?: string,
  onProgress?: ProgressCallback
): Promise<DownloadResult> {
  return downloadAttachment(attachment, DownloadAttachmentType.SOURCE, messageClientId, onProgress);
}

/**
 * 下载音频源文件
 * @param attachment 音频附件
 * @param messageClientId 消息客户端ID
 * @param onProgress 进度回调
 * @returns 下载结果
 */
export async function downloadAudioSource(
  attachment: V2NIMMessageAudioAttachment,
  messageClientId?: string,
  onProgress?: ProgressCallback
): Promise<DownloadResult> {
  return downloadAttachment(attachment, DownloadAttachmentType.SOURCE, messageClientId, onProgress);
}

/**
 * 下载文件源文件
 * @param attachment 文件附件
 * @param messageClientId 消息客户端ID
 * @param onProgress 进度回调
 * @returns 下载结果
 */
export async function downloadFileSource(
  attachment: V2NIMMessageFileAttachment,
  messageClientId?: string,
  onProgress?: ProgressCallback
): Promise<DownloadResult> {
  return downloadAttachment(attachment, DownloadAttachmentType.SOURCE, messageClientId, onProgress);
}

/**
 * 获取附件本地路径或远程URL
 * @description 优先返回本地路径，如果本地文件不存在则返回远程URL
 * @param attachment 附件对象
 * @returns 本地路径或远程URL
 */
export async function getAttachmentUrl(
  attachment:
    | V2NIMMessageFileAttachment
    | V2NIMMessageImageAttachment
    | V2NIMMessageVideoAttachment
    | V2NIMMessageAudioAttachment
): Promise<string> {
  // 如果有本地路径，检查文件是否存在
  if (attachment.path) {
    const exists = await checkLocalFileExists(attachment.path);
    if (exists) {
      return attachment.path;
    }
  }

  // 返回远程URL
  return attachment.url || "";
}
