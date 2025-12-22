import { makeAutoObservable } from "mobx";
import RootStore from ".";
import { AT_ALL_ACCOUNT } from "./constant";
import { V2NIMClient } from "node-nim";
import { V2NIMConst } from "../utils/constants";

import { V2NIMConversationType } from "node-nim";
import {
  V2NIMConversation,
  V2NIMConversationResult,
  V2NIMError,
  V2NIMMessage,
  V2NIMP2PMessageReadReceipt,
  V2NIMMessageTeamNotificationAttachment,
} from "node-nim/types/v2_def/v2_nim_struct_def";
import { V2NIMConversationForUI, YxServerExt } from "./types";
import * as storeUtils from "./utils";

/**Mobx 可观察对象，负责管理会话列表的子 store */
export class ConversationStore {
  conversations: Map<string, V2NIMConversationForUI> = new Map();
  totalUnreadCount = 0;
  logger: typeof storeUtils.logger | null = null;

  constructor(private rootStore: RootStore, private nim: V2NIMClient) {
    makeAutoObservable(this);

    this._onSyncStarted = this._onSyncStarted.bind(this);
    this._onSyncFinished = this._onSyncFinished.bind(this);
    this._onSyncFailed = this._onSyncFailed.bind(this);
    this._onConversationCreated = this._onConversationCreated.bind(this);
    this._onConversationDeleted = this._onConversationDeleted.bind(this);
    this._onConversationChanged = this._onConversationChanged.bind(this);
    this._onTotalUnreadCountChanged =
      this._onTotalUnreadCountChanged.bind(this);
    this.logger = rootStore.logger;

    /** 数据同步开始 */
    nim.conversationService?.on("syncStarted", this._onSyncStarted);
    /** 数据同步结束 */
    nim.conversationService?.on("syncFinished", this._onSyncFinished);
    /** 数据同步失败 */
    nim.conversationService?.on("syncFailed", this._onSyncFailed);
    /** 会话创建 */
    nim.conversationService?.on(
      "conversationCreated",
      this._onConversationCreated
    );
    /** 会话删除 */
    nim.conversationService?.on(
      "conversationDeleted",
      this._onConversationDeleted
    );
    /** 会话更新 */
    nim.conversationService?.on(
      "conversationChanged",
      this._onConversationChanged
    );
    /** 会话总未读数变化 */
    nim.conversationService?.on(
      "totalUnreadCountChanged",
      this._onTotalUnreadCountChanged
    );
  }

  resetState(): void {
    this.logger?.log("Conversation resetState");
    this.conversations.clear();
    this.totalUnreadCount = 0;
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.resetState();
    this.nim.conversationService?.off("syncStarted", this._onSyncStarted);
    this.nim.conversationService?.off("syncFinished", this._onSyncFinished);
    this.nim.conversationService?.off("syncFailed", this._onSyncFailed);
    this.nim.conversationService?.off(
      "conversationCreated",
      this._onConversationCreated
    );
    this.nim.conversationService?.off(
      "conversationDeleted",
      this._onConversationDeleted
    );
    this.nim.conversationService?.off(
      "conversationChanged",
      this._onConversationChanged
    );
    this.nim.conversationService?.off(
      "totalUnreadCountChanged",
      this._onTotalUnreadCountChanged
    );
  }

  /**
   * 添加内存中的会话
   * @param conversations 会话数组
   */
  addConversation(conversations: V2NIMConversationForUI[]): void {
    conversations
      .filter((item) => !!item.conversationId)
      // 暂时仅支持 p2p 和 team
      .filter((item) =>
        [
          V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P,
          V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM,
        ].includes(item.type as V2NIMConversationType)
      )
      .forEach(async (item) => {
        const oldConversation = this.conversations.get(
          item.conversationId || ""
        );

        // 先更新一次
        this.conversations.set(item.conversationId || "", {
          ...oldConversation,
          ...item,
        });
        // // 判断是否需要展示@消息
        // const needShowBeMentioned = await this._needShowBeMentioned(
        //   item,
        //   oldConversation
        // )
        // 异步处理之后，数据可能发生改变，因此重新获取一次会话
        // const newConversation = this.conversations.get(item.conversationId)

        // if (newConversation) {
        //   this.conversations.set(item.conversationId, {
        //     ...newConversation,
        //   })
        // }
      });
  }

