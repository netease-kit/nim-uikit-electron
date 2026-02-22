import { V2NIMConst } from "./constants";
import RootStore from "../store";
import { V2NIMClient } from "node-nim";
import type { V2NIMMessage } from "node-nim/types/v2_def/v2_nim_struct_def";

let nim: V2NIMClient | null = null;
let uikitStore: RootStore | null = null;

export let imAppkey: string = "";

export const initIMUIKit = async (appkey: string) => {
  nim = new V2NIMClient();
  imAppkey = appkey;
  nim.init({
    appkey,
    basicOption: {
      // 是否开启云端会话
      enableCloudConversation: false,
      // 收到撤回消息时是否减少会话未读数
      reduceUnreadOnMessageRecall: true,
    },
  });

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
      teamAgreeMode:
        V2NIMConst.V2NIMTeamAgreeMode.V2NIM_TEAM_AGREE_MODE_NO_AUTH,
      // 是否展示群管理员
      teamManagerVisible: true,
      // 是否启用云端搜索
      enableCloudSearch: false,
      // 是否显示用户在线状态，默认 false
      loginStateVisible: true,
      // 发送消息前回调, 可对消息体进行修改，添加自定义参数
      aiVisible: false,
      // 是否开启云端会话
      enableCloudConversation: false,
      // 是否开启桌面消息通知
      enableDesktopNotification: true,
      //@ts-ignore
      sendMsgBefore: async (options: {
        msg: V2NIMMessage;
        conversationId: string;
        serverExtension?: Record<string, unknown>;
      }) => {
        return { ...options };
      },
    },
    "Electron",
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
