/**
 * 头像缓存工具模块
 * @description 提供头像本地缓存功能，使用 node-nim SDK 下载头像到本地
 */
import { getContextState } from "./init";
import { createHash } from "crypto";
import * as path from "path";

/**
 * 正在进行中的下载请求映射
 * 用于并发请求去重
 */
const pendingDownloads = new Map<string, Promise<string>>();

/**
 * 内存缓存：URL -> 本地路径
 * 避免重复的 IPC 调用
 */
const memoryCache = new Map<string, string>();

/**
 * 缓存目录路径（懒加载）
 */
let cacheDir: string | null = null;

/**
 * 缓存目录名称
 */
const AVATAR_CACHE_DIR_NAME = "avatar-cache";

/**
 * 获取缓存目录路径
 * @description 使用 fs 模块获取 userData 目录，然后拼接 avatar-cache 子目录
 */
async function getCacheDir(): Promise<string> {
  if (!cacheDir) {
    const userDataPath = await window.electronAPI.fs.getAppPath("userData");
    cacheDir = path.join(userDataPath, AVATAR_CACHE_DIR_NAME);
    // 确保目录存在
    await window.electronAPI.fs.ensureDir(cacheDir);
  }
  return cacheDir;
}

/**
 * 将 URL 转换为缓存文件名
 * @param url 头像 URL
 * @returns 缓存文件名（MD5 哈希值）
 */
export function urlToFileName(url: string): string {
  return createHash("md5").update(url).digest("hex");
}

/**
 * 获取缓存的头像 URL
 * @description 检查本地缓存，如果不存在则下载
 * @param url 原始头像 URL
 * @returns 本地文件的 local-file:// URL，失败返回 null
 */
export async function getCachedAvatarUrl(url: string): Promise<string | null> {
  if (!url) return null;

  // 检查内存缓存
  const cached = memoryCache.get(url);
  if (cached) {
    return window.electronAPI.fs.toLocalFileUrl(cached);
  }

  // 检查是否有正在进行的下载
  const pending = pendingDownloads.get(url);
  if (pending) {
    try {
      const localPath = await pending;
      return window.electronAPI.fs.toLocalFileUrl(localPath);
    } catch {
      return null;
    }
  }

  // 创建下载任务
  const downloadTask = downloadAndCache(url);
  pendingDownloads.set(url, downloadTask);

  try {
    const localPath = await downloadTask;
    memoryCache.set(url, localPath);
    return window.electronAPI.fs.toLocalFileUrl(localPath);
  } catch (error) {
    console.error("[AvatarCache] 获取缓存头像失败:", error);
    return null;
  } finally {
    pendingDownloads.delete(url);
  }
}

/**
 * 下载头像并缓存到本地
 * @param url 头像 URL
 * @returns 本地文件路径
 */
async function downloadAndCache(url: string): Promise<string> {
  const fileName = urlToFileName(url);

  // 获取缓存目录
  const dir = await getCacheDir();
  const filePath = path.join(dir, fileName);

  // 检查文件是否已存在
  const fileExists = await window.electronAPI.fs.exists(filePath);
  if (fileExists) {
    return filePath;
  }

  // 使用 SDK 下载
  const { nim } = getContextState();
  if (!nim) {
    throw new Error("NIM 实例未初始化");
  }

  const localPath = await nim.storageService?.downloadFile(
    url,
    filePath,
    () => {} // 进度回调（头像较小，不需要显示进度）
  );

  if (!localPath) {
    throw new Error("下载失败");
  }

  return localPath;
}

/**
 * 清除内存缓存
 * @description 用于登出或切换账号时清理缓存
 */
export function clearAvatarMemoryCache(): void {
  memoryCache.clear();
  cacheDir = null;
}