  /**
   * 更新内存中的会话
   * @param conversations 会话数组
   */
  updateConversation(conversations: V2NIMConversationForUI[]): void {
    conversations
      .filter((item) => !!item.conversationId)
      // 暂时仅支持 p2p 和 team
      .filter((item) =>
        [
          V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P,
          V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM,
        ].includes(item.type as V2NIMConversationType)
      )
      .forEach((item) => {
        const oldConversation = this.conversations.get(
          item.conversationId || ""
        );

        this.conversations.set(item.conversationId || "", {
          ...oldConversation,
          ...item,
        });
      });
  }

  /**
   * 移除内存中的会话
   * @param conversationId 会话ID
   */
  removeConversation(conversationIds: string[]): void {
    conversationIds.forEach((item) => {
      this.conversations.delete(item);
      if (this.rootStore.uiStore.selectedConversation === item) {
        this.rootStore.uiStore.unselectConversation();
      }
    });
  }

  /**
   * 重置会话未读数
   * @param conversationId - 消息所属的会话的ID
   */
  async resetConversation(conversationId: string): Promise<void> {
    this.logger?.log("resetConversation", conversationId);
    const conversation = this.conversations.get(conversationId);

    if (!conversation) {
      this.logger?.warn(
        "resetConversation: conversation is not found.",
        conversationId
      );
      return;
    }

    try {
      if (conversation.unreadCount) {
        // 请求前也清理一次会话未读数，fix http://jira.netease.com/browse/YYTX-34326
        this._resetMemoryConversationUnreadCount(conversation);
        await this.nim.conversationService?.clearUnreadCountByIds([
          conversation.conversationId || "",
        ]);
        this._resetMemoryConversationUnreadCount(conversation);
      }

      this.logger?.log("resetConversation success");
    } catch (error) {
      this.logger?.error("resetConversation failed: ", error);
      throw error;
    }
  }

  /**
   * 插入一条会话记录
   * @param conversationType
   * @param receiverId - 接收方, 对方帐号或者群id
   * @param isSelected - 是否选中
   */
  async insertConversationActive(
    conversationType: V2NIMConversationType,
    receiverId: string,
    isSelected = true
  ): Promise<void> {
    try {
      this.logger?.log("insertConversationActive", {
        conversationType,
        receiverId,
        isSelected,
      });
      let conversationId = "";

      if (
        conversationType ===
        V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P
      ) {
        conversationId =
          this.nim.conversationIdUtil?.p2pConversationId(receiverId) || "";
      } else if (
        conversationType ===
        V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM
      ) {
        conversationId =
          this.nim.conversationIdUtil?.teamConversationId(receiverId) || "";
      } else {
        throw new Error("Unsupported conversation type");
      }

      if (!this.conversations.has(conversationId)) {
        const conversation =
          await this.nim.conversationService?.createConversation(
            conversationId || ""
          );

        this.addConversation([conversation || {}]);
      }

      if (isSelected) {
        await this.rootStore.uiStore.selectConversation(conversationId || "");
      }

      this.logger?.log("insertConversationActive success", {
        conversationType,
        receiverId,
        isSelected,
      });
    } catch (error) {
      this.logger?.error(
        "insertConversationActive failed: ",
        { conversationType, receiverId, isSelected },
        error
      );
      throw error;
    }
  }

  /**
   * 删除会话记录
   * @param conversationId - 消息所属的会话的ID
   */
  async deleteConversationActive(conversationId: string): Promise<void> {
    try {
      this.logger?.log("deleteConversationActive", conversationId);
      // 先取消下置顶
      try {
        await this.stickTopConversationActive(conversationId, false);
      } catch (error) {
        // 忽略这个错误，因为有可能会话不存在等原因导致接口报错
        this.logger?.warn(
          "deleteConversationActive failed but continue: ",
          error
        );
      }

      // 先进行云端删除
      await this.nim.conversationService?.deleteConversation(
        conversationId || "",
        false
      );
      // 云端删除成功后再移除内存
      this.removeConversation([conversationId]);
      this.logger?.log("deleteConversationActive success");
    } catch (error) {
      this.logger?.warn("deleteConversationActive failed", error);
      throw error as Error;
    }
  }

