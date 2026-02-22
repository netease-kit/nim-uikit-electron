/**
 * ============================================================================
 * 统一存储模块 - 主进程服务
 * ============================================================================
 *
 * 在主进程中处理所有存储操作，支持：
 * - 基础键值存储 (替换 localStorage)
 * - 登录信息存储 (特殊处理)
 */

import { ipcMain, app } from "electron";
import * as fs from "fs";
import * as path from "path";
import { LoginInfo } from "../preload/storage";

/**
 * 存储文件路径
 */
const STORAGE_DIR = path.join(app.getPath("userData"), "app-storage");
const GENERAL_STORAGE_FILE = path.join(STORAGE_DIR, "general.json");
const LOGIN_INFO_FILE = path.join(STORAGE_DIR, "login-info.json");

/**
 * 确保存储目录存在
 */
function ensureStorageDir(): void {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
    console.log("[Storage] 存储目录已创建:", STORAGE_DIR);
  }
}

/**
 * 读取通用存储文件
 */
function readGeneralStorage(): Record<string, string> {
  try {
    if (!fs.existsSync(GENERAL_STORAGE_FILE)) {
      return {};
    }
    const content = fs.readFileSync(GENERAL_STORAGE_FILE, "utf8");
    return JSON.parse(content);
  } catch (error) {
    console.error("[Storage] 读取通用存储失败:", error);
    return {};
  }
}

/**
 * 写入通用存储文件
 */
function writeGeneralStorage(data: Record<string, string>): void {
  try {
    ensureStorageDir();
    fs.writeFileSync(GENERAL_STORAGE_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error("[Storage] 写入通用存储失败:", error);
    throw error;
  }
}

/**
 * 获取存储项
 */
async function getItem(key: string): Promise<string | null> {
  try {
    const storage = readGeneralStorage();
    const value = storage[key];
    console.log(`[Storage] 获取存储项: ${key} = ${value || "null"}`);
    return value || null;
  } catch (error) {
    console.error(`[Storage] 获取存储项失败 ${key}:`, error);
    return null;
  }
}

/**
 * 设置存储项
 */
async function setItem(key: string, value: string): Promise<void> {
  try {
    const storage = readGeneralStorage();
    storage[key] = value;
    writeGeneralStorage(storage);
    console.log(`[Storage] 设置存储项: ${key} = ${value}`);
  } catch (error) {
    console.error(`[Storage] 设置存储项失败 ${key}:`, error);
    throw error;
  }
}

/**
 * 删除存储项
 */
async function removeItem(key: string): Promise<void> {
  try {
    const storage = readGeneralStorage();
    if (key in storage) {
      delete storage[key];
      writeGeneralStorage(storage);
      console.log(`[Storage] 删除存储项: ${key}`);
    }
  } catch (error) {
    console.error(`[Storage] 删除存储项失败 ${key}:`, error);
    throw error;
  }
}

/**
 * 清除所有存储项
 */
async function clear(): Promise<void> {
  try {
    writeGeneralStorage({});
    // 同时清除登录信息
    await clearLoginInfo();
    console.log("[Storage] 已清除所有存储项");
  } catch (error) {
    console.error("[Storage] 清除存储失败:", error);
    throw error;
  }
}

/**
 * 获取所有存储键
 */
async function keys(): Promise<string[]> {
  try {
    const storage = readGeneralStorage();
    const keysList = Object.keys(storage);
    console.log("[Storage] 获取所有键:", keysList);
    return keysList;
  } catch (error) {
    console.error("[Storage] 获取键列表失败:", error);
    return [];
  }
}

/**
 * 保存登录信息
 */
async function saveLoginInfo(loginInfo: LoginInfo): Promise<void> {
  try {
    ensureStorageDir();
    fs.writeFileSync(LOGIN_INFO_FILE, JSON.stringify(loginInfo, null, 2), "utf8");
    console.log("[Storage] 登录信息已保存");
  } catch (error) {
    console.error("[Storage] 保存登录信息失败:", error);
    throw error;
  }
}

/**
 * 获取登录信息
 */
async function getLoginInfo(): Promise<LoginInfo | null> {
  try {
    if (!fs.existsSync(LOGIN_INFO_FILE)) {
      console.log("[Storage] 登录信息文件不存在");
      return null;
    }
    const content = fs.readFileSync(LOGIN_INFO_FILE, "utf8");
    const loginInfo = JSON.parse(content) as LoginInfo;
    console.log("[Storage] 登录信息已读取");
    return loginInfo;
  } catch (error) {
    console.error("[Storage] 读取登录信息失败:", error);
    return null;
  }
}

/**
 * 清除登录信息文件
 */
async function clearLoginInfo(): Promise<void> {
  try {
    if (fs.existsSync(LOGIN_INFO_FILE)) {
      fs.unlinkSync(LOGIN_INFO_FILE);
      console.log("[Storage] 登录信息已清除");
    }
  } catch (error) {
    console.error("[Storage] 清除登录信息失败:", error);
    throw error;
  }
}

/**
 * 注册存储相关的 IPC 处理器
 */
export function registerStorageHandlers(): void {
  // 基础存储操作
  ipcMain.handle("storage:get-item", async (_, key: string) => {
    return getItem(key);
  });

  ipcMain.handle("storage:set-item", async (_, key: string, value: string) => {
    return setItem(key, value);
  });

  ipcMain.handle("storage:remove-item", async (_, key: string) => {
    return removeItem(key);
  });

  ipcMain.handle("storage:clear", async () => {
    return clear();
  });

  ipcMain.handle("storage:keys", async () => {
    return keys();
  });

  // 登录信息专用操作
  ipcMain.handle("storage:save-login-info", async (_, loginInfo: LoginInfo) => {
    return saveLoginInfo(loginInfo);
  });

  ipcMain.handle("storage:get-login-info", async () => {
    return getLoginInfo();
  });

  ipcMain.handle("storage:clear-login-info", async () => {
    return clearLoginInfo();
  });

  console.log("[Storage] IPC 处理器已注册");
}
