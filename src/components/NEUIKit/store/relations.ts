import { V2NIMConst } from "../utils/constants";

import { makeAutoObservable } from "mobx";
import RootStore from ".";
import { V2NIMP2PMessageMuteMode, V2NIMClient } from "node-nim";
import { V2NIMUser } from "node-nim/types/v2_def/v2_nim_struct_def";
import * as storeUtils from "./utils";

/**Mobx 可观察对象，负责管理黑名单和静音列表的子store */
export class RelationStore {
  blacklist: string[] = [];
  mutes: string[] = [];
  logger: typeof storeUtils.logger | null = null;

  constructor(private rootStore: RootStore, private nim: V2NIMClient) {
    makeAutoObservable(this);
    this.logger = this.rootStore.logger;
    this._onBlockListAdded = this._onBlockListAdded.bind(this);
    this._onBlockListRemoved = this._onBlockListRemoved.bind(this);
    this._onP2PMessageMuteModeChanged =
      this._onP2PMessageMuteModeChanged.bind(this);

    /** 黑名单新增用户回调，返回新加入黑名单的用户列表。当客户端本端添加用户到黑名单，或者其他端同步添加用户到黑名单时触发该回调 */
    nim.userService?.on("blockListAdded", this._onBlockListAdded);
    /** 黑名单移除用户回调，返回移出黑名单的用户列表。当客户端本端从黑名单移除用户，或者其他端同步从黑名单移除用户时触发该回调 */
    nim.userService?.on("blockListRemoved", this._onBlockListRemoved);
    /** 单聊消息免打扰模式变更事件 */
    nim.settingService?.on(
      "p2pMessageMuteModeChanged",
      this._onP2PMessageMuteModeChanged
    );
  }

  resetState(): void {
    this.blacklist = [];
    this.mutes = [];
  }

  /**
   * 销毁RelationStore，会取消相关事件监听
   */
  destroy(): void {
    this.resetState();
    this.nim.userService?.off("blockListAdded", this._onBlockListAdded);
    this.nim.userService?.off("blockListRemoved", this._onBlockListRemoved);
    this.nim.settingService?.off(
      "p2pMessageMuteModeChanged",
      this._onP2PMessageMuteModeChanged
    );
  }
  /**
   * 内存中增加黑名单列表
   * @param accounts - 账号数组
   */
  addBlacklist(accounts: string[]): void {
    this.blacklist = [...new Set(this.blacklist.concat(accounts))];
  }
  /**
   * 内存中删除黑名单列表
   * @param accounts - 账号数组
   */
  removeBlacklist(accounts: string[]): void {
    this.blacklist = this.blacklist.filter((i) =>
      accounts.every((j) => i !== j)
    );
  }
  /**
   * 是否在黑名单列表
   */
  isInBlacklist(account: string): boolean {
    return this.blacklist.includes(account);
  }
  /**
   * 内存中增加静音列表
   * @param accounts - 账号数组
   */
  addMutes(accounts: string[]): void {
    this.mutes = [...new Set(this.mutes.concat(accounts))];
  }
  /**
   * 内存中删除静音列表
   * @param accounts - 账号数组
   */
  removeMutes(accounts: string[]): void {
    this.mutes = this.mutes.filter((i) => accounts.every((j) => i !== j));
  }

  // 获取黑名单列表
  async getBlockListActive(): Promise<string[]> {
    try {
      this.logger?.log("getBlockListActive");
      const res = await this.nim.userService?.getBlockList();

      this.addBlacklist(res as string[]);
      return res as string[];
    } catch (error) {
      this.logger?.error("getBlockListActive failed: ", error);
      throw error;
    }
  }

  // 获取P2P消息免打扰列表
  async getP2PMuteListActive(): Promise<string[]> {
    try {
      this.logger?.log("getP2PMuteListActive");
      const res = await this.nim.settingService?.getP2PMessageMuteList();

      this.addMutes(res as string[]);
      return res as string[];
    } catch (error) {
      this.logger?.error("getP2PMuteListActive failed: ", error);
      throw error;
    }
  }

