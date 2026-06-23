import { V2NIMConst } from "./constants";
import RootStore from "../store";
import { V2NIMClient } from "node-nim";
import type {
  V2NIMInitOption,
  V2NIMMessage,
} from "node-nim/types/v2_def/v2_nim_struct_def";
import storageManager from "./storage";

const SDK_DATA_DIR_NAME = "NIM";

const joinWritablePath = (basePath: string, childPath: string) => {
  const normalizedBasePath = basePath.replace(/[\\/]+$/, "");
  const separator = basePath.includes("\\") ? "\\" : "/";
  return `${normalizedBasePath}${separator}${childPath}`;
};

const resolveSdkAppDataPath = async () => {
  const fsApi = window.electronAPI?.fs;
  if (!fsApi) {
    console.warn("[Init] window.electronAPI.fs 不可用，SDK appDataPath 使用默认目录");
    return null;
  }

  const userDataPath = await fsApi.getAppPath("userData");
  const appDataPath = joinWritablePath(userDataPath, SDK_DATA_DIR_NAME);
  await fsApi.ensureDir(appDataPath);

  return {
    userDataPath,
    appDataPath,
  };
};

// 异步加载配置
const loadConfig = async () => {
  try {
    // 是否开启云端会话，实际根据您的业务调整
    const cloudConversation = await storageManager.getItemAsync("enableCloudConversation");
    const enableCloudConversation = cloudConversation === "on";

    const teamManager = await storageManager.getItemAsync("teamManagerVisible");
    const teamManagerVisible = teamManager !== "off";

    // 是否开启桌面消息通知（默认开启）
    const desktopNotification = await storageManager.getItemAsync("enableDesktopNotification");
    const enableDesktopNotification = desktopNotification !== "off";

    const enableCloudSearch = (await storageManager.getItemAsync("enableCloudSearch")) !== "off";

    return {
      enableCloudConversation,
      teamManagerVisible,
      enableDesktopNotification,
      enableCloudSearch,
    };
  } catch (error) {
    console.warn("[Init] 加载配置失败，使用默认值:", error);
    // 返回默认值
    return {
      enableCloudConversation: false,
      teamManagerVisible: true,
      enableDesktopNotification: true,
      enableCloudSearch: false,
    };
  }
};

let nim: V2NIMClient | null = null;
let uikitStore: RootStore | null = null;

export let imAppkey: string = "";

export const initIMUIKit = async (appkey: string) => {
  // 先加载配置
  const config = await loadConfig();

  nim = new V2NIMClient();
  imAppkey = appkey;
  const sdkAppData = await resolveSdkAppDataPath();
  const initOptions: V2NIMInitOption = {
    appkey,
    ...(sdkAppData?.appDataPath ? { appDataPath: sdkAppData.appDataPath } : {}),
    basicOption: {
      // 是否开启云端会话
      enableCloudConversation: config.enableCloudConversation,
      // 收到撤回消息时是否减少会话未读数
      reduceUnreadOnMessageRecall: true,
    },
    fcsOption: {
      sslVerify: false
    }
  };

  console.log("[Init] V2NIM SDK writable path", sdkAppData);
  console.log("[Init] V2NIM SDK init options", initOptions);
  nim.init(initOptions);

  uikitStore = new RootStore(
    nim,
    {
      // 添加好友是否需要验证
      addFriendNeedVerify: false,
      // 是否需要显示 p2p 消息、p2p会话列表消息已读未读，默认 false
      p2pMsgReceiptVisible: true,
      // 是否需要显示群组消息已读未读，默认 false
      teamMsgReceiptVisible: true,
      teamJoinMode: V2NIMConst.V2NIMTeamJoinMode.V2NIM_TEAM_JOIN_MODE_FREE,
      // 群组被邀请模式，默认需要验证
      teamAgreeMode: V2NIMConst.V2NIMTeamAgreeMode.V2NIM_TEAM_AGREE_MODE_NO_AUTH,
      // 是否展示群管理员
      teamManagerVisible: config.teamManagerVisible,
      // 是否启用云端搜索
      enableCloudSearch: config.enableCloudSearch,
      // 是否显示用户在线状态，默认 false
      loginStateVisible: true,
      // 发送消息前回调, 可对消息体进行修改，添加自定义参数
      aiVisible: false,
      // 是否开启云端会话
      enableCloudConversation: config.enableCloudConversation,
      // 是否开启桌面消息通知
      enableDesktopNotification: config.enableDesktopNotification,
      //@ts-ignore
      sendMsgBefore: async (options: {
        msg: V2NIMMessage;
        conversationId: string;
        serverExtension?: Record<string, unknown>;
      }) => {
        return { ...options };
      },
    },
    "Electron"
  );

  return {
    nim,
    store: uikitStore,
  };
};

export const releaseIMUIKit = () => {
  nim?.uninit();
};

export const getContextState = () => {
  return {
    nim,
    store: uikitStore,
  };
};