  /**
   * 新增会话置顶
   * @param conversationId - 消息所属的会话的ID
   * @param stickTop - 是否置顶
   */
  async stickTopConversationActive(
    conversationId: string,
    stickTop: boolean
  ): Promise<void> {
    try {
      this.logger?.log("stickTopConversationActive", conversationId, stickTop);
      await this.nim.conversationService?.stickTopConversation(
        conversationId || "",
        stickTop
      );
      this.logger?.log("stickTopConversationActive success");
    } catch (error) {
      this.logger?.error("stickTopConversationActive failed: ", error);
      throw error;
    }
  }

  /**
   * 获取会话列表
   * @param offset 分页偏移量
   * @param limit 分页拉取数量
   */
  async getConversationListActive(
    offset: number,
    limit: number
  ): Promise<V2NIMConversationResult> {
    try {
      this.logger?.log("getConversationListActive", offset, limit);

      if (!this.nim.conversationService) {
        return {
          conversationList: [],
        };
      }
      const res: V2NIMConversationResult =
        await this.nim.conversationService.getConversationList(offset, limit);

      this.addConversation(res.conversationList || []);

      // 当从起点刷新列表时，移除当前内存中不在服务器返回首屏中的会话，避免显示已删除的会话
      if (offset === 0) {
        const serverIds = new Set(
          (res.conversationList || [])
            .map((item: V2NIMConversation) => item.conversationId || "")
            .filter((id) => !!id)
        );
        const staleIds: string[] = [];
        this.conversations.forEach((_, id) => {
          if (!serverIds.has(id)) {
            staleIds.push(id);
          }
        });
        if (staleIds.length) {
          this.removeConversation(staleIds);
        }
      }

      // 过滤掉已解散或无效的群聊会话：当团队不存在或无效时，移除对应会话
      const invalidTeamConvIds: string[] = (res.conversationList || [])
        .filter(
          (item: V2NIMConversation) =>
            item.type ===
            V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM
        )
        .map((item: V2NIMConversation) => {
          const teamId =
            this.nim.conversationIdUtil?.parseConversationTargetId(
              item.conversationId || ""
            ) || "";
          const team = this.rootStore.teamStore.teams.get(teamId);
          return !team || !team.isValidTeam ? item.conversationId || "" : "";
        })
        .filter((id: string) => !!id);

      if (invalidTeamConvIds.length) {
        this.removeConversation(invalidTeamConvIds);
      }

      await this.getP2PMessageReceipt(
        (res.conversationList || [])
          .filter(
            (item: V2NIMConversation) =>
              item.type ===
              V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P
          )
          .map((item) => item.conversationId || "")
      );
      this.logger?.log("getConversationListActive success", offset, limit, res);
      return res;
    } catch (error) {
      this.logger?.error(
        "getConversationListActive failed: ",
        error,
        offset,
        limit
      );
      throw error;
    }
  }

  async getP2PMessageReceipt(
    conversationIds: string[]
  ): Promise<V2NIMP2PMessageReadReceipt[]> {
    try {
      this.logger?.log("getP2PMessageReceipt", conversationIds);
      const res = await Promise.all(
        conversationIds.map((item) =>
          this.nim?.messageService?.getP2PMessageReceipt(item || "")
        )
      );
      const conversations = res
        .map((item: any) => {
          const conversation = this.conversations.get(
            item?.conversationId || ""
          );

          if (conversation) {
            return {
              ...conversation,
              // todo 替换为相应字段
              // @ts-ignore
              msgReceiptTime: item.timestamp,
            };
          }
        })
        .filter((item: any) => !!item) as V2NIMConversationForUI[];

      this.updateConversation(conversations);

      this.logger?.log("getP2PMessageReceipt success", conversationIds, res);
      return res as V2NIMP2PMessageReadReceipt[];
    } catch (error) {
      this.logger?.error(
        "getP2PMessageReceipt failed: ",
        error,
        conversationIds
      );
      throw error;
    }
  }

  private _resetMemoryConversationUnreadCount(
    conversation: V2NIMConversationForUI
  ): void {
    const newConversation = this.conversations.get(
      conversation?.conversationId || ""
    );

    if (newConversation) {
      this.updateConversation([{ ...newConversation, unreadCount: 0 }]);
    }
  }

