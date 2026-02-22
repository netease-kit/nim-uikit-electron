/**
 * ============================================================================
 * 统一存储模块 - 渲染进程 API
 * ============================================================================
 *
 * 提供统一的存储能力，解决 Electron 开发模式下 localStorage 不持久的问题
 *
 * 支持的存储类型：
 * - 基础键值存储 (替换 localStorage)
 * - 登录信息存储 (特殊处理)
 */

import { ipcRenderer } from "electron";

/**
 * 登录信息接口
 */
export interface LoginInfo {
  account: string;
  token: string;
}

/**
 * 统一存储 API
 */
export interface StorageAPI {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  clear: () => Promise<void>;
  keys: () => Promise<string[]>;
  saveLoginInfo: (loginInfo: LoginInfo) => Promise<void>;
  getLoginInfo: () => Promise<LoginInfo | null>;
  clearLoginInfo: () => Promise<void>;
}

/**
 * 创建统一存储 API
 */
export function createStorageAPI(): StorageAPI {
  return {
    // 基础存储操作
    getItem: async (key: string) => {
      return ipcRenderer.invoke("storage:get-item", key);
    },
    setItem: async (key: string, value: string) => {
      return ipcRenderer.invoke("storage:set-item", key, value);
    },
    removeItem: async (key: string) => {
      return ipcRenderer.invoke("storage:remove-item", key);
    },
    clear: async () => {
      return ipcRenderer.invoke("storage:clear");
    },
    keys: async () => {
      return ipcRenderer.invoke("storage:keys");
    },

    // 登录信息专用操作
    saveLoginInfo: async (loginInfo: LoginInfo) => {
      return ipcRenderer.invoke("storage:save-login-info", loginInfo);
    },
    getLoginInfo: async () => {
      return ipcRenderer.invoke("storage:get-login-info");
    },
    clearLoginInfo: async () => {
      return ipcRenderer.invoke("storage:clear-login-info");
    },
  };
}
