import { makeAutoObservable } from "mobx";
import { ConnectStore } from "./connect";
import { FriendStore } from "./friends";
import { MsgStore } from "./msgs";
import { RelationStore } from "./relations";
import { ConversationStore } from "./conversations";
import { TeamStore } from "./teams";
import { TeamMemberStore } from "./teamMembers";
import { SysMsgStore } from "./sysMsgs";
import { UserStore } from "./users";
import { AIUserStore } from "./aiUsers";
import { UiStore } from "./ui";
import { StorageStore } from "./storage";
import { ContactType, Relation, LocalOptions } from "./types";
import * as storeUtils from "./utils";
import * as storeConstants from "./constant";
import { V2NIMClient } from "node-nim";
import { NESDK_VERSION, NEUIKIT_VERSION, V2NIMConst } from "../utils/constants";

import sdkPkg from "node-nim/package.json";
import { logDebug, EventTracking } from "@xkit-yx/utils";
import packageJson from "node-nim/package.json";
import { LocalConversationStore } from "./localConversation";
import { SubscriptionStore } from "./subscription";
import { imAppkey } from "../utils/init";
import { getOS } from "../utils/index";

class RootStore {
  static ins: RootStore;
  nim: V2NIMClient;
  localOptions: Required<LocalOptions> = {
    addFriendNeedVerify: true,
    teamJoinMode: V2NIMConst.V2NIMTeamJoinMode.V2NIM_TEAM_JOIN_MODE_FREE,
    teamAgreeMode: V2NIMConst.V2NIMTeamAgreeMode.V2NIM_TEAM_AGREE_MODE_NO_AUTH,
    teamInviteMode: V2NIMConst.V2NIMTeamInviteMode.V2NIM_TEAM_INVITE_MODE_MANAGER,
    teamUpdateTeamMode: V2NIMConst.V2NIMTeamUpdateInfoMode.V2NIM_TEAM_UPDATE_INFO_MODE_MANAGER,
    teamUpdateExtMode: V2NIMConst.V2NIMTeamUpdateExtensionMode.V2NIM_TEAM_UPDATE_EXTENSION_MODE_ALL,
    enableTeam: true,
    enableChangeTeamJoinMode: true,
    enableChangeTeamAgreeMode: true,
    leaveOnTransfer: false,
    needMention: true,
    p2pMsgReceiptVisible: false,
    teamMsgReceiptVisible: false,
    loginStateVisible: false,
    allowTransferTeamOwner: false,
    teamManagerVisible: false,
    aiVisible: true,
    teamManagerLimit: 10,
    sendMsgBefore: async (options: any) => options,
    aiUserAgentProvider: {},
    conversationLimit: 100,
    enableCloudConversation: false,
    debug: "debug",
    aiStream: true,
    iconfontUrl: [],
    enableDesktopNotification: true,
    enableCloudSearch: true,
  };
  sdkOptions: any = {};
  connectStore: ConnectStore;
  friendStore: FriendStore;
  msgStore: MsgStore;
  relationStore: RelationStore;
  conversationStore: ConversationStore | null = null;
  localConversationStore: LocalConversationStore | null = null;
  teamStore: TeamStore;
  teamMemberStore: TeamMemberStore;
  sysMsgStore: SysMsgStore;
  userStore: UserStore;
  aiUserStore: AIUserStore;
  subscriptionStore: SubscriptionStore;
  uiStore: UiStore;
  logger: typeof storeUtils.logger | null = null;
  storageStore: StorageStore;

