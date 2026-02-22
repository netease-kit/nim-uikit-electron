/**
 * ============================================================================
 * Electron Preload 脚本
 * ============================================================================
 *
 * @description 暴露安全的 API 给渲染进程
 *
 * NEUIKitBridge 是一个可独立拷贝的 Electron 功能模块集合。
 * 开发者可以将整个 NEUIKitBridge 目录拷贝到自己的项目中，然后按需导入所需的模块。
 *
 * ⚠️ 重要：必须直接导入 .api.ts 文件，而不是通过模块入口 index.ts
 * 因为 index.ts 会 re-export service 层代码，其中包含 Node.js 特有的代码，
 * 这些代码在渲染进程中无法正常执行。
 *
 * 可用模块：
 *   - app：应用控制（重启、DevTools）
 *   - tray：托盘功能（更新未读数、语言切换）
 *   - version：版本信息获取
 *   - window-close：窗口关闭行为（退出确认）
 *   - fs：文件系统操作（文件读写、目录管理、本地文件协议）
 *   - navigation：页面导航事件监听
 *   - notification：桌面通知
 *
 * 按需引入示例：
 *   // 只需要托盘功能
 *   import { createTrayAPI, type TrayAPI } from './NEUIKitBridge/tray/tray.api';
 *
 *   // 只需要版本信息
 *   import { createVersionAPI, type VersionAPI } from './NEUIKitBridge/version/version.api';
 */

/**
 * ============================================================================
 * 模块导入
 * ============================================================================
 *
 * ⚠️ 开发者可按需选择导入哪些模块的 API，不需要的模块可以注释掉或删除。
 *
 * 注意：
 *   1. 必须直接导入 .api.ts 文件（不要导入 index.ts）
 *   2. 如果不需要某个功能，直接删除对应的 import 和 create*API() 调用即可
 *   3. 同时需要在 main.ts 中删除对应的 register*Handlers() 调用
 *   4. 删除模块后记得更新下方的 ElectronAPI 接口定义
 */
import { createAppAPI, type AppAPI } from "./NEUIKitBridge/app/app.api";
import { createTrayAPI, type TrayAPI } from "./NEUIKitBridge/tray/tray.api";
import { createVersionAPI, type VersionAPI } from "./NEUIKitBridge/version/version.api";
import {
  createWindowCloseAPI,
  type WindowCloseAPI,
} from "./NEUIKitBridge/window-close/window-close.api";
import { createNavigationAPI, type NavigationAPI } from "./NEUIKitBridge/navigation/navigation.api";
import {
  createNotificationAPI,
  type NotificationAPI,
} from "./NEUIKitBridge/notification/notification.api";
import { createFsAPI, type FsAPI } from "./NEUIKitBridge/fs/fs.api";
import { createStorageAPI, type StorageAPI } from "./preload/storage";

/**
 * ============================================================================
 * Electron API 总接口定义
 * ============================================================================
 *
 * 暴露给渲染进程的所有 API 类型定义。
 * 如果删除了某个模块，记得同步更新此接口。
 */
export interface ElectronAPI {
  /** 应用控制：重启、打开 DevTools */
  app: AppAPI;
  /** 托盘功能：更新未读数、切换语言 */
  tray: TrayAPI;
  /** 版本信息：获取应用版本号 */
  version: VersionAPI;
  /** 窗口关闭：退出确认弹窗控制 */
  windowClose: WindowCloseAPI;
  /** 导航事件：监听主进程发送的导航指令 */
  navigation: NavigationAPI;
  /** 桌面通知：显示新消息通知 */
  notification: NotificationAPI;
  /** 文件系统：文件读写、目录管理、本地文件协议、文件选择对话框 */
  fs: FsAPI;
  /** 统一存储：持久化存储解决方案（替换 localStorage） */
  storage: StorageAPI;
}

/**
 * 创建所有 Preload API
 *
 * ⚠️ 开发者可按需选择创建哪些模块的 API，不需要的模块可以注释掉或删除。
 *
 * 可用的 API 创建函数：
 *   - createAppAPI()         - 应用控制
 *   - createTrayAPI()        - 托盘功能
 *   - createVersionAPI()     - 版本信息
 *   - createWindowCloseAPI() - 窗口关闭行为
 *   - createFsAPI()          - 文件系统操作
 *   - createNavigationAPI()  - 导航事件
 *   - createNotificationAPI() - 桌面通知
 *
 * 按需注释/删除不需要的模块：
 */
function createAllAPIs(): ElectronAPI {
  return {
    app: createAppAPI(), // 应用控制
    tray: createTrayAPI(), // 托盘功能
    version: createVersionAPI(), // 版本信息
    windowClose: createWindowCloseAPI(), // 窗口关闭行为
    navigation: createNavigationAPI(), // 导航事件
    notification: createNotificationAPI(), // 桌面通知
    fs: createFsAPI(), // 文件系统（含文件选择对话框）
    storage: createStorageAPI(), // 统一存储解决方案
  };
}

// 因为项目禁用了 contextIsolation，直接挂载到 window 对象
window.electronAPI = createAllAPIs();

export {};