  /**
   * 加入 黑名单
   * @param accountId 账号
   */
  async addUserToBlockListActive(accountId: string): Promise<void> {
    try {
      this.logger?.log("addUserToBlockListActive", accountId);
      await this.nim.userService?.addUserToBlockList(accountId);
      this.addBlacklist([accountId]);
      this.logger?.log("addUserToBlockListActive success", accountId);
    } catch (error) {
      this.logger?.error("addUserToBlockListActive failed: ", accountId, error);
      throw error;
    }
  }

  /**
   * 移除 黑名单
   * @param accountId 账号
   */
  async removeUserFromBlockListActive(accountId: string): Promise<void> {
    try {
      this.logger?.log("removeUserFromBlockListActive", accountId);
      await this.nim.userService?.removeUserFromBlockList(accountId);
      this.removeBlacklist([accountId]);
      this.logger?.log("removeUserFromBlockListActive success", accountId);
    } catch (error) {
      this.logger?.error(
        "removeUserFromBlockListActive failed: ",
        accountId,
        error
      );
      throw error;
    }
  }

  /**
   * 设置/取消 单聊（点对点）消息免打扰模式
   * @param accountId 账号
   * @param muteMode  消息免打扰模式：免打扰开启或免打扰关闭
   */
  async setP2PMessageMuteModeActive(
    accountId: string,
    muteMode: V2NIMP2PMessageMuteMode
  ): Promise<void> {
    try {
      this.logger?.log("setP2PMessageMuteModeActive", accountId, muteMode);
      await this.nim.settingService?.setP2PMessageMuteMode(accountId, muteMode);
      if (
        muteMode ===
        V2NIMConst.V2NIMP2PMessageMuteMode.V2NIM_P2P_MESSAGE_MUTE_MODE_ON
      ) {
        this.addMutes([accountId]);
      } else if (
        muteMode ===
        V2NIMConst.V2NIMP2PMessageMuteMode.V2NIM_P2P_MESSAGE_MUTE_MODE_OFF
      ) {
        this.removeMutes([accountId]);
      }

      this.logger?.log("setP2PMessageMuteModeActive success", {
        accountId,
        muteMode,
      });
    } catch (error) {
      this.logger?.error(
        "setP2PMessageMuteModeActive failed: ",
        { accountId, muteMode },
        error
      );
      throw error;
    }
  }
  /**
   * 黑名单新增用户回调，返回新加入黑名单的用户列表。当客户端本端添加用户到黑名单，或者其他端同步添加用户到黑名单时触发该回调
   */
  private _onBlockListAdded(user: V2NIMUser) {
    this.logger?.log("_onBlockListAdded", user);
    this.addBlacklist([user.accountId as string]);
  }

  /**
   * 黑名单移除用户回调，返回移出黑名单的用户列表。当客户端本端从黑名单移除用户，或者其他端同步从黑名单移除用户时触发该回调。
   */
  private _onBlockListRemoved(accountId: string) {
    this.logger?.log("_onBlockListRemoved", accountId);
    this.removeBlacklist([accountId]);
  }

  /**
   * 单聊消息免打扰模式变更事件
   */
  private _onP2PMessageMuteModeChanged(
    accountId: string,
    muteMode: V2NIMP2PMessageMuteMode
  ) {
    this.logger?.log("_onP2PMessageMuteModeChanged", accountId, muteMode);
    if (
      muteMode ===
      V2NIMConst.V2NIMP2PMessageMuteMode.V2NIM_P2P_MESSAGE_MUTE_MODE_ON
    ) {
      this.addMutes([accountId]);
    } else if (
      muteMode ===
      V2NIMConst.V2NIMP2PMessageMuteMode.V2NIM_P2P_MESSAGE_MUTE_MODE_OFF
    ) {
      this.removeMutes([accountId]);
    }
  }
}