  /**
   * 获取会话已读时间戳。该时间包含多端已读时间戳
   */
  async getConversationReadTimeActive(conversationId: string): Promise<number> {
    try {
      this.logger?.log("getConversationReadTimeActive", conversationId);

      if (!this.nim.conversationService?.getConversationReadTime) {
        throw new Error(
          "getConversationReadTimeActive failed: conversationService is not available"
        );
      }

      const res = await this.nim.conversationService.getConversationReadTime(
        conversationId
      );

      this.logger?.log(
        "getConversationReadTimeActive success",
        conversationId,
        res
      );
      return res as number;
    } catch (error) {
      this.logger?.error(
        "getConversationReadTimeActive failed: ",
        error,
        conversationId
      );
      throw error;
    }
  }

  /**
   * 标记会话已读时间戳
   *
   * 注: 当该方法调用后，SDK 可能给多端账户抛出以下的事件
   *
   * {@link V2NIMConversationListener.onConversationReadTimeUpdated | V2NIMConversationListener.onConversationReadTimeUpdated} <br/>
   *
   */
  async markConversationReadActive(conversationId: string): Promise<number> {
    try {
      this.logger?.log("markConversationReadActive", conversationId);

      if (!this.nim.conversationService?.markConversationRead) {
        throw new Error(
          "markConversationReadActive failed: conversationService is not available"
        );
      }

      const res = await this.nim.conversationService.markConversationRead(
        conversationId
      );

      this.logger?.log(
        "markConversationReadActive success",
        conversationId,
        res
      );
      return res as number;
    } catch (error) {
      this.logger?.error(
        "markConversationReadActive failed: ",
        error,
        conversationId
      );
      throw error;
    }
  }
  /**
   * 处理会话中的@ 消息
   */

  handleConversationWithAit(msgs: V2NIMMessage[]): void {
    msgs.map(async (item) => {
      if (
        item.conversationType ===
          V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM ||
        item.conversationType ===
          V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_SUPER_TEAM
      ) {
        if (item?.serverExtension) {
          const hasAitMsg = this.hasAitMsg([item.serverExtension]);
          const conversationReadTime = await this.getConversationReadTimeActive(
            item?.conversationId || ""
          );
          const isCurConversation =
            item.conversationId == this.rootStore.uiStore.selectedConversation;

          const isSendFromMe =
            item.senderId === this.rootStore.userStore.myUserInfo?.accountId;

          // 当前通过_onReceiveMessages获取的新消息时间戳大于会话的最后已读时间戳，且有@消息，且没有选中当前该会话，则标记为已读
          if (
            item.createTime &&
            item.createTime > conversationReadTime &&
            hasAitMsg &&
            !isCurConversation &&
            !isSendFromMe
          ) {
            const conversation = this.conversations.get(
              item?.conversationId || ""
            );

            // 如果此时conversation为空，则可能的情况为，该用户删除了该会话后，又收到了@消息（onReceiveMessages会先于onConversationCreated触发），此时需要在onConversationCreated处理@消息相关
            if (conversation) {
              const aitMsgs = conversation.aitMsgs || [];

              if (aitMsgs.length === 0) {
                this.updateConversation([
                  { ...conversation, aitMsgs: [item?.messageClientId || ""] },
                ]);
              } else {
                this.updateConversation([
                  {
                    ...conversation,
                    aitMsgs: [...aitMsgs, item?.messageClientId || ""],
                  },
                ]);
              }
            }
          }
        }
      }
    });
  }

  /**
   * 重置会话中的@ 消息
   */
  resetConversationAit(conversationId: string): void {
    const conversation = this.conversations.get(conversationId);

    if (
      conversation?.type ===
        V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM ||
      conversation?.type ===
        V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_SUPER_TEAM
    ) {
      this.updateConversation([
        {
          ...conversation,
          aitMsgs: [],
        },
      ]);
    }
  }

