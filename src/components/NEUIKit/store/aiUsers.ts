import { makeAutoObservable } from "mobx";
import { V2NIMClient } from "node-nim";
import {
  V2NIMAIModelCallContent,
  V2NIMAIModelCallResult,
  V2NIMAIUser,
  V2NIMProxyAIModelCallParams,
  V2NIMError,
} from "node-nim/types/v2_def/v2_nim_struct_def";
import RootStore from "./index";
import { AIUserServerExt, LocalOptions } from "./types";
import * as storeUtils from "./utils";

export class AIUserStore {
  aiUsers: Map<string, V2NIMAIUser> = new Map();
  aiReqMsgs: V2NIMAIModelCallContent[] = [];
  aiResMsgs: string[] = [];
  logger: typeof storeUtils.logger | null = null;

  onSendAIProxyErrorHandler: (errorCode: number) => void = () => {
    //
  };

  private requestIds: string[] = [];
  private proxyAccountId: string = "";

  constructor(
    private rootStore: RootStore,
    private nim: V2NIMClient,
    private localOptions: LocalOptions
  ) {
    makeAutoObservable(this);
    this.logger = rootStore.logger;

    this._onProxyAIModelCall = this._onProxyAIModelCall.bind(this);

    this.nim.aiService?.on("proxyAIModelCall", this._onProxyAIModelCall);
  }

  get aiProxying() {
    return this.aiReqMsgs.length > this.aiResMsgs.length;
  }

  resetState(): void {
    this.aiUsers.clear();
    this.aiReqMsgs = [];
    this.aiResMsgs = [];
  }

  /**
   * 销毁 AIUserStore，会取消相关事件监听
   */
  destroy(): void {
    this.resetState();
    this.nim.aiService?.off("proxyAIModelCall", this._onProxyAIModelCall);
  }

  /** 内存中增加 AIUsers */
  addAIUsers(aiUsers: V2NIMAIUser[]): void {
    aiUsers
      .filter((item) => !!item.accountId)
      .forEach((item) => {
        this.aiUsers.set(item.accountId || "", item);
      });
  }

  /** 内存中删除 AIUsers */
  removeAIUsers(accounts: string[]): void {
    accounts.forEach((item) => {
      this.aiUsers.delete(item);
    });
  }

  /**
   * 获取 AIUsers
   */
  getAIUserList(accountIds?: string[]): V2NIMAIUser[] {
    const aiUsers = [...this.aiUsers.values()];

    const sortHandler = (a: V2NIMAIUser, b: V2NIMAIUser) =>
      (b.createTime || 0) - (a?.createTime || 0);

    if (accountIds && accountIds.length) {
      return aiUsers
        .filter((item) => accountIds.includes(item.accountId || ""))
        .sort(sortHandler);
    }

    return aiUsers.sort(sortHandler);
  }

  /**
   * 获取 AI 划词数字人
   */
  getAISearchUser(): V2NIMAIUser | void {
    const aiUsers = this.getAIUserList();

    return this.localOptions.aiUserAgentProvider?.getAISearchUser?.(aiUsers);
  }

  /**
   * 获取 AI 翻译数字人
   */
  getAITranslateUser(): V2NIMAIUser | void {
    const aiUsers = this.getAIUserList();

    return this.localOptions.aiUserAgentProvider?.getAITranslateUser?.(aiUsers);
  }

  /**
   * 获取 AI 翻译语言
   */
  getAITranslateLangs(): string[] {
    const aiUsers = this.getAIUserList();

    return (
      this.localOptions.aiUserAgentProvider?.getAITranslateLangs?.(aiUsers) ||
      []
    );
  }

  /**
   * 获取 AI 数字人的 serverExtension
   */
  getAIUserServerExt(accountId: string): AIUserServerExt {
    const aiUser = this.aiUsers.get(accountId);

    if (!aiUser) {
      return {};
    }

    try {
      return JSON.parse(aiUser.serverExtension || "{}");
    } catch {
      return {};
    }
  }

  /**
   * 获取 AI 聊数字人，AI 聊是指可以被 @ 的数字人
   */
  getAIChatUser(): V2NIMAIUser[] {
    const aiUsers = this.getAIUserList();

    return aiUsers.filter((item) => {
      const serverExt = this.getAIUserServerExt(item.accountId || "");

      return serverExt.aiChat === 1;
    });
  }

