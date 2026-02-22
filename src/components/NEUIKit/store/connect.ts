import { makeAutoObservable } from "mobx";
import RootStore from ".";
import { V2NIMConst } from "../utils/constants";
import {
  V2NIMConnectStatus,
  V2NIMLoginClientChange,
  V2NIMLoginStatus,
  V2NIMDataSyncType,
  V2NIMDataSyncState,
  V2NIMClient,
} from "node-nim";
import {
  V2NIMError,
  V2NIMKickedOfflineDetail,
} from "node-nim/types/v2_def/v2_nim_struct_def";

import { LocalOptions } from "./types";
import * as storeUtils from "./utils";

/**Mobx 可观察对象，负责连接的子 store */
export class ConnectStore {
  connectStatus: V2NIMConnectStatus = 3;
  loginStatus: V2NIMLoginStatus = 0;
  logger: typeof storeUtils.logger | null = null;

  constructor(
    private rootStore: RootStore,
    private nim: V2NIMClient,
    private localOptions: LocalOptions
  ) {
    makeAutoObservable(this);

    this._onLoginStatus = this._onLoginStatus.bind(this);
    this._onLoginFailed = this._onLoginFailed.bind(this);
    this._onKickedOffline = this._onKickedOffline.bind(this);
    this._onLoginClientChanged = this._onLoginClientChanged.bind(this);
    this._onConnectStatus = this._onConnectStatus.bind(this);
    this._onDisconnected = this._onDisconnected.bind(this);
    this._onConnectFailed = this._onConnectFailed.bind(this);
    this._onDataSync = this._onDataSync.bind(this);
    this.logger = rootStore.logger;

    /** 登录状态变化 */
    nim.loginService?.on("loginStatus", this._onLoginStatus);
    /** 登录失败 */
    nim.loginService?.on("loginFailed", this._onLoginFailed);
    /** 被踢下线 */
    nim.loginService?.on("kickedOffline", this._onKickedOffline);
    /** 多端登录回调 */
    nim.loginService?.on("loginClientChanged", this._onLoginClientChanged);
    /** 连接状态变化 */
    nim.loginService?.on("connectStatus", this._onConnectStatus);
    /** 登录连接断开 */
    nim.loginService?.on("disconnected", this._onDisconnected);
    /** 登录连接失败 */
    nim.loginService?.on("connectFailed", this._onConnectFailed);
    /** 数据同步 */
    nim.loginService?.on("dataSync", this._onDataSync);
  }

  /** 销毁 ConnectStore，并取消相关的监听 */
  destroy(): void {
    this.nim.loginService?.off("loginStatus", this._onLoginStatus);
    this.nim.loginService?.off("loginFailed", this._onLoginFailed);
    this.nim.loginService?.off("kickedOffline", this._onKickedOffline);
    this.nim.loginService?.off(
      "loginClientChanged",
      this._onLoginClientChanged
    );
    this.nim.loginService?.off("connectStatus", this._onConnectStatus);
    this.nim.loginService?.off("disconnected", this._onDisconnected);
    this.nim.loginService?.off("connectFailed", this._onConnectFailed);
    this.nim.loginService?.off("dataSync", this._onDataSync);
  }

  private _onLoginStatus(e: V2NIMLoginStatus) {
    this.logger?.log("_onLoginStatus", e);
    this.loginStatus = e;
  }

  private _onLoginFailed(e: V2NIMError) {
    this.logger?.log("_onLoginFailed", e);
  }

  private _onKickedOffline(e: V2NIMKickedOfflineDetail) {
    this.logger?.log("_onKickedOffline", e);
  }

  private _onLoginClientChanged(e: V2NIMLoginClientChange) {
    this.logger?.log("_onLoginClientChanged", e);
  }

  private _onConnectStatus(e: V2NIMConnectStatus) {
    this.logger?.log("_onConnectStatus", e);
    this.connectStatus = e;
    // SDK 暂不支持自定义推送相关
    // if (e === V2NIMConnectStatus.V2NIM_CONNECT_STATUS_CONNECTED) {
    //   // 重连时需要重置其他人的登录状态
    //   this.rootStore.eventStore.stateMap.clear()
    // }

    // 同步完成之前需先清理下上次的在线离线状态，避免断开网络 好友退出登录 联网查看好友状态不对。只有在线离线需要处理，因为其他的都会在断网重连后触发其他事件，就在线离线不会触发
    // 注意这里必须同步前重置，否则会导致数据同步时的状态丢失
    if (e === V2NIMConst.V2NIMConnectStatus.V2NIM_CONNECT_STATUS_CONNECTED) {
      this.rootStore.subscriptionStore.resetState();
    }
  }

  private _onDisconnected(e: V2NIMError | null) {
    this.logger?.log("_onDisconnected", e);
  }

  private _onConnectFailed(e: V2NIMError) {
    this.logger?.log("_onConnectFailed", e);
  }

  private _onDataSync(
    type: V2NIMDataSyncType,
    V2NIMDataSyncState: V2NIMDataSyncState
  ) {
    this.logger?.log("_onDataSync", type, V2NIMDataSyncState);

    // 获取个人信息
    this.rootStore.userStore.getMyUserInfoActive();

    // 获取黑名单列表
    this.rootStore.relationStore.getBlockListActive();
    // 获取P2P免打扰列表
    this.rootStore.relationStore.getP2PMuteListActive();

    if (this.localOptions?.enableCloudConversation) {
      // 获取云端会话列表
      this.rootStore.conversationStore?.getConversationListActive(
        0,
        this.localOptions.conversationLimit || 100
      );
    } else {
      // 获取本地会话列表
      this.rootStore.localConversationStore?.getConversationListActive(
        0,
        this.localOptions.conversationLimit || 100
      );
    }

    // 获取群组
    this.rootStore.teamStore.getJoinedTeamListActive();

    // 获取好友列表
    this.rootStore.friendStore.getFriendListActive();

    // 获取好友申请，先拉一页100条
    this.rootStore.friendStore.getAddApplicationListActive({
      status: [],
      offset: 0,
      limit: 100,
    });
    // 获取群组申请，先拉一页100条
    this.rootStore.teamStore.getTeamJoinActionInfoListActive({
      offset: 0,
      limit: 100,
    });

    // 获取 AI 机器人
    if (this.localOptions.aiVisible) {
      this.rootStore.aiUserStore.getAIUserListActive();
    }
  }
}