  private hasAitMsg(serverExtensions: string[]): boolean {
    let flag = false;

    if (serverExtensions?.length) {
      serverExtensions?.forEach((item) => {
        try {
          const extObj: YxServerExt = JSON.parse(item || "{}");
          const yxAitMsg = extObj.yxAitMsg;
          const account = this.rootStore.userStore.myUserInfo.accountId;

          if (yxAitMsg) {
            Object.keys(yxAitMsg)?.forEach((key) => {
              if (key === account || key === AT_ALL_ACCOUNT) {
                flag = true;
              }
            });
          }
        } catch {
          this.logger?.error("parse serverExtension failed: ", item);
        }
      });
    }

    return flag;
  }

  private _onSyncStarted() {
    this.logger?.log("_onSyncStarted");
    // 获取会话列表
    this.rootStore.conversationStore?.getConversationListActive(
      0,
      this.rootStore.localOptions.conversationLimit || 100
    );
    this.logger?.log("_onSyncFinished");
  }

  private async _onSyncFinished() {
    // 获取会话列表
    this.rootStore.conversationStore?.getConversationListActive(
      0,
      this.rootStore.localOptions.conversationLimit || 100
    );
    this.logger?.log("_onSyncFinished");
  }

  private _onSyncFailed(e: V2NIMError) {
    this.logger?.log("_onSyncFailed", e);
  }

  private _onConversationCreated(data: V2NIMConversationForUI) {
    this.logger?.log("_onConversationCreated", data);
    // 如果是创群，此时_onConversationCreated 返回的data可能没有avatar和name，需要getConversation
    if (
      data.type ===
      V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM
    ) {
      this.nim.conversationService
        ?.getConversation(data.conversationId || "")
        .then((conversation) => {
          this.addConversation([conversation]);
          // 处理@消息 情况为
          if (conversation.lastMessage) {
            this.handleConversationWithAit([
              // 该用户删除了该会话后，又收到了@消息，此时需要在onConversationCreated处理@消息相关
              {
                ...conversation.lastMessage,
                ...conversation.lastMessage.messageRefer,
              },
            ]);
          }
        });
    } else {
      this.addConversation([data]);
      // 会话创建的时候，获取一下当前会话的最后已读时间，便于展示消息已读未读
      if (
        data.type ===
        V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P
      ) {
        const conversationId = data.conversationId;

        this.nim?.messageService
          ?.getP2PMessageReceipt(conversationId || "")
          .then((res) => {
            const conversation = this.conversations.get(conversationId || "");

            if (conversation) {
              this.updateConversation([
                {
                  ...conversation,
                  msgReceiptTime: res.timestamp,
                },
              ]);
            }
          });
      }
    }
  }

  private _onConversationDeleted(conversationIds: string[]) {
    this.logger?.log("_onConversationDeleted", conversationIds);
    this.removeConversation(conversationIds);
  }

  private async _onConversationChanged(data: V2NIMConversationForUI[]) {
    this.logger?.log("_onConversationChanged", data);
    this.addConversation(data);
    data.forEach(async (item) => {
      const attachment = item.lastMessage
        ?.attachment as unknown as V2NIMMessageTeamNotificationAttachment;
      // 处理下退出群聊和解散群聊的情况
      const type = attachment?.type;

      if (
        item.lastMessage?.messageType ===
          V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_NOTIFICATION &&
        ((type ===
          V2NIMConst.V2NIMMessageNotificationType
            .V2NIM_MESSAGE_NOTIFICATION_TYPE_TEAM_LEAVE &&
          item.lastMessage?.messageRefer?.senderId ===
            this.rootStore.userStore.myUserInfo.accountId) ||
          type ===
            V2NIMConst.V2NIMMessageNotificationType
              .V2NIM_MESSAGE_NOTIFICATION_TYPE_TEAM_DISMISS)
      ) {
        await this.deleteConversationActive(item.conversationId || "");
      } else if (
        this.rootStore.uiStore.selectedConversation === item.conversationId ||
        this.rootStore.uiStore.selectedConversation === item.conversationId ||
        ""
      ) {
        await this.resetConversation(item.conversationId || "");
      }

      if (
        item.type ===
          V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM &&
        item.unreadCount == 0
      ) {
        this.resetConversationAit(item.conversationId || "");
      }
    });
  }

  private _onTotalUnreadCountChanged(data: number) {
    this.logger?.log("_onTotalUnreadCountChanged", data);
    this.totalUnreadCount = data;
  }
}
