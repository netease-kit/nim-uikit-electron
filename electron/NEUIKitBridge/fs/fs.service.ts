/**
 * 文件系统服务模块
 * @description 提供文件系统操作的核心实现（主进程）
 */
import { app } from "electron";
import * as fs from "node:fs";
import * as nodePath from "node:path";
import type { AppPathName, FileStat } from "./fs.types";

/** 允许写入和删除的目录路径缓存 */
let allowedWritePaths: string[] | null = null;

/**
 * 获取允许写入/删除的目录列表
 */
function getAllowedWritePaths(): string[] {
  if (!allowedWritePaths) {
    allowedWritePaths = [app.getPath("temp"), app.getPath("userData")];
  }
  return allowedWritePaths;
}

/**
 * 检查路径是否在允许写入的目录内
 * @param targetPath 目标路径
 * @returns 是否允许写入
 */
function isPathAllowedForWrite(targetPath: string): boolean {
  const normalizedPath = nodePath.normalize(targetPath);
  const allowedPaths = getAllowedWritePaths();

  return allowedPaths.some((allowedPath) => {
    const normalizedAllowed = nodePath.normalize(allowedPath);
    return (
      normalizedPath.startsWith(normalizedAllowed + nodePath.sep) ||
      normalizedPath === normalizedAllowed
    );
  });
}

/**
 * 获取系统标准目录路径
 * @param name 目录名称
 * @returns 目录绝对路径
 */
export function getAppPath(name: AppPathName): string {
  return app.getPath(name);
}

/**
 * 确保目录存在（如不存在则递归创建）
 * @param dirPath 目录路径
 */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.promises.access(dirPath);
  } catch {
    await fs.promises.mkdir(dirPath, { recursive: true });
  }
}

/**
 * 读取目录内容
 * @param dirPath 目录路径
 * @returns 目录中的文件名数组
 */
export async function readDir(dirPath: string): Promise<string[]> {
  return fs.promises.readdir(dirPath);
}

/**
 * 检查文件或目录是否存在
 * @param path 文件路径
 * @returns 是否存在
 */
export function exists(path: string): boolean {
  try {
    return fs.existsSync(path);
  } catch {
    return false;
  }
}

/**
 * 获取文件状态信息
 * @param path 文件路径
 * @returns 文件状态，不存在返回 null
 */
export async function stat(path: string): Promise<FileStat | null> {
  try {
    const stats = await fs.promises.stat(path);
    return {
      size: stats.size,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      mtime: stats.mtime.getTime(),
      ctime: stats.ctime.getTime(),
    };
  } catch {
    return null;
  }
}

/**
 * 读取文本文件
 * @param path 文件路径
 * @param encoding 编码，默认 utf-8
 * @returns 文件文本内容
 */
export async function readTextFile(
  path: string,
  encoding: BufferEncoding = "utf-8"
): Promise<string> {
  return fs.promises.readFile(path, { encoding });
}

/**
 * 写入文件
 * @param path 文件路径
 * @param content 文件内容
 * @throws 如果路径不在允许的目录内
 */
export async function writeFile(path: string, content: string): Promise<void> {
  if (!isPathAllowedForWrite(path)) {
    throw new Error(
      `Access denied: Cannot write to path outside of allowed directories (temp, userData). Path: ${path}`
    );
  }

  // 确保父目录存在
  const parentDir = nodePath.dirname(path);
  await ensureDir(parentDir);

  await fs.promises.writeFile(path, content, "utf-8");
}

/**
 * 删除文件
 * @param path 文件路径
 * @returns 是否删除成功
 */
export async function deleteFile(path: string): Promise<boolean> {
  if (!isPathAllowedForWrite(path)) {
    console.error(
      `[FsService] Access denied: Cannot delete path outside of allowed directories. Path: ${path}`
    );
    return false;
  }

  try {
    await fs.promises.unlink(path);
    return true;
  } catch (error) {
    console.error("[FsService] Failed to delete file:", path, error);
    return false;
  }
}

/**
 * 写入临时文件
 * @param content 文件内容
 * @param fileName 文件名
 * @returns 写入后的完整文件路径
 */
export async function writeTempFile(content: string, fileName: string): Promise<string> {
  const tempDir = app.getPath("temp");
  const filePath = nodePath.join(tempDir, fileName);

  await fs.promises.writeFile(filePath, content, "utf-8");

  return filePath;
}

/**
 * 删除临时文件
 * @param filePath 文件路径
 * @returns 是否删除成功
 */
export async function deleteTempFile(filePath: string): Promise<boolean> {
  return deleteFile(filePath);
}
