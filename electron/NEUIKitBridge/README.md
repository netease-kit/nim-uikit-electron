# NEUIKitBridge

NEUIKitBridge 是云信 IM Electron UIKit 的核心桥接层模块，负责 **渲染进程（Renderer Process）** 与 **主进程（Main Process）** 之间的 IPC 通信。

## 概述

在 Electron 架构中，渲染进程无法直接访问系统级 API（如托盘、窗口管理等）。NEUIKitBridge 作为 UIKit 的一部分，提供了一套标准化的桥接接口，使渲染进程中的 Vue 组件能够安全地调用主进程功能。

```
┌─────────────────────────────────────────────────────────────────┐
│                      Renderer Process                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  NEUIKit (Vue Components)                │   │
│  │   Conversation / Chat / Contact / Search / User ...     │   │
│  └─────────────────────────┬───────────────────────────────┘   │
│                            │                                    │
│                            ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │               window.electronAPI (Preload)               │   │
│  │          通过 *.api.ts 暴露的安全 API 接口               │   │
│  └─────────────────────────┬───────────────────────────────┘   │
└────────────────────────────┼────────────────────────────────────┘
                             │ IPC 通信
┌────────────────────────────┼────────────────────────────────────┐
│                      Main Process                               │
│  ┌─────────────────────────▼───────────────────────────────┐   │
│  │              NEUIKitBridge (IPC Handlers)                │   │
│  │         通过 *.handler.ts 注册的 IPC 处理器              │   │
│  └─────────────────────────┬───────────────────────────────┘   │
│                            │                                    │
│                            ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   System APIs                            │   │
│  │      Tray / Window / File System / App Control ...      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 目录结构

```
NEUIKitBridge/
├── app/                    # 应用控制模块
│   ├── app.api.ts         # 渲染进程 API（重启、DevTools）
│   ├── app.handler.ts     # 主进程 IPC 处理器
│   └── index.ts           # 模块导出入口
│
├── fs/                     # 文件系统模块
│   ├── fs.api.ts          # 渲染进程 API（文件操作、路径获取）
│   ├── fs.handler.ts      # 主进程 IPC 处理器
│   ├── fs.service.ts      # 文件系统服务（CRUD 操作）
│   ├── fs.protocol.ts     # 本地文件协议（local-file://）
│   ├── fs.types.ts        # 类型定义
│   └── index.ts           # 模块导出入口
│
├── tray/                   # 系统托盘模块
│   ├── tray.api.ts        # 渲染进程 API（更新未读数、切换语言）
│   ├── tray.handler.ts    # 主进程 IPC 处理器
│   ├── tray.service.ts    # 托盘服务（创建、更新托盘）
│   └── index.ts           # 模块导出入口
│
├── version/                # 版本信息模块
│   ├── version.api.ts     # 渲染进程 API（获取版本号）
│   ├── version.handler.ts # 主进程 IPC 处理器
│   ├── version.service.ts # 版本服务
│   └── index.ts           # 模块导出入口
│
├── window-close/           # 窗口关闭管理模块
│   ├── window-close.api.ts     # 渲染进程 API（退出确认）
│   ├── window-close.handler.ts # 主进程 IPC 处理器
│   ├── window-close.service.ts # 窗口关闭服务
│   └── index.ts                # 模块导出入口
│
├── notification/           # 桌面通知模块
│   ├── notification.api.ts     # 渲染进程 API（显示通知）
│   ├── notification.handler.ts # 主进程 IPC 处理器
│   ├── notification.service.ts # 通知服务
│   └── index.ts                # 模块导出入口
│
├── navigation/             # 导航事件模块
│   ├── navigation.api.ts  # 渲染进程 API（监听导航事件）
│   └── index.ts           # 模块导出入口
│
├── i18n/                   # 国际化支持模块
│   └── index.ts           # 语言配置
│
└── README.md               # 本文档
```

## 模块说明

| 模块             | 功能描述 | 主要 API                                                                                                    |
| ---------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| **app**          | 应用控制 | `relaunch()` 重启应用、`openDevTools()` 打开开发者工具                                                      |
| **fs**           | 文件系统 | `getAppPath()` 获取系统目录、`exists()` 检查文件存在、`writeFile()` 写入文件、`toLocalFileUrl()` 路径转 URL |
| **tray**         | 系统托盘 | `updateUnreadCount()` 更新未读数、`setLanguage()` 切换语言                                                  |
| **version**      | 版本信息 | `getVersion()` 获取应用版本号                                                                               |
| **window-close** | 窗口关闭 | `onCloseRequested()` 监听关闭请求、`confirmClose()` 确认关闭                                                |
| **notification** | 桌面通知 | `showNotification()` 显示新消息通知                                                                         |
| **navigation**   | 页面导航 | `onNavigate()` 监听主进程导航指令                                                                           |
| **i18n**         | 国际化   | 托盘菜单多语言支持                                                                                          |

## fs 模块详解

`fs` 模块是文件系统操作的统一入口，整合了以下功能：

### API 接口

```typescript
interface FsAPI {
  /** 获取系统目录路径 */
  getAppPath(name: AppPathName): Promise<string>;

