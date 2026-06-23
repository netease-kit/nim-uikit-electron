import { makeAutoObservable, runInAction } from "mobx";
import RootStore from ".";
import { V2NIMClient, V2NIMQueryDirection, V2NIMSortOrder } from "node-nim";
import {
  V2NIMMessage,
  V2NIMMessageFileAttachment,
  V2NIMMessageRefer,
  V2NIMMessageRevokeNotification,
  V2NIMMessageDeletedNotification,
  V2NIMTopic,
  V2NIMTopicRefer,
} from "node-nim/types/v2_def/v2_nim_struct_def";
import { formatDate } from "../utils/date";
import { t } from "../utils/i18n";
import { V2NIMConst } from "../utils/constants";
import { isMessageNoError } from "../utils/msg";
import {
  TopicConversationState,
  TopicFirstMessageDraftState,
  TopicRowForUI,
  TopicSelectedState,
  TopicSendOptions,
  TopicSummaryState,
  V2NIMMessageForUI,
} from "./types";
import * as storeUtils from "./utils";
import { RECALL_TIME } from "./constant";

const TOPIC_LIST_LIMIT = 15;
const TOPIC_MESSAGE_LIMIT = 15;
const TOPIC_CONVERSATION_CACHE_LIMIT = 10;
const TOPIC_LIST_MAX_COUNT = 500;

const createEmptySelected = (): TopicSelectedState => ({ type: "none" });

const createConversationState = (conversationId: string): TopicConversationState => ({
  conversationId,
  topics: new Map(),
  topicList: [],
  topicRows: [],
  order: [],
  hasMore: false,
  nextToken: "",
  loading: false,
  loadingMore: false,
  loaded: false,
  selected: createEmptySelected(),
  summaries: new Map(),
  messages: new Map(),
  firstMessageDrafts: new Map(),
  messageLoading: new Map(),
  messageLoadingMore: new Map(),
  messageHasMore: new Map(),
  messageAnchor: new Map(),
  messageError: new Map(),
  readTime: 0,
  empty: false,
});

type TopicSendFailureError = Error & {
  code?: number;
  failedMessage?: V2NIMMessageForUI;
};

const toError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === "string" ? error : JSON.stringify(error));
};

const getTopicKey = (topic: V2NIMTopic): string => topic.topicId || "";