  constructor(nim: V2NIMClient, localOptions?: Partial<LocalOptions>, platform = "Electron") {
    makeAutoObservable(this);
    this.nim = nim;
    this.localOptions = {
      addFriendNeedVerify: true,
      teamJoinMode: V2NIMConst.V2NIMTeamJoinMode.V2NIM_TEAM_JOIN_MODE_FREE,
      teamAgreeMode: V2NIMConst.V2NIMTeamAgreeMode.V2NIM_TEAM_AGREE_MODE_NO_AUTH,
      teamInviteMode: V2NIMConst.V2NIMTeamInviteMode.V2NIM_TEAM_INVITE_MODE_MANAGER,
      teamUpdateTeamMode: V2NIMConst.V2NIMTeamUpdateInfoMode.V2NIM_TEAM_UPDATE_INFO_MODE_MANAGER,
      teamUpdateExtMode:
        V2NIMConst.V2NIMTeamUpdateExtensionMode.V2NIM_TEAM_UPDATE_EXTENSION_MODE_ALL,
      enableTeam: true,
      enableChangeTeamJoinMode: true,
      enableChangeTeamAgreeMode: true,
      leaveOnTransfer: false,
      needMention: true,
      p2pMsgReceiptVisible: false,
      teamMsgReceiptVisible: false,
      loginStateVisible: false,
      allowTransferTeamOwner: false,
      teamManagerVisible: false,
      aiVisible: true,
      teamManagerLimit: 10,
      sendMsgBefore: async (options: any) => options,
      aiUserAgentProvider: {},
      conversationLimit: 100,
      enableCloudConversation: false,
      debug: "debug",
      aiStream: true,
      iconfontUrl: [],
      enableDesktopNotification: true,
      enableCloudSearch: true, // 默认启用云端搜索
      ...localOptions,
    } as Required<LocalOptions>;
    this.logger =
      this.localOptions?.debug == "off"
        ? null
        : logDebug({
            level: this.localOptions?.debug,
            version: packageJson.version,
            appName: packageJson.name,
            needStringify: false,
          });

    this.logger?.log(
      `Electron IMUIKit Vue3 初始化，NEUIKIT 版本：${NEUIKIT_VERSION}，NIM SDK 版本：${NESDK_VERSION}, localOptions 配置`,
      {
        localOptions: this.localOptions,
      }
    );

    this.connectStore = new ConnectStore(this, nim, this.localOptions);
    this.friendStore = new FriendStore(this, nim);
    this.msgStore = new MsgStore(this, nim, this.localOptions);
    this.relationStore = new RelationStore(this, nim);
    // 区分是本地会话还是云端会话
    if (this.localOptions?.enableCloudConversation) {
      this.conversationStore = new ConversationStore(this, nim);
    } else {
      this.localConversationStore = new LocalConversationStore(this, nim);
    }

    this.teamStore = new TeamStore(this, nim, this.localOptions);
    this.teamMemberStore = new TeamMemberStore(this, nim);
    this.sysMsgStore = new SysMsgStore(this, nim);
    this.userStore = new UserStore(this, nim);
    this.aiUserStore = new AIUserStore(this, nim, this.localOptions);
    this.uiStore = new UiStore(this, this.localOptions);
    this.storageStore = new StorageStore(this, nim);
    this.subscriptionStore = new SubscriptionStore(this, nim);

    const reportComponents = ["ContactKit", "ConversationKit", "ChatKit", "SearchKit"];

    reportComponents.forEach((item) => {
      const eventTracking = new EventTracking({
        appKey: imAppkey,
        version: "",
        component: item,
        imVersion: sdkPkg.version,
        platform,
        channel: "netease",
        os: getOS(),
        framework: "Electron",
        language: "Vue3",
        container: "PC",
      });

      eventTracking.track("init", "");
    });
  }

  resetState(): void {
    this.logger?.log("store resetState");
    this.friendStore.resetState();
    this.msgStore.resetState();
    this.relationStore.resetState();
    if (this.localOptions?.enableCloudConversation) {
      this.conversationStore?.resetState();
    } else {
      this.localConversationStore?.resetState();
    }

    this.teamStore.resetState();
    this.teamMemberStore.resetState();
    this.sysMsgStore.resetState();
    this.userStore.resetState();
    this.aiUserStore.resetState();
    this.uiStore.resetState();
    this.subscriptionStore.resetState();
  }

  /**
   * 销毁根store实例
   */
  destroy(): void {
    storeUtils.logger.log("store destroyed");
    this.connectStore.destroy();
    this.friendStore.destroy();
    this.msgStore.destroy();
    this.relationStore.destroy();
    if (this.localOptions?.enableCloudConversation) {
      this.conversationStore?.destroy();
    } else {
      this.localConversationStore?.destroy();
    }

    this.teamStore.destroy();
    this.teamMemberStore.destroy();
    this.sysMsgStore.destroy();
    this.userStore.destroy();
    this.aiUserStore.destroy();
    this.uiStore.destroy();
    this.subscriptionStore.destroy();
  }

  /**
   * 获取根store实例
   * @param nim NIM SDK 实例
   * @param t 国际化函数
   */
  static getInstance(
    nim: V2NIMClient,
    localOptions?: Partial<LocalOptions>,
    platform = "Web"
  ): RootStore {
    if (!this.ins) {
      this.ins = new RootStore(nim, localOptions, platform);
    }

    return this.ins;
  }
}

export default RootStore;

export type { ContactType, Relation };

export {
  RootStore,
  ConnectStore,
  FriendStore,
  MsgStore,
  RelationStore,
  ConversationStore,
  LocalConversationStore,
  TeamStore,
  TeamMemberStore,
  SysMsgStore,
  UserStore,
  AIUserStore,
  UiStore,
  StorageStore,
  SubscriptionStore,
  storeUtils,
  storeConstants,
};

// export * as V2NIM from 'nim-web-sdk-ng/dist/esm/nim'