  /** 确保目录存在（递归创建） */
  ensureDir(dirPath: string): Promise<void>;

  /** 检查文件/目录是否存在 */
  exists(filePath: string): Promise<boolean>;

  /** 获取文件状态信息 */
  stat(filePath: string): Promise<FileStat>;

  /** 写入文件（仅限 userData/temp 目录） */
  writeFile(filePath: string, content: Buffer | string): Promise<void>;

  /** 删除文件（仅限 userData/temp 目录） */
  deleteFile(filePath: string): Promise<void>;

  /** 将本地路径转换为 local-file:// URL（纯函数） */
  toLocalFileUrl(filePath: string): string;

  /** 将 local-file:// URL 转换为本地路径（纯函数） */
  fromLocalFileUrl(url: string): string;
}

type AppPathName =
  | "home"
  | "appData"
  | "userData"
  | "sessionData"
  | "temp"
  | "exe"
  | "desktop"
  | "documents"
  | "downloads"
  | "music"
  | "pictures"
  | "videos";
```

### 安全边界

为保护用户系统安全，`writeFile` 和 `deleteFile` 操作仅允许在以下目录中执行：

- `userData` - 应用数据目录
- `temp` - 系统临时目录

尝试写入或删除其他目录的文件将抛出 `Access denied` 错误。

### 本地文件协议

Electron 渲染进程无法直接访问 `file://` 协议。`fs` 模块提供了 `local-file://` 自定义协议，支持：

- 所有文件类型的读取（只读）
- 正确的 MIME 类型识别
- 音视频文件的 Range 请求（流式播放）

```typescript
// 使用示例
const localPath = '/Users/xxx/image.jpg';
const url = window.electronAPI.fs.toLocalFileUrl(localPath);
// => 'local-file://localhost/Users/xxx/image.jpg'

// 在 img 标签中使用
<img :src="url" />
```

## 文件命名约定

每个模块遵循统一的文件命名规范：

- `*.api.ts` - **渲染进程 API**：通过 `ipcRenderer` 发起 IPC 调用，在 `preload.ts` 中导入
- `*.handler.ts` - **主进程处理器**：通过 `ipcMain.handle` 注册 IPC 处理逻辑，在 `main.ts` 中导入
- `*.service.ts` - **服务层**：封装具体的业务逻辑，供 handler 调用
- `*.protocol.ts` - **协议层**：自定义协议的注册和处理逻辑
- `*.types.ts` - **类型定义**：TypeScript 接口和类型
- `index.ts` - **模块入口**：统一导出模块的公开接口

## 使用方式

### 在主进程中注册（main.ts）