const getTempTopicId = (messageClientId?: string): string => {
  return messageClientId || `temp-topic-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const truncateByChars = (value: string, maxLength: number): string => {
  return Array.from(value).slice(0, maxLength).join("");
};

const getDraftTopicName = (message: V2NIMMessage): string => {
  switch (message.messageType) {
    case V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT:
      return truncateByChars(message.text || t("topicSubsessionDefaultTitle"), 20);
    case V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_IMAGE:
      return `[${t("imgMsgText")}]`;
    case V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_FILE:
      return `[${t("fileMsgText")}]`;
    case V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_AUDIO:
      return `[${t("audioMsgText")}]`;
    case V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_VIDEO:
      return `[${t("videoMsgText")}]`;
    default:
      return `[${t("messageText")}]`;
  }
};

const getTopicSummaryText = (message: V2NIMMessage): string => {
  switch (message.messageType) {
    case V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT:
      return truncateByChars(message.text || "", 30);
    case V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_IMAGE:
      return `[${t("imgMsgText")}]`;
    case V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_FILE: {
      const fileName = (message.attachment as V2NIMMessageFileAttachment | undefined)?.name;
      return fileName ? `[${t("fileMsgText")}] ${fileName}` : `[${t("fileMsgText")}]`;
    }
    case V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_AUDIO:
      return `[${t("audioMsgText")}]`;
    case V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_VIDEO:
      return `[${t("videoMsgText")}]`;
    default:
      return `[${t("messageText")}]`;
  }
};

const getThreadRootMessageClientId = (message: V2NIMMessage): string | undefined => {
  return (
    message.threadRoot?.messageClientId ||
    (message as V2NIMMessage & { threadRefer?: { root?: V2NIMMessageRefer } }).threadRefer?.root
      ?.messageClientId
  );
};

const shouldShowTopicSummaryMessage = (message?: V2NIMMessage): boolean => {
  const rootMessageClientId = message ? getThreadRootMessageClientId(message) : undefined;
  return !!message && !!rootMessageClientId && rootMessageClientId !== message.messageClientId;
};

const getLatestTopicSummaryMessage = (messages: V2NIMMessage[]): V2NIMMessage | undefined => {
  return messages
    .filter((message) => shouldShowTopicSummaryMessage(message))
    .sort((left, right) => Number(right.createTime || 0) - Number(left.createTime || 0))[0];
};

const isFailedMessage = (message?: V2NIMMessage): boolean => {
  const statusErrorCode = message?.messageStatus?.errorCode;
  const directErrorCode = (message as V2NIMMessageForUI | undefined)?.errorCode;
  return (
    message?.sendingState ===
      V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_FAILED ||
    (statusErrorCode !== undefined && !isMessageNoError(statusErrorCode)) ||
    (directErrorCode !== undefined && !isMessageNoError(directErrorCode))
  );
};

const getTopicCreateSortTime = (topic: V2NIMTopic): number => {
  return Number(topic.createTime || topic.messageTime || 0);
};

const isCloseTopicTime = (left?: number, right?: number): boolean => {
  if (!left || !right) {
    return false;
  }

  return Math.abs(left - right) <= 5 * 60 * 1000;
};

export class TopicStore {
  conversationStates: Map<string, TopicConversationState> = new Map();
  logger: typeof storeUtils.logger | null = null;
  private conversationCacheOrder: string[] = [];
  private topicListLoadingTasks: Map<string, Promise<void>> = new Map();
  private summaryTasks: Promise<void>[] = [];
  private tempTopicIds: Set<string> = new Set();
  private sendingMessageTopicKeys: Map<
    string,
    { conversationId: string; topicKey: string }
  > = new Map();

  constructor(private rootStore: RootStore, private nim: V2NIMClient) {
    makeAutoObservable<
      TopicStore,
      | "conversationCacheOrder"
      | "topicListLoadingTasks"
      | "summaryTasks"
      | "tempTopicIds"
      | "sendingMessageTopicKeys"
    >(this, {
      conversationCacheOrder: false,
      topicListLoadingTasks: false,
      summaryTasks: false,
      tempTopicIds: false,
      sendingMessageTopicKeys: false,
    });
    this.logger = rootStore.logger;

    this._onTopicAdded = this._onTopicAdded.bind(this);
    this._onTopicsRemoved = this._onTopicsRemoved.bind(this);
    this._onTopicUpdated = this._onTopicUpdated.bind(this);
    this._onSendMessage = this._onSendMessage.bind(this);
    this._onReceiveMessages = this._onReceiveMessages.bind(this);
    this._onMessageDeletedNotifications = this._onMessageDeletedNotifications.bind(this);
    this._onMessageRevokeNotifications = this._onMessageRevokeNotifications.bind(this);

    this.nim.topicService?.on("topicAdded", this._onTopicAdded);
    this.nim.topicService?.on("topicsRemoved", this._onTopicsRemoved);
    this.nim.topicService?.on("topicUpdated", this._onTopicUpdated);
    this.nim.messageService?.on("sendMessage", this._onSendMessage);
    this.nim.messageService?.on("receiveMessages", this._onReceiveMessages);
    this.nim.messageService?.on(
      "messageDeletedNotifications",
      this._onMessageDeletedNotifications
    );
    this.nim.messageService?.on(
      "messageRevokeNotifications",
      this._onMessageRevokeNotifications
    );
  }

  resetState(): void {
    this.conversationStates.clear();
    this.conversationCacheOrder = [];
    this.topicListLoadingTasks.clear();
  }

  destroy(): void {
    this.nim.topicService?.off("topicAdded", this._onTopicAdded);
    this.nim.topicService?.off("topicsRemoved", this._onTopicsRemoved);
    this.nim.topicService?.off("topicUpdated", this._onTopicUpdated);
    this.nim.messageService?.off("sendMessage", this._onSendMessage);
    this.nim.messageService?.off("receiveMessages", this._onReceiveMessages);
    this.nim.messageService?.off(
      "messageDeletedNotifications",
      this._onMessageDeletedNotifications
    );
    this.nim.messageService?.off(
      "messageRevokeNotifications",
      this._onMessageRevokeNotifications
    );
    this.resetState();
  }

  getState(conversationId: string): TopicConversationState {
    const existing = this.conversationStates.get(conversationId);
    if (existing) {
      this.touchConversationCache(conversationId);
      return existing;
    }

    const state = createConversationState(conversationId);
    this.conversationStates.set(conversationId, state);
    this.touchConversationCache(conversationId);
    this.pruneConversationCache(conversationId);
    return this.conversationStates.get(conversationId) || state;
  }

  getTopicRows(conversationId: string): TopicRowForUI[] {
    const state = this.getState(conversationId);

    return state.topicRows;
  }

  private touchConversationCache(conversationId: string): void {
    this.conversationCacheOrder = [
      ...this.conversationCacheOrder.filter((item) => item !== conversationId),
      conversationId,
    ];
  }

  private pruneConversationCache(protectedConversationId?: string): void {
    while (this.conversationCacheOrder.length > TOPIC_CONVERSATION_CACHE_LIMIT) {
      const oldestConversationId = this.conversationCacheOrder[0];
      if (!oldestConversationId) {
        return;
      }
      if (oldestConversationId === protectedConversationId) {
        this.touchConversationCache(oldestConversationId);
        continue;
      }

      this.conversationStates.delete(oldestConversationId);
      this.topicListLoadingTasks.delete(oldestConversationId);
      this.conversationCacheOrder = this.conversationCacheOrder.filter(
        (item) => item !== oldestConversationId
      );
    }
  }

  private getCachedState(conversationId: string): TopicConversationState | undefined {
    const state = this.conversationStates.get(conversationId);
    if (state) {
      this.touchConversationCache(conversationId);
    }
    return state;
  }

  async ensureAllTopicsLoaded(conversationId: string, force = false): Promise<void> {
    const state = this.getState(conversationId);
    if (state.loaded && !force) {
      this.logger?.log("TopicStore ensureAllTopicsLoaded skipped: cached", {
        conversationId,
      });
      return;
    }

    const loadingTask = this.topicListLoadingTasks.get(conversationId);
    if (loadingTask) {
      await loadingTask;
      return;
    }

    const task = this.loadAllTopics(conversationId, force);
    this.topicListLoadingTasks.set(conversationId, task);
    try {
      await task;
    } finally {
      this.topicListLoadingTasks.delete(conversationId);
    }
  }

  async loadFirstPage(conversationId: string): Promise<void> {
    await this.ensureAllTopicsLoaded(conversationId, true);
  }

  async loadMore(conversationId: string): Promise<void> {
    await this.ensureAllTopicsLoaded(conversationId);
  }

  private async loadAllTopics(conversationId: string, force: boolean): Promise<void> {
    const state = this.getState(conversationId);

    runInAction(() => {
      state.loading = true;
      state.loadingMore = false;
      state.error = undefined;
      if (force || !state.loaded) {
        state.loaded = false;
        state.topics.clear();
        state.summaries.clear();
        state.order = [];
        state.topicList = [];
        state.topicRows = [];
      }
    });

    try {
      const readTime = await this.getParentConversationReadTime(conversationId);
      let nextToken = "";
      let anchorTime: number | undefined;
      let hasMore = true;
      let replaceOrder = true;
      let loadedCount = 0;

      runInAction(() => {
        state.readTime = readTime;
      });

      while (hasMore) {
        const previousNextToken = nextToken;
        const previousAnchorTime = anchorTime;
        const option = {
          conversationId,
          nextToken,
          anchorTime,
          limit: TOPIC_LIST_LIMIT,
          direction: V2NIMQueryDirection.V2NIM_QUERY_DIRECTION_DESC,
        };
        this.logger?.log("TopicStore loadAllTopics page start", option);

        const result = await this.nim.topicService?.getTopicListByOption(option);
        const topicList = result?.topicList || [];
        this.logger?.log("TopicStore loadAllTopics page result", {
          conversationId,
          count: topicList.length,
          hasMore: !!result?.hasMore,
          nextToken: result?.nextToken || "",
          anchorTime: result?.anchorTime,
        });

        runInAction(() => {
          this.mergeTopics(state, topicList, replaceOrder);
          state.hasMore = !!result?.hasMore;
          state.nextToken = result?.nextToken || "";
          state.anchorTime = result?.anchorTime;
          state.empty = state.order.length === 0 && !state.hasMore;
        });

        hasMore = !!result?.hasMore;
        nextToken = result?.nextToken || "";
        anchorTime = result?.anchorTime;
        loadedCount += topicList.length;
        if (
          loadedCount >= TOPIC_LIST_MAX_COUNT ||
          !topicList.length ||
          (hasMore && nextToken === previousNextToken && anchorTime === previousAnchorTime)
        ) {
          hasMore = false;
        }
        replaceOrder = false;
      }

      runInAction(() => {
        state.loaded = true;
        state.hasMore = false;
        state.loadingMore = false;
        state.empty = state.order.length === 0;
      });
    } catch (error) {
      this.logger?.error("TopicStore loadAllTopics failed", {
        conversationId,
        error,
      });
      runInAction(() => {
        state.error = toError(error);
      });
      throw error;
    } finally {
      runInAction(() => {
        state.loading = false;
      });
    }
  }

  async loadSummary(conversationId: string, topic: V2NIMTopic): Promise<void> {
    const state = this.getState(conversationId);
    const topicId = getTopicKey(topic);
    if (!topicId) {
      return;
    }
    const messageRefer = this.createLocalThreadRootMessageRefer(topic);
    if (!messageRefer || !this.canLoadTopicMessagesFromSDK(state, topicId, topic)) {
      runInAction(() => {
        state.messageHasMore.set(topicId, false);
        state.messageError.delete(topicId);
      });
      return;
    }

    const current = state.summaries.get(topicId);
    runInAction(() => {
      state.summaries.set(topicId, {
        text: current?.text || "",
        message: current?.message,
        time: current?.time,
        loading: true,
      });
      this.refreshTopicRows(state);
    });

    try {
      const result = await this.nim.messageService?.getLocalThreadMessageList(messageRefer);
      const summaryMessage = getLatestTopicSummaryMessage(result?.replyList || []);
      runInAction(() => {
        state.summaries.set(topicId, {
          message: summaryMessage,
          text: summaryMessage ? getTopicSummaryText(summaryMessage) : "",
          time: summaryMessage?.createTime,
          loading: false,
        });
        this.refreshTopicRows(state);
      });
    } catch (error) {
      runInAction(() => {
        state.summaries.set(topicId, {
          text: current?.text || "",
          message: current?.message,
          time: current?.time,
          loading: false,
          error: toError(error),
        });
        this.refreshTopicRows(state);
      });
      throw error;
    }
  }

  async loadSummariesForTopics(conversationId: string, topicIds: string[]): Promise<void> {
    const state = this.getState(conversationId);
    const uniqueTopicIds = Array.from(new Set(topicIds));
    const topics = uniqueTopicIds
      .map((topicId) => state.topics.get(topicId))
      .filter((topic): topic is V2NIMTopic => !!topic)
      .filter((topic) => {
        const topicId = getTopicKey(topic);
        const summary = topicId ? state.summaries.get(topicId) : undefined;
        return topicId && !summary?.loading && (!summary || !!summary.error);
      });

    await Promise.all(topics.map((topic) => this.enqueueSummaryLoad(conversationId, topic)));
  }

  async refreshAll(conversationId: string): Promise<void> {
    await this.ensureAllTopicsLoaded(conversationId, true);
  }

  setReadTime(conversationId: string, readTime: number): void {
    const state = this.getState(conversationId);
    state.readTime = readTime;
    this.refreshTopicRows(state);
  }

  async clearParentConversationUnread(conversationId: string): Promise<void> {
    if (this.rootStore.localOptions.enableCloudConversation) {
      await this.rootStore.conversationStore?.resetConversation(conversationId);
    } else {
      await this.rootStore.localConversationStore?.resetConversation(conversationId);
    }
  }

  clearSelectedTopic(conversationId: string): void {
    const state = this.getState(conversationId);
    this.removeUnsavedDraftPlaceholder(state);
    state.selected = createEmptySelected();
  }

  selectTopic(conversationId: string, topicId: string): void {
    const state = this.getState(conversationId);
    if (this.isTempTopicId(topicId)) {
      state.draft = {
        conversationId,
        topicId,
        createdAt: state.draft?.topicId === topicId ? state.draft.createdAt : Date.now(),
      };
      state.selected = { type: "draft", conversationId, topicId };
      return;
    }

    this.removeUnsavedDraftPlaceholder(state);
    state.draft = undefined;
    state.selected = { type: "topic", conversationId, topicId };
    // 先无条件标记父会话已读，否则可能导致被删除的 topic 收到未读后无法清理。
    // if (this.shouldMarkParentConversationRead(state, topicId)) {
    void this.markParentConversationRead(conversationId);
    // }
    void this.loadTopicMessages(conversationId, topicId);
  }

  async removeTopic(conversationId: string, topicId: string): Promise<void> {
    const state = this.getState(conversationId);
    const topic = state.topics.get(topicId);
    if (
      this.isTempTopicId(topicId) ||
      this.isFirstMessageFailedTopic(state, topicId) ||
      !this.canLoadTopicMessagesFromSDK(state, topicId, topic) ||
      topicId === "0" ||
      !topic?.topicId ||
      topic.topicId !== topicId
    ) {
      this.removeTempTopic(state, topicId);
      return;
    }

    await this.nim.topicService?.removeTopics({
      topicList: [topic],
    });
  }

  async updateTopicName(
    conversationId: string,
    topicId: string,
    topicName: string
  ): Promise<void> {
    const state = this.getState(conversationId);
    const topic = state.topics.get(topicId);
    if (!topic) {
      return;
    }

    if (this.isTempTopicId(topicId)) {
      state.topics.set(topicId, {
        ...topic,
        topicName,
        updateTime: Date.now(),
      });
      this.refreshTopicRows(state);
      return;
    }

    const updatedTopic = await this.nim.topicService?.updateTopic({
      topic,
      topicName,
    });
    state.topics.set(topicId, updatedTopic || { ...topic, topicName });
    this.refreshTopicRows(state);
  }

  enterDraft(conversationId: string): void {
    const state = this.getState(conversationId);
    const existingEmptyDraftTopicId = this.findEmptyDraftPlaceholderId(state);
    if (existingEmptyDraftTopicId) {
      state.draft = {
        conversationId,
        topicId: existingEmptyDraftTopicId,
        createdAt: state.draft?.createdAt || Date.now(),
      };
      state.selected = { type: "draft", conversationId, topicId: existingEmptyDraftTopicId };
      state.order = [
        existingEmptyDraftTopicId,
        ...state.order.filter((item) => item !== existingEmptyDraftTopicId),
      ];
      this.refreshTopicRows(state);
      return;
    }

    this.removeUnsavedDraftPlaceholder(state);

    const createdAt = Date.now();
    const topicId = getTempTopicId();
    this.tempTopicIds.add(topicId);
    state.topics.set(topicId, {
      topicId,
      conversationId,
      topicName: t("topicSubsessionDefaultTitle"),
      createTime: createdAt,
      updateTime: createdAt,
    });
    state.order = [topicId, ...state.order.filter((item) => item !== topicId)];
    state.summaries.set(topicId, {
      text: "",
      time: createdAt,
      loading: false,
    });
    state.draft = { conversationId, topicId, createdAt };
    state.selected = { type: "draft", conversationId, topicId };
    this.refreshTopicRows(state);
  }

  discardDraft(conversationId: string): void {
    const state = this.getState(conversationId);
    const draftTopicId = state.draft?.topicId;
    if (draftTopicId && this.isTempTopicId(draftTopicId)) {
      this.removeTempTopic(state, draftTopicId);
    }
    state.draft = undefined;
    if (state.selected.type === "draft") {
      state.selected = createEmptySelected();
    }
  }

  getTopicMessages(conversationId: string, topicId: string): V2NIMMessage[] {
    return this.getState(conversationId).messages.get(topicId) || [];
  }

  isTopicInputBlocked(conversationId: string): boolean {
    const state = this.getState(conversationId);
    const selected = state.selected;
    const topicKey =
      selected.type === "draft"
        ? selected.topicId || state.draft?.topicId
        : selected.type === "topic"
          ? selected.topicId
          : undefined;

    if (!topicKey) {
      return false;
    }

    const firstMessageDraft = state.firstMessageDrafts.get(topicKey);
    if (firstMessageDraft?.status === "failed" || isFailedMessage(firstMessageDraft?.message)) {
      return true;
    }

    const firstMessage = state.messages.get(topicKey)?.[0];
    return isFailedMessage(firstMessage);
  }

  isTopicFirstMessage(conversationId: string, messageClientId?: string): boolean {
    if (!messageClientId) {
      return false;
    }

    const state = this.getState(conversationId);
    return Array.from(state.firstMessageDrafts.values()).some(
      (draft) => draft.messageClientId === messageClientId
    );
  }

  async sendTopicMessage(
    conversationId: string,
    message: V2NIMMessage,
    options: TopicSendOptions = {}
  ): Promise<void> {
    const state = this.getState(conversationId);
    const selected = state.selected;
    const topic =
      selected.type === "topic" ? state.topics.get(selected.topicId) || null : null;
    const isNewTopicMessage = !topic;
    const selectedTopicKey =
      selected.type === "draft" || selected.type === "topic" ? selected.topicId : undefined;
    const currentDraft = selectedTopicKey ? state.firstMessageDrafts.get(selectedTopicKey) : undefined;
    const isRetryFirstMessage =
      !!currentDraft &&
      !!message.messageClientId &&
      currentDraft.messageClientId === message.messageClientId;

    if (currentDraft?.status === "failed" && !isRetryFirstMessage) {
      throw new Error("Cannot send more topic messages before retrying first message.");
    }

    const sendingMessage: V2NIMMessageForUI = {
      ...message,
      conversationId,
      senderId: this.rootStore.userStore.myUserInfo.accountId,
      isSelf: true,
      receiverId: this.nim.conversationIdUtil?.parseConversationTargetId(conversationId),
      conversationType: this.nim.conversationIdUtil?.parseConversationType(conversationId),
      messageStatus: message.messageStatus
        ? {
            ...message.messageStatus,
            errorCode: 0,
          }
        : undefined,
      sendingState: V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_SENDING,
      errorCode: undefined,
      previewImg: options.previewImg,
      previewWidth: options.previewWidth,
      previewHeight: options.previewHeight,
      uploadProgress: options.progress ? 0 : undefined,
    };
    const tempTopicId =
      isNewTopicMessage && selected.type === "draft" && selected.topicId
        ? selected.topicId
        : getTempTopicId(sendingMessage.messageClientId);
    const targetTopicId = topic?.topicId || tempTopicId;

    if (isNewTopicMessage) {
      this.upsertTempTopic(state, targetTopicId, sendingMessage);
      this.upsertFirstMessageDraft(state, targetTopicId, sendingMessage, options, "sending");
    }

    this.upsertTopicMessage(state, targetTopicId, sendingMessage);
    if (sendingMessage.messageClientId) {
      this.sendingMessageTopicKeys.set(sendingMessage.messageClientId, {
        conversationId,
        topicKey: targetTopicId,
      });
    }

    try {
      const result = await this.nim.topicService?.sendTopicMessage(
        sendingMessage,
        conversationId,
        topic,
        topic
          ? {}
          : {
              createTopicParams: {
                topicName: getDraftTopicName(sendingMessage),
              },
            },
        (percentage: number) => {
          options.progress?.(percentage);
          this.updateSendingProgress(state, targetTopicId, sendingMessage, percentage);
        }
      );
      const sentMessage = {
        ...sendingMessage,
        ...(result?.message || {}),
        threadReply: result?.message?.threadReply || sendingMessage.threadReply,
      } as V2NIMMessageForUI;
      if (isFailedMessage(sentMessage)) {
        const sendError = new Error("Topic message send failed.") as TopicSendFailureError;
        sendError.failedMessage = sentMessage as V2NIMMessageForUI;
        throw sendError;
      }
      if (
        sentMessage.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_FILE ||
        sentMessage.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_IMAGE ||
        sentMessage.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_VIDEO
      ) {
        (sentMessage as V2NIMMessageForUI).uploadProgress = 100;
      }
      const realSentTopicId = sentMessage.topicRefer?.topicId || topic?.topicId;
      const sentTopicId = realSentTopicId || targetTopicId;
      const currentMessages = [
        ...(state.messages.get(sentTopicId) || []),
        ...(
          targetTopicId === sentTopicId
            ? []
            : state.messages.get(targetTopicId) || []
        ),
      ].filter((item) => item.messageClientId !== sendingMessage.messageClientId);
      this.setTopicMessages(state, sentTopicId, [...currentMessages, sentMessage]);

      if (targetTopicId !== sentTopicId) {
        this.replaceTempTopic(state, targetTopicId, sentTopicId, sentMessage);
      }
      if (sentMessage.messageClientId) {
        this.sendingMessageTopicKeys.forEach((value, key) => {
          if (value.conversationId === conversationId && value.topicKey === targetTopicId) {
            this.sendingMessageTopicKeys.set(key, {
              conversationId,
              topicKey: sentTopicId,
            });
          }
        });
      }
      if (realSentTopicId) {
        this.markFirstMessageDraftSucceeded(state, targetTopicId, sentTopicId);
      }
      if (topic) {
        this.updateTopicSummaryFromMessage(sentMessage, state, sentTopicId);
      } else if (!realSentTopicId) {
        state.summaries.set(targetTopicId, {
          message: sentMessage,
          text: "",
          time: sentMessage.createTime || Date.now(),
          loading: false,
        });
        this.refreshTopicRows(state);
      }
      void this.markParentConversationRead(conversationId);
      if (sendingMessage.messageClientId && (realSentTopicId || topic)) {
        this.sendingMessageTopicKeys.delete(sendingMessage.messageClientId);
      }
    } catch (error) {
      const failedMessage = {
        ...sendingMessage,
        ...((error as TopicSendFailureError).failedMessage || {}),
        threadReply:
          ((error as TopicSendFailureError).failedMessage as V2NIMMessageForUI | undefined)
            ?.threadReply || sendingMessage.threadReply,
        sendingState:
          V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_FAILED,
        errorCode:
          (error as { code?: number })?.code ||
          ((error as TopicSendFailureError).failedMessage as V2NIMMessageForUI | undefined)
            ?.errorCode,
      };
      const firstMessageDraft = sendingMessage.messageClientId
        ? this.findFirstMessageDraftByMessageClientId(state, sendingMessage.messageClientId)
        : undefined;
      const failedTopicKey =
        (firstMessageDraft && this.findRealTopicIdForDraft(state, firstMessageDraft)) ||
        firstMessageDraft?.topicKey ||
        targetTopicId;

      if (firstMessageDraft) {
        if (failedTopicKey !== firstMessageDraft.topicKey && this.isTempTopicId(firstMessageDraft.topicKey)) {
          this.replaceTempTopic(state, firstMessageDraft.topicKey, failedTopicKey, failedMessage);
        }
        this.upsertTopicMessage(state, failedTopicKey, failedMessage);
        this.upsertFirstMessageDraft(state, failedTopicKey, failedMessage, options, "failed");
        if (this.isTempTopicId(failedTopicKey)) {
          state.draft = { conversationId, topicId: failedTopicKey, createdAt: Date.now() };
          state.selected = { type: "draft", conversationId, topicId: failedTopicKey };
        } else {
          state.draft = undefined;
          state.selected = { type: "topic", conversationId, topicId: failedTopicKey };
        }
        this.refreshTopicRows(state);
      } else if (this.isTempTopicId(targetTopicId)) {
        this.upsertTopicMessage(state, targetTopicId, failedMessage);
        this.upsertFirstMessageDraft(state, targetTopicId, failedMessage, options, "failed");
        state.draft = { conversationId, topicId: targetTopicId, createdAt: Date.now() };
        state.selected = { type: "draft", conversationId, topicId: targetTopicId };
        this.refreshTopicRows(state);
      } else {
        const failedMessages = (state.messages.get(targetTopicId) || []).map((item) =>
          item.messageClientId === sendingMessage.messageClientId
            ? {
                ...item,
                sendingState:
                  V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_FAILED,
              }
            : item
        );
        this.setTopicMessages(state, targetTopicId, failedMessages);
      }
      if (sendingMessage.messageClientId) {
        const cached = this.sendingMessageTopicKeys.get(sendingMessage.messageClientId);
        if (!cached || !state.firstMessageDrafts.has(cached.topicKey)) {
          this.sendingMessageTopicKeys.delete(sendingMessage.messageClientId);
        }
      }
      throw error;
    }
  }

  async replyTopicMessage(
    conversationId: string,
    message: V2NIMMessage,
    repliedMessage: V2NIMMessage,
    options: TopicSendOptions = {}
  ): Promise<void> {
    const state = this.getState(conversationId);
    const selected = state.selected;
    const topic = selected.type === "topic" ? state.topics.get(selected.topicId) : undefined;
    if (!topic?.topicId) {
      throw new Error("Cannot reply topic message before selecting a real topic.");
    }

    const targetTopicId = topic.topicId;
    const sendingMessage: V2NIMMessageForUI = {
      ...message,
      conversationId,
      senderId: this.rootStore.userStore.myUserInfo.accountId,
      isSelf: true,
      receiverId: this.nim.conversationIdUtil?.parseConversationTargetId(conversationId),
      conversationType: this.nim.conversationIdUtil?.parseConversationType(conversationId),
      messageStatus: message.messageStatus
        ? {
            ...message.messageStatus,
            errorCode: 0,
          }
        : undefined,
      sendingState: V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_SENDING,
      threadReply: this.toMessageRefer(repliedMessage),
      errorCode: undefined,
      previewImg: options.previewImg,
      previewWidth: options.previewWidth,
      previewHeight: options.previewHeight,
      uploadProgress: options.progress ? 0 : undefined,
    };

    this.upsertTopicMessage(state, targetTopicId, sendingMessage);
    if (sendingMessage.messageClientId) {
      this.sendingMessageTopicKeys.set(sendingMessage.messageClientId, {
        conversationId,
        topicKey: targetTopicId,
      });
    }

    try {
      const result = await this.nim.topicService?.replyTopicMessage(
        sendingMessage,
        this.rootStore.msgStore.handleMsgForSDK(repliedMessage),
        topic,
        {},
        (percentage: number) => {
          options.progress?.(percentage);
          this.updateSendingProgress(state, targetTopicId, sendingMessage, percentage);
        }
      );
      const sentMessage = {
        ...sendingMessage,
        ...(result?.message || {}),
        threadReply: result?.message?.threadReply || sendingMessage.threadReply,
      } as V2NIMMessageForUI;
      if (isFailedMessage(sentMessage)) {
        const sendError = new Error("Topic reply message send failed.") as TopicSendFailureError;
        sendError.failedMessage = sentMessage as V2NIMMessageForUI;
        throw sendError;
      }
      if (
        sentMessage.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_FILE ||
        sentMessage.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_IMAGE ||
        sentMessage.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_VIDEO
      ) {
        (sentMessage as V2NIMMessageForUI).uploadProgress = 100;
      }
      const sentTopicId = sentMessage.topicRefer?.topicId || targetTopicId;
      const currentMessages = [
        ...(state.messages.get(sentTopicId) || []),
        ...(sentTopicId === targetTopicId ? [] : state.messages.get(targetTopicId) || []),
      ].filter((item) => item.messageClientId !== sendingMessage.messageClientId);
      this.setTopicMessages(state, sentTopicId, [...currentMessages, sentMessage]);
      if (sentTopicId !== targetTopicId) {
        state.messages.delete(targetTopicId);
      }
      this.updateTopicSummaryFromMessage(sentMessage, state, sentTopicId);
      void this.markParentConversationRead(conversationId);
      this.rootStore.msgStore.removeReplyMsgActive(conversationId);
      if (sendingMessage.messageClientId) {
        this.sendingMessageTopicKeys.delete(sendingMessage.messageClientId);
      }
    } catch (error) {
      const failedMessage: V2NIMMessageForUI = {
        ...sendingMessage,
        ...((error as TopicSendFailureError).failedMessage || {}),
        threadReply:
          ((error as TopicSendFailureError).failedMessage as V2NIMMessageForUI | undefined)
            ?.threadReply || sendingMessage.threadReply,
        sendingState:
          V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_FAILED,
        errorCode:
          (error as { code?: number })?.code ||
          ((error as TopicSendFailureError).failedMessage as V2NIMMessageForUI | undefined)
            ?.errorCode,
      };
      const messages = (state.messages.get(targetTopicId) || []).map((item) =>
        item.messageClientId === sendingMessage.messageClientId ? failedMessage : item
      );
      this.setTopicMessages(state, targetTopicId, messages);
      if (sendingMessage.messageClientId) {
        this.sendingMessageTopicKeys.delete(sendingMessage.messageClientId);
      }
      throw error;
    }
  }

  async retryTopicMessage(
    conversationId: string,
    message: V2NIMMessageForUI,
    options: TopicSendOptions = {}
  ): Promise<void> {
    const state = this.getState(conversationId);
    const topicId = message.topicRefer?.topicId;
    const topic = topicId ? state.topics.get(topicId) : undefined;
    if (!topicId || !topic) {
      await this.sendTopicMessage(conversationId, message, options);
      return;
    }

    state.draft = undefined;
    state.selected = { type: "topic", conversationId, topicId };

    let repliedMessage: V2NIMMessage | undefined;
    if (message.threadReply) {
      const repliedMessages = await this.nim.messageService?.getMessageListByRefers([
        message.threadReply,
      ]);
      repliedMessage = repliedMessages?.[0];
      if (!repliedMessage) {
        throw new Error("Topic replied message not found.");
      }
    }

    this.removeTopicMessages(conversationId, [message]);
    if (repliedMessage) {
      await this.replyTopicMessage(conversationId, message, repliedMessage, options);
      return;
    }

    await this.sendTopicMessage(conversationId, message, options);
  }

  removeTopicMessages(conversationId: string, messages: V2NIMMessage[]): void {
    const state = this.conversationStates.get(conversationId);
    if (!state || !messages.length) {
      return;
    }

    const idsByTopic = new Map<string, Set<string>>();
    messages.forEach((message) => {
      const topicId = message.topicRefer?.topicId;
      const messageClientId = message.messageClientId;
      if (!topicId || !messageClientId) {
        return;
      }
      const ids = idsByTopic.get(topicId) || new Set<string>();
      ids.add(messageClientId);
      idsByTopic.set(topicId, ids);
    });

    idsByTopic.forEach((ids, topicId) => {
      const messages = state.messages.get(topicId) || [];
      const deletedMessages = messages.filter((message) =>
        ids.has(message.messageClientId as string)
      );
      const nextMessages = messages.filter((message) => !ids.has(message.messageClientId as string));
      this.setTopicMessages(
        state,
        topicId,
        this.markDeletedTopicReplyMessages(nextMessages, deletedMessages)
      );
      this.refreshTopicSummaryFromMessages(state, topicId);
    });
  }

  recallTopicMessage(conversationId: string, message: V2NIMMessageForUI): void {
    const topicId = message.topicRefer?.topicId;
    const messageClientId = message.messageClientId;
    const state = this.conversationStates.get(conversationId);
    if (!state || !topicId || !messageClientId) {
      return;
    }

    const messages = state.messages.get(topicId) || [];
    const recallMessage = this.createRecalledMessage(message);
    this.setTopicMessages(
      state,
      topicId,
      [...messages.filter((item) => item.messageClientId !== messageClientId), recallMessage]
    );
    this.refreshTopicSummaryFromMessages(state, topicId);
  }

  getSelectedTopicMessages(conversationId: string, ids?: string[]): V2NIMMessageForUI[] {
    const state = this.getState(conversationId);
    const topicId =
      state.selected.type === "topic"
        ? state.selected.topicId
        : state.selected.type === "draft"
          ? state.selected.topicId
          : undefined;
    if (!topicId) {
      return [];
    }

    const messages = (state.messages.get(topicId) || []) as V2NIMMessageForUI[];
    if (!ids?.length) {
      return messages;
    }

    return messages.filter((message) => ids.includes(message.messageClientId as string));
  }

  async retryFirstTopicMessage(
    conversationId: string,
    messageClientId: string,
    options: TopicSendOptions = {}
  ): Promise<void> {
    const state = this.getState(conversationId);
    const draft = this.findFirstMessageDraftByMessageClientId(state, messageClientId);
    if (!draft) {
      throw new Error("Topic first message draft not found.");
    }

    if (this.isTempTopicId(draft.topicKey)) {
      state.selected = { type: "draft", conversationId, topicId: draft.topicKey };
      state.draft = {
        conversationId,
        topicId: draft.topicKey,
        createdAt: state.draft?.createdAt || draft.createdAt,
      };
    } else {
      state.draft = undefined;
      state.selected = { type: "topic", conversationId, topicId: draft.topicKey };
    }
    await this.sendTopicMessage(conversationId, draft.message, {
      ...draft.options,
      ...options,
    });
  }

  private setTopicMessages(
    state: TopicConversationState,
    topicId: string,
    messages: V2NIMMessage[]
  ): void {
    state.messages.set(
      topicId,
      [...messages].sort(
        (left, right) => Number(left.createTime || 0) - Number(right.createTime || 0)
      )
    );
  }

  private markDeletedTopicReplyMessages(
    messages: V2NIMMessage[],
    deletedMessages: V2NIMMessage[]
  ): V2NIMMessage[] {
    if (!deletedMessages.length) {
      return messages;
    }

    const deletedClientIds = new Set(
      deletedMessages.map((message) => message.messageClientId).filter(Boolean) as string[]
    );
    const deletedServerIds = new Set(
      deletedMessages.map((message) => message.messageServerId).filter(Boolean) as string[]
    );

    if (!deletedClientIds.size && !deletedServerIds.size) {
      return messages;
    }

    return messages.map((message) => {
      const threadReply = message.threadReply;
      const replyDeleted =
        (!!threadReply?.messageClientId && deletedClientIds.has(threadReply.messageClientId)) ||
        (!!threadReply?.messageServerId && deletedServerIds.has(threadReply.messageServerId));

      return replyDeleted
        ? ({
            ...message,
            replyState: "deleted",
          } as V2NIMMessageForUI)
        : message;
    });
  }

  private upsertTopicMessage(
    state: TopicConversationState,
    topicId: string,
    message: V2NIMMessage
  ): void {
    const messages = state.messages.get(topicId) || [];
    const nextMessages = messages.some((item) => this.isSameMessage(item, message))
      ? messages.map((item) => (this.isSameMessage(item, message) ? { ...item, ...message } : item))
      : [...messages, message];
    this.setTopicMessages(state, topicId, nextMessages);
  }

  private isTempTopicId(topicId: string): boolean {
    return this.tempTopicIds.has(topicId);
  }

  private isFirstMessageFailedTopic(state: TopicConversationState, topicId: string): boolean {
    const firstMessageDraft = state.firstMessageDrafts.get(topicId);
    if (firstMessageDraft?.status === "failed" || isFailedMessage(firstMessageDraft?.message)) {
      return true;
    }

    return isFailedMessage(state.messages.get(topicId)?.[0]);
  }

  private isEmptyDraftPlaceholder(state: TopicConversationState, topicId: string): boolean {
    const topic = state.topics.get(topicId);
    return (
      !!topic &&
      topic.conversationId === state.conversationId &&
      this.isTempTopicId(topicId) &&
      !topic?.messageClientId &&
      !topic?.messageServerId &&
      !topic?.messageTime &&
      !state.messages.get(topicId)?.length &&
      !state.firstMessageDrafts.has(topicId)
    );
  }

  private findEmptyDraftPlaceholderId(state: TopicConversationState): string | undefined {
    if (state.draft?.topicId && this.isEmptyDraftPlaceholder(state, state.draft.topicId)) {
      return state.draft.topicId;
    }

    return state.order.find((topicId) => this.isEmptyDraftPlaceholder(state, topicId));
  }

  private removeUnsavedDraftPlaceholder(state: TopicConversationState): void {
    const draftTopicId = this.findEmptyDraftPlaceholderId(state);
    if (draftTopicId) {
      this.removeTempTopic(state, draftTopicId);
    }
  }

  private canLoadTopicMessagesFromSDK(
    state: TopicConversationState,
    topicId: string,
    topic?: V2NIMTopic
  ): boolean {
    if (!topic || this.isTempTopicId(topicId) || this.isFirstMessageFailedTopic(state, topicId)) {
      return false;
    }

    return !!topic.conversationId && !!topic.messageClientId && !!topic.messageServerId;
  }

  private createLocalThreadRootMessageRefer(topic: V2NIMTopic): V2NIMMessageRefer | null {
    const conversationId = topic.conversationId;
    if (!conversationId || !this.rootStore.isAIBotTopicConversation(conversationId)) {
      return null;
    }

    const messageClientId = topic.messageClientId;
    const messageServerId = topic.messageServerId;
    // AI bot topic root messages are always sent by current user to the target bot.
    const senderId = this.rootStore.userStore.myUserInfo.accountId;
    const receiverId = this.nim.conversationIdUtil?.parseConversationTargetId(conversationId);

    if (!conversationId || !messageClientId || !messageServerId || !senderId || !receiverId) {
      return null;
    }

    return {
      senderId,
      receiverId,
      conversationId,
      conversationType: this.nim.conversationIdUtil?.parseConversationType(conversationId),
      messageClientId,
      messageServerId,
      createTime: topic.messageTime,
    };
  }

  private upsertFirstMessageDraft(
    state: TopicConversationState,
    topicKey: string,
    message: V2NIMMessageForUI,
    options: TopicSendOptions,
    status: TopicFirstMessageDraftState["status"]
  ): void {
    const current = state.firstMessageDrafts.get(topicKey);
    state.firstMessageDrafts.set(topicKey, {
      conversationId: state.conversationId,
      topicKey,
      messageClientId: message.messageClientId,
      message,
      options,
      status,
      createdAt: current?.createdAt || Date.now(),
      updatedAt: Date.now(),
      realTopicId: current?.realTopicId,
    });
  }

  private markFirstMessageDraftSucceeded(
    state: TopicConversationState,
    topicKey: string,
    realTopicId: string
  ): void {
    const draft = state.firstMessageDrafts.get(topicKey) || state.firstMessageDrafts.get(realTopicId);
    if (!draft) {
      return;
    }

    state.firstMessageDrafts.delete(topicKey);
    state.firstMessageDrafts.delete(realTopicId);
  }

  private findFirstMessageDraftByMessageClientId(
    state: TopicConversationState,
    messageClientId: string
  ): TopicFirstMessageDraftState | undefined {
    return Array.from(state.firstMessageDrafts.values()).find(
      (item) => item.messageClientId === messageClientId
    );
  }

  private findRealTopicIdForDraft(
    state: TopicConversationState,
    draft: TopicFirstMessageDraftState
  ): string | undefined {
    const tempTopic = state.topics.get(draft.topicKey);
    const draftTitle = tempTopic?.topicName || getDraftTopicName(draft.message);
    const draftTime =
      tempTopic?.createTime || tempTopic?.messageTime || draft.message.createTime || draft.createdAt;

    return state.order.find((topicId) => {
      if (topicId === draft.topicKey || this.isTempTopicId(topicId)) {
        return false;
      }

      const topic = state.topics.get(topicId);
      if (!topic) {
        return false;
      }

      const sameRootMessage =
        (!!topic.messageClientId && topic.messageClientId === draft.messageClientId) ||
        (!!topic.messageServerId && topic.messageServerId === draft.message.messageServerId);
      if (sameRootMessage) {
        return true;
      }

      const titleMatched = !!topic.topicName && topic.topicName === draftTitle;
      const topicTime = topic.createTime || topic.messageTime || topic.updateTime;
      return titleMatched && isCloseTopicTime(topicTime, draftTime);
    });
  }

  private markFirstMessageDraftFailedFromEvent(message: V2NIMMessage): boolean {
    const messageClientId = message.messageClientId;
    const cached = messageClientId ? this.sendingMessageTopicKeys.get(messageClientId) : undefined;
    if (!messageClientId || !cached) {
      return false;
    }

    const state = this.getState(cached.conversationId);
    const firstMessageDraft = this.findFirstMessageDraftByMessageClientId(state, messageClientId);
    if (!firstMessageDraft) {
      return false;
    }

    const failedTopicKey =
      this.findRealTopicIdForDraft(state, firstMessageDraft) ||
      firstMessageDraft.topicKey ||
      cached.topicKey;
    const failedMessage: V2NIMMessageForUI = {
      ...firstMessageDraft.message,
      ...message,
      conversationId: cached.conversationId,
      sendingState:
        V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_FAILED,
    };
    if (failedTopicKey !== firstMessageDraft.topicKey && this.isTempTopicId(firstMessageDraft.topicKey)) {
      this.replaceTempTopic(state, firstMessageDraft.topicKey, failedTopicKey, failedMessage);
    }
    this.upsertTopicMessage(state, failedTopicKey, failedMessage);
    this.upsertFirstMessageDraft(
      state,
      failedTopicKey,
      failedMessage,
      firstMessageDraft.options,
      "failed"
    );
    if (this.isTempTopicId(failedTopicKey)) {
      state.draft = {
        conversationId: cached.conversationId,
        topicId: failedTopicKey,
        createdAt: firstMessageDraft.createdAt,
      };
      state.selected = {
        type: "draft",
        conversationId: cached.conversationId,
        topicId: failedTopicKey,
      };
    } else {
      state.draft = undefined;
      state.selected = {
        type: "topic",
        conversationId: cached.conversationId,
        topicId: failedTopicKey,
      };
    }
    this.refreshTopicRows(state);
    return true;
  }

  private upsertTempTopic(
    state: TopicConversationState,
    topicId: string,
    message: V2NIMMessage
  ): void {
    this.tempTopicIds.add(topicId);
    const tempTopic: V2NIMTopic = {
      topicId,
      conversationId: state.conversationId,
      topicName: getDraftTopicName(message),
      createTime: message.createTime || Date.now(),
      updateTime: message.createTime || Date.now(),
      messageClientId: message.messageClientId,
      messageServerId: message.messageServerId,
      messageTime: message.createTime,
    };
    state.topics.set(topicId, tempTopic);
    state.order = [topicId, ...state.order.filter((item) => item !== topicId)];
    state.draft = { conversationId: state.conversationId, topicId, createdAt: Date.now() };
    state.selected = { type: "draft", conversationId: state.conversationId, topicId };
    state.summaries.set(topicId, {
      message,
      text: "",
      time: message.createTime || Date.now(),
      loading: false,
    });
    this.refreshTopicRows(state);
  }

  private removeTempTopic(state: TopicConversationState, topicId: string): void {
    this.tempTopicIds.delete(topicId);
    state.topics.delete(topicId);
    state.summaries.delete(topicId);
    state.messages.delete(topicId);
    state.firstMessageDrafts.delete(topicId);
    state.order = state.order.filter((item) => item !== topicId);
    this.sendingMessageTopicKeys.forEach((value, key) => {
      if (value.conversationId === state.conversationId && value.topicKey === topicId) {
        this.sendingMessageTopicKeys.delete(key);
      }
    });
    if (state.draft?.topicId === topicId) {
      state.draft = undefined;
    }
    if (
      (state.selected.type === "draft" && state.selected.topicId === topicId) ||
      (state.selected.type === "topic" && state.selected.topicId === topicId)
    ) {
      state.selected = createEmptySelected();
    }
    this.refreshTopicRows(state);
  }

  private replaceTempTopic(
    state: TopicConversationState,
    tempTopicId: string,
    realTopicId: string,
    sentMessage: V2NIMMessage
  ): void {
    if (!this.isTempTopicId(tempTopicId)) {
      return;
    }

    const tempMessages = state.messages.get(tempTopicId) || [];
    const existingMessages = state.messages.get(realTopicId) || [];
    const nextMessages = [
      ...existingMessages,
      ...tempMessages.filter(
        (message) =>
          !existingMessages.some((item) => item.messageClientId === message.messageClientId)
      ),
    ].map((message) =>
      message.messageClientId === sentMessage.messageClientId ? sentMessage : message
    );
    const tempTopic = state.topics.get(tempTopicId);
    state.topics.delete(tempTopicId);
    state.summaries.delete(tempTopicId);
    const realSummary = state.summaries.get(realTopicId);
    if (realSummary?.message && !shouldShowTopicSummaryMessage(realSummary.message)) {
      state.summaries.delete(realTopicId);
    }
    state.messages.delete(tempTopicId);
    this.tempTopicIds.delete(tempTopicId);
    const draft = state.firstMessageDrafts.get(tempTopicId);
    if (draft) {
      state.firstMessageDrafts.delete(tempTopicId);
      state.firstMessageDrafts.set(realTopicId, {
        ...draft,
        topicKey: realTopicId,
        realTopicId,
        updatedAt: Date.now(),
      });
    }
    state.messages.set(realTopicId, nextMessages);
    state.order = state.order.map((item) => (item === tempTopicId ? realTopicId : item));
    if (!state.order.includes(realTopicId)) {
      state.order = [realTopicId, ...state.order];
    }
    state.order = Array.from(new Set(state.order));
    if (!state.topics.has(realTopicId)) {
      state.topics.set(realTopicId, {
        ...(tempTopic || {}),
        topicId: realTopicId,
        conversationId: state.conversationId,
        topicName: tempTopic?.topicName || getDraftTopicName(sentMessage),
        updateTime: sentMessage.createTime || Date.now(),
      });
    }
    if (state.selected.type === "draft" && state.selected.topicId === tempTopicId) {
      state.draft = undefined;
      state.selected = { type: "topic", conversationId: state.conversationId, topicId: realTopicId };
    }
    this.refreshTopicRows(state);
  }

  private createTopicFromMessage(message: V2NIMMessage, topicId: string): V2NIMTopic {
    return {
      topicId,
      conversationId: message.conversationId || message.topicRefer?.conversationId,
      topicName: getDraftTopicName(message),
      createTime: message.topicRefer?.createTime || message.createTime || Date.now(),
      updateTime: message.createTime || Date.now(),
      messageClientId: message.messageClientId,
      messageServerId: message.messageServerId,
      messageTime: message.createTime,
    };
  }

  private upsertTopicSendingMessage(message: V2NIMMessage): void {
    const conversationId = message.conversationId || message.topicRefer?.conversationId;
    const topicId = message.topicRefer?.topicId;
    if (!conversationId || !topicId) {
      return;
    }

    const state = this.getState(conversationId);
    if (!state.topics.has(topicId)) {
      state.topics.set(topicId, this.createTopicFromMessage(message, topicId));
      if (!state.order.includes(topicId)) {
        state.order = [...state.order, topicId];
      }
    }

    const cached = message.messageClientId
      ? this.sendingMessageTopicKeys.get(message.messageClientId)
      : undefined;
    const pendingMessages = cached?.conversationId === conversationId
      ? state.messages.get(cached.topicKey) || []
      : [];
    const topicMessages = state.messages.get(topicId) || [];
    const pendingMessage =
      pendingMessages.find((item) => item.messageClientId === message.messageClientId) || message;
    const nextMessages = topicMessages.some(
      (item) => item.messageClientId === pendingMessage.messageClientId
    )
      ? topicMessages
      : [
          ...topicMessages,
          {
            ...pendingMessage,
            topicRefer: message.topicRefer,
          },
        ];

    this.setTopicMessages(state, topicId, nextMessages);
    if (cached?.topicKey && cached.topicKey !== topicId) {
      const nextCachedMessages = (state.messages.get(cached.topicKey) || []).filter(
        (item) => item.messageClientId !== message.messageClientId
      );
      if (nextCachedMessages.length) {
        state.messages.set(cached.topicKey, nextCachedMessages);
      } else {
        state.messages.delete(cached.topicKey);
      }
    }

    if (state.selected.type === "draft") {
      state.draft = undefined;
      state.selected = { type: "topic", conversationId, topicId };
    }
  }

  private updateTopicSummaryFromMessage(
    message: V2NIMMessage,
    cachedState?: TopicConversationState,
    fallbackTopicId?: string
  ): void {
    const conversationId = message.conversationId || message.topicRefer?.conversationId;
    const topicId = message.topicRefer?.topicId || fallbackTopicId;
    if (!conversationId || !topicId) {
      return;
    }

    const state = cachedState || this.conversationStates.get(conversationId);
    if (!state) {
      return;
    }

    const topic = state.topics.get(topicId);
    if (!topic) {
      return;
    }
    if (!shouldShowTopicSummaryMessage(message)) {
      const current = state.summaries.get(topicId);
      const currentShouldHide = current?.message && !shouldShowTopicSummaryMessage(current.message);
      const currentTime = Number(current?.time || 0);
      const messageTime = Number(message.createTime || topic.messageTime || topic.createTime || 0);
      if (!current || currentShouldHide || !currentTime || messageTime >= currentTime) {
        state.summaries.set(topicId, {
          text: "",
          time: message.createTime || topic.messageTime || topic.createTime,
          loading: false,
        });
        this.refreshTopicRows(state);
      }
      return;
    }

    const messageTime = Number(message.createTime || Date.now());
    const currentTime = Number(state.summaries.get(topicId)?.time || 0);
    if (currentTime && messageTime < currentTime) {
      return;
    }

    state.summaries.set(topicId, {
      message,
      text: getTopicSummaryText(message),
      time: messageTime,
      loading: false,
    });
    this.refreshTopicRows(state);
  }

  private isSameMessage(left: V2NIMMessage, right: V2NIMMessage): boolean {
    return (
      (!!left.messageClientId && left.messageClientId === right.messageClientId) ||
      (!!left.messageServerId && left.messageServerId === right.messageServerId)
    );
  }

  private toMessageRefer(message: V2NIMMessage): V2NIMMessageRefer {
    return {
      senderId: message.senderId,
      receiverId: message.receiverId,
      messageClientId: message.messageClientId,
      messageServerId: message.messageServerId,
      conversationType: message.conversationType,
      conversationId: message.conversationId,
      createTime: message.createTime,
    };
  }

  private createRecalledMessage(message: V2NIMMessageForUI): V2NIMMessageForUI {
    const recallMessage: V2NIMMessageForUI = {
      ...message,
      isSelf: message.isSelf,
      sendingState: V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_SUCCEEDED,
      messageType: V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM,
      recallType: message.isSelf ? "reCallMsg" : "beReCallMsg",
      messageClientId: `recall-${message.messageClientId}`,
      createTime: message.createTime || Date.now(),
    };
    const isMergeForward = this.rootStore.msgStore.isChatMergedForwardMsg(message);
    if (
      message.isSelf &&
      !isMergeForward &&
      [
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM,
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT,
      ].includes(message.messageType as number)
    ) {
      recallMessage.oldText = message.text;
      recallMessage.canEdit = true;
      recallMessage.isRecallMsg = true;
      recallMessage.canEditTimer = setTimeout(() => {
        const state = this.conversationStates.get(message.conversationId as string);
        const topicId = message.topicRefer?.topicId;
        if (!state || !topicId) {
          return;
        }
        const messages = state.messages.get(topicId) || [];
        this.setTopicMessages(
          state,
          topicId,
          messages.map((item) =>
            item.messageClientId === recallMessage.messageClientId
              ? { ...item, canEdit: false }
              : item
          )
        );
      }, RECALL_TIME) as unknown as number;
    }

    return recallMessage;
  }

  private refreshTopicSummaryFromMessages(state: TopicConversationState, topicId: string): void {
    const topic = state.topics.get(topicId);
    const latestMessage = [...(state.messages.get(topicId) || [])]
      .filter((message) => shouldShowTopicSummaryMessage(message))
      .sort((left, right) => Number(right.createTime || 0) - Number(left.createTime || 0))[0];

    if (latestMessage) {
      state.summaries.set(topicId, {
        message: latestMessage,
        text: getTopicSummaryText(latestMessage),
        time: latestMessage.createTime,
        loading: false,
      });
    } else {
      state.summaries.set(topicId, {
        text: "",
        time: topic?.messageTime || topic?.updateTime || topic?.createTime,
        loading: false,
      });
    }
    this.refreshTopicRows(state);
  }

  private removeTopicMessageByRefer(refer?: V2NIMMessageRefer): void {
    const conversationId = refer?.conversationId;
    const messageClientId = refer?.messageClientId;
    if (!conversationId || !messageClientId) {
      return;
    }

    const state = this.conversationStates.get(conversationId);
    if (!state) {
      return;
    }

    state.messages.forEach((messages, topicId) => {
      const deletedMessages = messages.filter(
        (message) => message.messageClientId === messageClientId
      );
      const shouldRemove = deletedMessages.length > 0;
      if (!shouldRemove) {
        return;
      }
      this.setTopicMessages(
        state,
        topicId,
        this.markDeletedTopicReplyMessages(
          messages.filter((message) => message.messageClientId !== messageClientId),
          deletedMessages
        )
      );
      this.refreshTopicSummaryFromMessages(state, topicId);
    });
  }

  private recallTopicMessageByNotification(notification: V2NIMMessageRevokeNotification): void {
    const refer = notification.messageRefer;
    const conversationId = refer?.conversationId;
    const messageClientId = refer?.messageClientId;
    if (!conversationId || !messageClientId) {
      return;
    }

    const state = this.conversationStates.get(conversationId);
    if (!state) {
      return;
    }

    state.messages.forEach((messages, topicId) => {
      const oldMessage = messages.find((message) => message.messageClientId === messageClientId) as
        | V2NIMMessageForUI
        | undefined;
      if (!oldMessage || oldMessage.recallType) {
        return;
      }
      const sourceMessage = {
        ...oldMessage,
        ...(notification.message || {}),
        isSelf:
          notification.message?.isSelf ??
          refer.senderId === this.rootStore.userStore.myUserInfo.accountId,
        topicRefer: oldMessage.topicRefer || notification.message?.topicRefer,
      } as V2NIMMessageForUI;
      const recallMessage = this.createRecalledMessage(sourceMessage);
      this.setTopicMessages(
        state,
        topicId,
        [
          ...messages.filter((message) => message.messageClientId !== messageClientId),
          recallMessage,
        ]
      );
      this.refreshTopicSummaryFromMessages(state, topicId);
    });
  }

  private appendReceivedTopicMessage(message: V2NIMMessage): void {
    const conversationId = message.conversationId || message.topicRefer?.conversationId;
    const topicId = message.topicRefer?.topicId;
    if (!conversationId || !topicId) {
      return;
    }

    const state = this.conversationStates.get(conversationId);
    if (!state?.topics.has(topicId)) {
      return;
    }

    const currentMessages = state.messages.get(topicId);
    if (currentMessages) {
      const hasMessage = currentMessages.some((item) => this.isSameMessage(item, message));
      if (!hasMessage) {
        this.setTopicMessages(state, topicId, [...currentMessages, message]);
      }
    }

    this.refreshTopicRows(state);
  }

  private isTopicOpened(conversationId: string, topicId: string): boolean {
    if (this.rootStore.uiStore.selectedConversation !== conversationId) {
      return false;
    }

    const selected = this.conversationStates.get(conversationId)?.selected;
    return selected?.type === "topic" && selected.topicId === topicId;
  }

  private updateSendingProgress(
    state: TopicConversationState,
    topicId: string,
    sendingMessage: V2NIMMessage,
    percentage: number
  ): void {
    const realTopicId =
      sendingMessage.topicRefer?.topicId ||
      (sendingMessage.messageClientId
        ? this.sendingMessageTopicKeys.get(sendingMessage.messageClientId)?.topicKey
        : undefined) ||
      topicId;
    const messages = state.messages.get(realTopicId) || state.messages.get(topicId) || [];
    this.setTopicMessages(
      state,
      realTopicId,
      messages.map((item) =>
        item.messageClientId === sendingMessage.messageClientId
          ? { ...item, uploadProgress: percentage }
          : item
      )
    );
  }

  private updateSendingMessageFromEvent(message: V2NIMMessage): void {
    const messageClientId = message.messageClientId;
    const cached = messageClientId ? this.sendingMessageTopicKeys.get(messageClientId) : undefined;
    if (!messageClientId || !cached) {
      this.logger?.log("TopicStore on sendMessage no cached topic message", {
        conversationId: message.conversationId,
        messageClientId,
        topicRefer: message.topicRefer,
      });
      return;
    }

    if (isFailedMessage(message)) {
      const handledFirstMessageDraft = this.markFirstMessageDraftFailedFromEvent(message);
      if (handledFirstMessageDraft) {
        return;
      }
    }

    const state = this.getState(cached.conversationId);
    const messages = state.messages.get(cached.topicKey) || [];
    let matched = false;
    this.setTopicMessages(
      state,
      cached.topicKey,
      messages.map((item) => {
        if (item.messageClientId !== messageClientId) {
          return item;
        }
        matched = true;
        return {
          ...item,
          ...message,
          senderId: item.senderId || message.senderId,
          isSelf: item.isSelf ?? message.isSelf,
          previewImg: (item as V2NIMMessageForUI).previewImg,
          previewWidth: (item as V2NIMMessageForUI).previewWidth,
          previewHeight: (item as V2NIMMessageForUI).previewHeight,
          uploadProgress: (item as V2NIMMessageForUI).uploadProgress,
        };
      })
    );

    this.logger?.log("TopicStore on sendMessage matched cached topic message", {
      conversationId: cached.conversationId,
      topicKey: cached.topicKey,
      messageClientId,
      matched,
      messageCount: state.messages.get(cached.topicKey)?.length || 0,
      selectedType: state.selected.type,
    });
  }

  async loadTopicMessages(conversationId: string, topicId: string): Promise<void> {
    const state = this.getState(conversationId);
    const topic = state.topics.get(topicId);
    if (!this.canLoadTopicMessagesFromSDK(state, topicId, topic)) {
      runInAction(() => {
        state.messageLoading.set(topicId, false);
        state.messageLoadingMore.set(topicId, false);
        state.messageHasMore.set(topicId, false);
        state.messageError.delete(topicId);
      });
      return;
    }

    state.messageLoading.set(topicId, true);
    state.messageError.delete(topicId);

    try {
      const result = await this.nim.topicService?.getTopicMessageList({
        topic,
        limit: TOPIC_MESSAGE_LIMIT,
        direction: V2NIMQueryDirection.V2NIM_QUERY_DIRECTION_DESC,
        sortOrder: V2NIMSortOrder.V2NIM_SORT_ORDER_ASC,
      });

      runInAction(() => {
        state.messages.set(topicId, result?.replyList || []);
        state.messageHasMore.set(topicId, !!result?.hasMore);
        state.messageAnchor.set(topicId, result?.anchorMessage);
      });
    } catch (error) {
      runInAction(() => {
        state.messageError.set(topicId, toError(error));
      });
      throw error;
    } finally {
      runInAction(() => {
        state.messageLoading.set(topicId, false);
      });
    }
  }

  async loadMoreTopicMessages(conversationId: string, topicId: string): Promise<void> {
    const state = this.getState(conversationId);
    const topic = state.topics.get(topicId);
    if (
      !this.canLoadTopicMessagesFromSDK(state, topicId, topic) ||
      !state.messageHasMore.get(topicId) ||
      state.messageLoadingMore.get(topicId)
    ) {
      if (!this.canLoadTopicMessagesFromSDK(state, topicId, topic)) {
        runInAction(() => {
          state.messageLoadingMore.set(topicId, false);
          state.messageHasMore.set(topicId, false);
          state.messageError.delete(topicId);
        });
      }
      return;
    }

    state.messageLoadingMore.set(topicId, true);
    state.messageError.delete(topicId);

    try {
      const result = await this.nim.topicService?.getTopicMessageList({
        topic,
        anchorMessage: state.messageAnchor.get(topicId),
        limit: TOPIC_MESSAGE_LIMIT,
        direction: V2NIMQueryDirection.V2NIM_QUERY_DIRECTION_DESC,
        sortOrder: V2NIMSortOrder.V2NIM_SORT_ORDER_ASC,
      });

      const current = state.messages.get(topicId) || [];
      const incoming = result?.replyList || [];
      const existingIds = new Set(current.map((message) => message.messageClientId));
      runInAction(() => {
        state.messages.set(topicId, [
          ...incoming.filter((message) => !existingIds.has(message.messageClientId)),
          ...current,
        ]);
        state.messageHasMore.set(topicId, !!result?.hasMore);
        state.messageAnchor.set(topicId, result?.anchorMessage);
      });
    } catch (error) {
      runInAction(() => {
        state.messageError.set(topicId, toError(error));
      });
      throw error;
    } finally {
      runInAction(() => {
        state.messageLoadingMore.set(topicId, false);
      });
    }
  }

  private mergeTopics(
    state: TopicConversationState,
    topics: V2NIMTopic[],
    replaceOrder: boolean
  ): void {
    const nextOrder = replaceOrder
      ? state.order.filter((topicId) => this.isTempTopicId(topicId))
      : [...state.order];
    const skippedTopics: V2NIMTopic[] = [];

    topics.forEach((topic) => {
      const topicId = getTopicKey(topic);
      if (!topicId) {
        skippedTopics.push(topic);
        return;
      }

      state.topics.set(topicId, topic);
      if (!nextOrder.includes(topicId)) {
        nextOrder.push(topicId);
      }
    });

    state.order = nextOrder;
    this.refreshTopicRows(state);
    this.logger?.log("TopicStore mergeTopics", {
      conversationId: state.conversationId,
      incomingCount: topics.length,
      skippedCount: skippedTopics.length,
      order: state.order,
      topicListCount: state.topicList.length,
      topicRowCount: state.topicRows.length,
      skippedTopics,
      replaceOrder,
    });
  }

  private upsertTopic(topic: V2NIMTopic): void {
    const conversationId = topic.conversationId;
    const topicId = getTopicKey(topic);
    if (!conversationId || !topicId) {
      return;
    }

    const state =
      this.getCachedState(conversationId) ||
      (this.rootStore.uiStore.selectedConversation === conversationId
        ? this.getState(conversationId)
        : undefined);
    if (!state) {
      return;
    }

    const tempTopicId = this.findMatchingTempTopicId(topic);
    if (tempTopicId && this.tempTopicIds.has(tempTopicId)) {
      const sentMessage = state.messages.get(tempTopicId)?.[0] || ({
        conversationId,
        messageClientId: topic.messageClientId,
        messageServerId: topic.messageServerId,
        createTime: topic.messageTime || topic.updateTime || topic.createTime,
        topicRefer: {
          conversationId,
          topicId,
          createTime: topic.createTime,
        },
      } as V2NIMMessage);
      state.topics.set(topicId, topic);
      this.replaceTempTopic(state, tempTopicId, topicId, sentMessage);
      return;
    }

    state.topics.set(topicId, topic);
    if (!state.order.includes(topicId)) {
      state.order = [...state.order, topicId];
    }
    this.refreshTopicRows(state);

    if (state.selected.type === "draft" && state.draft?.conversationId === conversationId) {
      state.draft = undefined;
      state.selected = { type: "topic", conversationId, topicId };
    }
  }

  private createTopicRow(state: TopicConversationState, topic: V2NIMTopic): TopicRowForUI {
    const topicId = getTopicKey(topic);
    const summary = state.summaries.get(topicId) || this.createEmptySummary();
    const title = topic.topicName || t("topicSubsessionDefaultTitle");
    const summaryTime = summary.time || topic.messageTime || topic.updateTime || topic.createTime;
    const isEmptyDraftPlaceholder = this.isEmptyDraftPlaceholder(state, topicId);
    const isFirstMessageFailed =
      state.firstMessageDrafts.get(topicId)?.status === "failed" ||
      isFailedMessage(state.firstMessageDrafts.get(topicId)?.message) ||
      isFailedMessage(state.messages.get(topicId)?.[0]);

    return {
      topic,
      topicId,
      conversationId: topic.conversationId || state.conversationId,
      title,
      colorIndex: this.getColorIndex(topicId),
      summary: {
        ...summary,
        time: summaryTime,
      },
      timeText: isEmptyDraftPlaceholder ? "" : formatDate(summaryTime),
      hasUnread:
        !isEmptyDraftPlaceholder &&
        !isFirstMessageFailed &&
        !!state.readTime &&
        !!summaryTime &&
        summaryTime > state.readTime,
    };
  }

  private refreshTopicRows(state: TopicConversationState): void {
    state.topicList = state.order
      .map((topicId) => state.topics.get(topicId))
      .filter((topic): topic is V2NIMTopic => !!topic)
      .sort((a, b) => getTopicCreateSortTime(b) - getTopicCreateSortTime(a));
    state.topicRows = state.topicList.map((topic) => this.createTopicRow(state, topic));
  }

  private async enqueueSummaryLoad(conversationId: string, topic: V2NIMTopic): Promise<void> {
    const execute = async () => {
      await this.loadSummary(conversationId, topic);
    };
    const task = Promise.all(this.summaryTasks.slice(-3)).then(execute, execute);
    this.summaryTasks.push(task);
    task.finally(() => {
      this.summaryTasks = this.summaryTasks.filter((item) => item !== task);
    });
    return task;
  }

  private createEmptySummary(): TopicSummaryState {
    return {
      text: "",
      loading: false,
    };
  }

  private async getParentConversationReadTime(conversationId: string): Promise<number> {
    try {
      const readTime = this.rootStore.localOptions.enableCloudConversation
        ? await this.rootStore.conversationStore?.getConversationReadTimeActive(conversationId)
        : await this.rootStore.localConversationStore?.getConversationReadTimeActive(conversationId);

      return Number(readTime || 0);
    } catch (error) {
      this.logger?.error("TopicStore get parent conversation read time failed", {
        conversationId,
        error,
      });
      return 0;
    }
  }

  shouldMarkParentConversationRead(state: TopicConversationState, topicId: string): boolean {
    const row = state.topicRows.find((item) => item.topicId === topicId);
    const lastMessageTime = Number(
      row?.summary?.time ||
        row?.topic?.messageTime ||
        row?.topic?.updateTime ||
        row?.topic?.createTime ||
        0
    );
    const readTime = Number(state.readTime || 0);

    return !!lastMessageTime && lastMessageTime > readTime;
  }

  private async markParentConversationRead(conversationId: string): Promise<void> {
    try {
      const readTime = this.rootStore.localOptions.enableCloudConversation
        ? await this.rootStore.conversationStore?.markConversationReadActive(conversationId)
        : await this.rootStore.localConversationStore?.markConversationReadActive(conversationId);

      runInAction(() => {
        const state = this.getState(conversationId);
        state.readTime = Number(readTime || Date.now());
        this.refreshTopicRows(state);
      });
    } catch (error) {
      this.logger?.error("TopicStore mark parent conversation read failed", {
        conversationId,
        error,
      });
    }
  }

  private getColorIndex(topicId: string): number {
    let hash = 0;
    for (let index = 0; index < topicId.length; index += 1) {
      hash = (hash * 31 + topicId.charCodeAt(index)) | 0;
    }

    return Math.abs(hash) % 7;
  }

  private findMatchingTempTopicId(topic: V2NIMTopic): string | undefined {
    const conversationId = topic.conversationId;
    if (!conversationId) {
      return undefined;
    }

    const cached = topic.messageClientId
      ? this.sendingMessageTopicKeys.get(topic.messageClientId)
      : undefined;
    if (cached?.conversationId === conversationId && this.tempTopicIds.has(cached.topicKey)) {
      return cached.topicKey;
    }

    if (topic.messageClientId && this.tempTopicIds.has(topic.messageClientId)) {
      return topic.messageClientId;
    }

    const state = this.conversationStates.get(conversationId);
    if (!state) {
      return undefined;
    }

    const tempTopicIds = Array.from(this.tempTopicIds).filter((topicId) => {
      const tempTopic = state.topics.get(topicId);
      if (!tempTopic || tempTopic.conversationId !== conversationId) {
        return false;
      }

      return (
        (!!topic.messageClientId && tempTopic.messageClientId === topic.messageClientId) ||
        (!!topic.messageServerId && tempTopic.messageServerId === topic.messageServerId)
      );
    });
    if (tempTopicIds.length) {
      return tempTopicIds[0];
    }

    const sendingTempTopicIds = Array.from(state.firstMessageDrafts.values())
      .filter((draft) => {
        if (
          draft.conversationId !== conversationId ||
          (draft.status !== "sending" && draft.status !== "failed") ||
          !this.isTempTopicId(draft.topicKey)
        ) {
          return false;
        }

        const tempTopic = state.topics.get(draft.topicKey);
        if (!tempTopic || tempTopic.conversationId !== conversationId) {
          return false;
        }

        const titleMatched =
          !!topic.topicName && !!tempTopic.topicName && topic.topicName === tempTopic.topicName;
        const timeMatched =
          isCloseTopicTime(topic.createTime, tempTopic.createTime) ||
          isCloseTopicTime(topic.messageTime, tempTopic.messageTime) ||
          isCloseTopicTime(topic.updateTime, tempTopic.updateTime);

        return titleMatched && timeMatched;
      })
      .map((draft) => draft.topicKey);
    if (sendingTempTopicIds.length === 1) {
      this.logger?.log("TopicStore match topicAdded by unique first message draft", {
        conversationId,
        realTopicId: getTopicKey(topic),
        tempTopicId: sendingTempTopicIds[0],
        topicName: topic.topicName,
      });
      return sendingTempTopicIds[0];
    }

    return undefined;
  }

  private _onTopicAdded(topic: V2NIMTopic): void {
    const conversationId = topic.conversationId;
    const topicId = getTopicKey(topic);
    const tempTopicId = this.findMatchingTempTopicId(topic);
    if (conversationId && topicId && tempTopicId && this.tempTopicIds.has(tempTopicId)) {
      const state = this.getState(conversationId);
      const sentMessage =
        (state.messages.get(tempTopicId) || []).find(
          (message) => message.messageClientId === topic.messageClientId
        ) || ({
          conversationId,
          messageClientId: topic.messageClientId,
          messageServerId: topic.messageServerId,
          createTime: topic.messageTime || topic.updateTime || topic.createTime,
          topicRefer: {
            conversationId,
            topicId,
            createTime: topic.createTime,
          },
        } as V2NIMMessage);

      state.topics.set(topicId, topic);
      this.replaceTempTopic(state, tempTopicId, topicId, sentMessage);
      this.sendingMessageTopicKeys.forEach((value, key) => {
        if (value.conversationId === conversationId && value.topicKey === tempTopicId) {
          this.sendingMessageTopicKeys.delete(key);
        }
      });
      return;
    }

    if (conversationId && topicId) {
      const state = this.conversationStates.get(conversationId);
      const matchingDraft = state
        ? Array.from(state.firstMessageDrafts.values()).find((draft) => {
            if (draft.realTopicId !== topicId || draft.topicKey === topicId) {
              return false;
            }

            const tempTopic = state.topics.get(draft.topicKey);
            return !!tempTopic && this.isTempTopicId(draft.topicKey);
          })
        : undefined;
      if (state && matchingDraft) {
        const sentMessage = state.messages.get(matchingDraft.topicKey)?.[0] || matchingDraft.message;
        state.topics.set(topicId, topic);
        this.replaceTempTopic(state, matchingDraft.topicKey, topicId, sentMessage);
        return;
      }
    }

    this.upsertTopic(topic);
  }

  private _onTopicsRemoved(topicRefers: V2NIMTopicRefer[]): void {
    topicRefers.forEach((topicRefer) => {
      const conversationId = topicRefer.conversationId;
      const topicId = topicRefer.topicId;
      if (!conversationId || !topicId) {
        return;
      }

      const state = this.conversationStates.get(conversationId);
      if (!state) {
        return;
      }

      state.topics.delete(topicId);
      state.summaries.delete(topicId);
      state.order = state.order.filter((item) => item !== topicId);
      this.refreshTopicRows(state);
      if (state.selected.type === "topic" && state.selected.topicId === topicId) {
        state.selected = createEmptySelected();
      }
    });
  }

  private _onTopicUpdated(topic: V2NIMTopic): void {
    const conversationId = topic.conversationId;
    const topicId = getTopicKey(topic);
    if (conversationId && topicId) {
      const state = this.conversationStates.get(conversationId);
      state?.summaries.delete(topicId);
    }
    this.upsertTopic(topic);
  }

  private _onSendMessage(message: V2NIMMessage): void {
    this.logger?.log("TopicStore on sendMessage", {
      conversationId: message.conversationId,
      messageClientId: message.messageClientId,
      messageServerId: message.messageServerId,
      messageType: message.messageType,
      sendingState: message.sendingState,
      createTime: message.createTime,
      topicRefer: message.topicRefer,
      hasTopicId: !!message.topicRefer?.topicId,
      message,
    });

    if (!message.topicRefer?.topicId) {
      this.logger?.log("TopicStore on sendMessage skipped: no topicRefer.topicId", {
        conversationId: message.conversationId,
        messageClientId: message.messageClientId,
        topicRefer: message.topicRefer,
        message,
      });
      this.updateSendingMessageFromEvent(message);
      return;
    }

    this.upsertTopicSendingMessage(message);
    this.updateTopicSummaryFromMessage(message);
  }

  private _onReceiveMessages(messages: V2NIMMessage[]): void {
    messages.forEach((message) => {
      if (!message.topicRefer?.topicId) {
        return;
      }

      this.appendReceivedTopicMessage(message);
      this.updateTopicSummaryFromMessage(message);
      const conversationId = message.conversationId || message.topicRefer?.conversationId;
      const topicId = message.topicRefer.topicId;
      if (conversationId && this.isTopicOpened(conversationId, topicId)) {
        void this.markParentConversationRead(conversationId);
      }
    });
  }

  private _onMessageDeletedNotifications(data: V2NIMMessageDeletedNotification[]): void {
    data.forEach((item) => {
      this.removeTopicMessageByRefer(item.messageRefer);
    });
  }

  private _onMessageRevokeNotifications(data: V2NIMMessageRevokeNotification[]): void {
    data.forEach((item) => {
      this.recallTopicMessageByNotification(item);
    });
  }
}