  /**
   * 获取配置过默认置顶的数字人，仅代表配置过，不代表当前置顶
   */
  getAIPinDefaultUser(): V2NIMAIUser[] {
    const aiUsers = this.getAIUserList();

    return aiUsers.filter((item) => {
      const serverExt = this.getAIUserServerExt(item.accountId || "");

      return serverExt.pinDefault === 1;
    });
  }

  /**
   * 获取当前置顶的数字人
   */
  getAIPinUser(): V2NIMAIUser[] {
    const myUserServerExt = this.rootStore.userStore.getMyUserServerExt();

    return this.getAIPinDefaultUser().filter((item) => {
      return !myUserServerExt.unpinAIUsers?.includes(item.accountId || "");
    });
  }

  /**
   * 判断一个数字人是否 pin 置顶
   */
  isAIPinUser(accountId: string): boolean {
    return this.getAIPinUser().some((item) => item.accountId === accountId);
  }

  /**
   * 判断是否正在 AI 划词中
   */
  isAISearching(): boolean {
    return this.proxyAccountId === this.getAISearchUser()?.accountId;
  }

  /**
   * 判断是否正在 AI 翻译中
   */
  isAITranslating(): boolean {
    return this.proxyAccountId === this.getAITranslateUser()?.accountId;
  }
  /**
   * 判断是否AI数字人
   */
  isAIUser(accountId: string): boolean {
    return this.aiUsers.has(accountId);
  }

  /**
   * 重置 AI 代理状态
   */
  resetAIProxy(): void {
    this.requestIds = [];
    this.aiReqMsgs = [];
    this.aiResMsgs = [];
    this.proxyAccountId = "";
    this.onSendAIProxyErrorHandler = () => {
      //
    };
  }

  /**
   * 从 sdk 获取 AI 数字人列表并维护到内存中
   */
  async getAIUserListActive(): Promise<void> {
    try {
      this.logger?.log("getAIUserListActive");
      const aiUsers = await this.nim?.aiService?.getAIUserList();
      if (aiUsers) {
        this.addAIUsers(aiUsers);
      }
      this.logger?.log("getAIUserListActive success:", aiUsers);
    } catch (error) {
      // 未开通ai聊功能的 此处不需要报错
      this.logger?.log("getAIUserListActive failed:", error);
    }
  }

  /**
   * 发送 AI 代理请求
   * @params requestId 请求 ID，用于区分不同的请求，传就表示新的请求，不传表示继续上次的请求
   */
  async sendAIProxyActive(
    params: Omit<V2NIMProxyAIModelCallParams, "requestId"> & {
      requestId?: string;
      onSendAIProxyErrorHandler?: (errorCode: number) => void;
    }
  ): Promise<void> {
    try {
      this.logger?.log("sendAIProxyActive", params);

      const finalParams = { ...params };

      // 表示新的请求，重置 requestId、aiResMsgs、proxyAccountId
      if (params.requestId) {
        this.resetAIProxy();
        this.requestIds.push(params.requestId);
        this.proxyAccountId = params.accountId || "";
      } else {
        finalParams.requestId = Math.random().toString(36).slice(2);
        this.requestIds.push(finalParams.requestId);
      }

      if (params.onSendAIProxyErrorHandler) {
        this.onSendAIProxyErrorHandler = params.onSendAIProxyErrorHandler;
      }

      await this.nim.aiService?.proxyAIModelCall(
        finalParams as V2NIMProxyAIModelCallParams
      );

      this.aiReqMsgs.push(params.content as V2NIMAIModelCallContent);
      this.logger?.log("sendAIProxyActive success:", params);
    } catch (error) {
      this.logger?.error("sendAIProxyActive failed:", error as V2NIMError);
      this.onSendAIProxyErrorHandler((error as V2NIMError).code as number);
      throw error;
    }
  }

  private _onProxyAIModelCall(res: V2NIMAIModelCallResult) {
    this.logger?.log("_onProxyAIModelCall", res);
    if (this.requestIds.includes(res.requestId || "")) {
      if (res.code === 200) {
        if (res?.content?.msg) {
          this.aiResMsgs.push(res?.content?.msg);
        }
      } else {
        this.aiReqMsgs.pop();
        this.onSendAIProxyErrorHandler(res.code as number);
      }
    }
  }
}