```typescript
import { initTray, registerTrayHandlers } from "./NEUIKitBridge/tray";
import { registerVersionHandlers } from "./NEUIKitBridge/version";
import { registerWindowCloseHandlers } from "./NEUIKitBridge/window-close";
import {
  registerFsHandlers,
  registerLocalFileProtocol,
  initLocalFileProtocol,
} from "./NEUIKitBridge/fs";

// 注册本地文件协议（必须在 app.whenReady() 之前）
registerLocalFileProtocol();

app.whenReady().then(() => {
  // 初始化协议处理器（必须在 app.whenReady() 之后）
  initLocalFileProtocol();

  // 注册 IPC 处理器
  registerTrayHandlers(markAppQuitting, () => win);
  registerVersionHandlers();
  registerWindowCloseHandlers();
  registerFsHandlers();

  // 初始化服务
  initTray(win, markAppQuitting);
});
```

### 在预加载脚本中暴露 API（preload.ts）

```typescript
// ⚠️ 必须直接导入 .api.ts 文件，而不是 index.ts
import { createTrayAPI } from "./NEUIKitBridge/tray/tray.api";
import { createVersionAPI } from "./NEUIKitBridge/version/version.api";
import { createFsAPI } from "./NEUIKitBridge/fs/fs.api";

window.electronAPI = {
  tray: createTrayAPI(),
  version: createVersionAPI(),
  fs: createFsAPI(),
  // ...
};
```

### 在渲染进程中调用（Vue 组件）

```typescript
// 更新托盘未读数
window.electronAPI.tray.updateUnreadCount(5);

// 获取版本号
const version = await window.electronAPI.version.getVersion();

// 文件系统操作
const userDataPath = await window.electronAPI.fs.getAppPath("userData");
const cacheDir = `${userDataPath}/my-cache`;
await window.electronAPI.fs.ensureDir(cacheDir);

const fileExists = await window.electronAPI.fs.exists("/path/to/file.txt");

// 本地文件 URL 转换（用于 img/video/audio 标签）
const localUrl = window.electronAPI.fs.toLocalFileUrl("/path/to/image.jpg");
```

## 按需引入

NEUIKitBridge 支持按需引入，开发者可以只导入需要的模块：

```typescript
// 只需要托盘功能
import { initTray, registerTrayHandlers } from "./NEUIKitBridge/tray";

// 只需要版本信息
import { registerVersionHandlers } from "./NEUIKitBridge/version";

// 只需要文件系统功能
import { registerFsHandlers, registerLocalFileProtocol } from "./NEUIKitBridge/fs";
```

不需要的模块可以直接删除或注释掉，不会影响其他功能。

## 扩展新模块

如需添加新的桥接功能，请遵循以下步骤：

1. 在 `NEUIKitBridge/` 下创建新目录，如 `new-feature/`
2. 创建 `new-feature.api.ts`：定义渲染进程 API
3. 创建 `new-feature.handler.ts`：实现主进程 IPC 处理器
4. 创建 `new-feature.service.ts`（可选）：封装业务逻辑
5. 创建 `new-feature.types.ts`（可选）：定义类型接口
6. 创建 `index.ts`：导出模块公开接口
7. 在 `main.ts` 中注册 handler
8. 在 `preload.ts` 中暴露 API

## 注意事项

1. **安全性**：所有 IPC 通信都应通过此桥接层进行，避免直接在渲染进程中使用 Node.js API
2. **类型安全**：每个 API 都提供完整的 TypeScript 类型定义
3. **模块独立**：各模块之间保持独立，避免循环依赖
4. **preload 限制**：在 `preload.ts` 中只能导入 `*.api.ts` 文件，不能导入包含 Node.js 代码的 service 层
5. **协议注册顺序**：`registerLocalFileProtocol()` 必须在 `app.whenReady()` 之前调用，`initLocalFileProtocol()` 必须在之后调用
