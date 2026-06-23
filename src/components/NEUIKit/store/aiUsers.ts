import { makeAutoObservable } from "mobx";
import { V2NIMClient } from "node-nim";
import {
  V2NIMAIModelCallContent,
  V2NIMAIModelCallResult,
  V2NIMAIUser,
  V2NIMBindUserAIBotToQrCodeParams,
  V2NIMCreateUserAIBotParams,
  V2NIMCreateUserAIBotResult,
  V2NIMDeleteUserAIBotParams,
  V2NIMProxyAIModelCallParams,
  V2NIMError,
  V2NIMGetUserAIBotListParams,
  V2NIMGetUserAIBotListResult,
  V2NIMGetUserAIBotParams,
  V2NIMRefreshUserAIBotTokenParams,
  V2NIMRefreshUserAIBotTokenResult,
  V2NIMUpdateUserAIBotParams,
  V2NIMUserAIBot,
} from "node-nim/types/v2_def/v2_nim_struct_def";
import RootStore from "./index";
import { AIUserServerExt, LocalOptions } from "./types";
import * as storeUtils from "./utils";

export class AIUserStore {
  aiUsers: Map<string, V2NIMAIUser> = new Map();
  aiBots: Map<string, V2NIMUserAIBot> = new Map();
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
    this.aiBots.clear();
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

  /** 内存中增加用户级 AI Bot */
  addAIBots(bots: V2NIMUserAIBot[]): void {
    bots
      .filter((item) => !!item.accountId)
      .forEach((item) => {
        this.aiBots.set(item.accountId, item);
      });
  }

  /** 内存中删除用户级 AI Bot */
  removeAIBots(accountIds: string[]): void {
    accountIds.forEach((accountId) => {
      this.aiBots.delete(accountId);
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
   * 判断是否用户级 AI Bot
   */
  isAIBot(accountId: string): boolean {
    return this.aiBots.has(accountId);
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
   * 创建一个用户级 AI Bot。
   */
  async createUserAIBotActive(
    params: V2NIMCreateUserAIBotParams
  ): Promise<V2NIMCreateUserAIBotResult> {
    try {
      this.logger?.log("createUserAIBotActive", params);
      const result = await this.nim.aiService?.createUserAIBot(params);

      if (!result) {
        throw new Error("createUserAIBot failed");
      }

      const bot = await this.nim.aiService?.getUserAIBot({
        accountId: params.accountId,
      });

      this.addAIBots([
        {
          ...bot,
          accountId: bot?.accountId || params.accountId,
          name: bot?.name || params.name,
          avatar: bot?.avatar || params.avatar,
        },
      ]);

      this.logger?.log("createUserAIBotActive success:", bot);
      return result;
    } catch (error) {
      this.logger?.error("createUserAIBotActive failed:", error as V2NIMError);
      throw error;
    }
  }

  /**
   * 分页查询当前用户的 AI Bot 列表。
   */
  async getUserAIBotListActive(
    params?: V2NIMGetUserAIBotListParams
  ): Promise<V2NIMGetUserAIBotListResult> {
    try {
      this.logger?.log("getUserAIBotListActive", params);
      const result = await this.nim.aiService?.getUserAIBotList(params);

      if (!result) {
        return {
          bots: [],
          hasMore: false,
        };
      }

      this.addAIBots(result.bots);
      this.logger?.log("getUserAIBotListActive success:", result);
      return result;
    } catch (error) {
      this.logger?.error("getUserAIBotListActive failed:", error as V2NIMError);
      throw error;
    }
  }

  /**
   * 查询单个用户级 AI Bot 详情。
   */
  async getUserAIBotActive(params: V2NIMGetUserAIBotParams): Promise<V2NIMUserAIBot> {
    try {
      this.logger?.log("getUserAIBotActive", params);
      const result = await this.nim.aiService?.getUserAIBot(params);

      if (!result) {
        throw new Error("getUserAIBot failed");
      }

      this.addAIBots([result]);
      this.logger?.log("getUserAIBotActive success:", result);
      return result;
    } catch (error) {
      this.logger?.error("getUserAIBotActive failed:", error as V2NIMError);
      throw error;
    }
  }

  /**
   * 更新一个用户级 AI Bot。
   */
  async updateUserAIBotActive(params: V2NIMUpdateUserAIBotParams): Promise<void> {
    try {
      this.logger?.log("updateUserAIBotActive", params);
      await this.nim.aiService?.updateUserAIBot(params);
      const bot = await this.nim.aiService?.getUserAIBot({
        accountId: params.accountId,
      });

      if (bot) {
        this.addAIBots([bot]);
        this.updateAIBotConversationProfile(bot);
      }

      this.logger?.log("updateUserAIBotActive success:", params);
    } catch (error) {
      this.logger?.error("updateUserAIBotActive failed:", error as V2NIMError);
      throw error;
    }
  }

  private updateAIBotConversationProfile(bot: V2NIMUserAIBot): void {
    const accountId = bot.accountId;
    if (!accountId) {
      return;
    }

    const conversationId =
      this.nim.conversationIdUtil?.p2pConversationId(accountId) || "";
    if (!conversationId) {
      return;
    }

    const profile = {
      name: bot.name,
      avatar: bot.avatar,
    };

    const conversation =
      this.rootStore.conversationStore?.conversations.get(conversationId);
    if (conversation) {
      this.rootStore.conversationStore?.updateConversation([
        {
          ...conversation,
          ...profile,
        },
      ]);
    }

    const localConversation =
      this.rootStore.localConversationStore?.conversations.get(conversationId);
    if (localConversation) {
      this.rootStore.localConversationStore?.updateConversation([
        {
          ...localConversation,
          ...profile,
        },
      ]);
    }
  }

  /**
   * 删除一个用户级 AI Bot。
   */
  async deleteUserAIBotActive(params: V2NIMDeleteUserAIBotParams): Promise<void> {
    try {
      this.logger?.log("deleteUserAIBotActive", params);
      await this.nim.aiService?.deleteUserAIBot(params);
      this.removeAIBots([params.accountId]);
      this.logger?.log("deleteUserAIBotActive success:", params);
    } catch (error) {
      this.logger?.error("deleteUserAIBotActive failed:", error as V2NIMError);
      throw error;
    }
  }

  /**
   * 刷新用户级 AI Bot 的登录 token。
   */
  async refreshUserAIBotTokenActive(
    params: V2NIMRefreshUserAIBotTokenParams
  ): Promise<V2NIMRefreshUserAIBotTokenResult> {
    try {
      this.logger?.log("refreshUserAIBotTokenActive", params);
      const result = await this.nim.aiService?.refreshUserAIBotToken(params);

      if (!result) {
        throw new Error("refreshUserAIBotToken failed");
      }

      this.logger?.log("refreshUserAIBotTokenActive success:", result);
      return result;
    } catch (error) {
      this.logger?.error("refreshUserAIBotTokenActive failed:", error as V2NIMError);
      throw error;
    }
  }

  /**
   * 通过二维码绑定用户级 AI Bot。
   */
  async bindUserAIBotToQrCodeActive(
    params: V2NIMBindUserAIBotToQrCodeParams
  ): Promise<void> {
    try {
      this.logger?.log("bindUserAIBotToQrCodeActive", params);
      await this.nim.aiService?.bindUserAIBotToQrCode(params);
      this.logger?.log("bindUserAIBotToQrCodeActive success:", params);
    } catch (error) {
      this.logger?.error("bindUserAIBotToQrCodeActive failed:", error as V2NIMError);
      throw error;
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
