<template>
  <div v-if="selectedConversation" class="chat-container-wrapper">
    <div class="chat-container">
      <!-- 聊天标题 -->
      <ChatHeader
        :to="to"
        :title="title"
        :subTitle="subTitle"
        :avatar="teamAvatar"
        :conversationType="conversationType"
        :updateTime="headerUpdateTime"
      />
      <!-- 陌生人提示 -->
      <NotFriendTip
        :visible="strangerTipVisible"
        :appellation="appellation"
        @close="handleStrangerTipClose"
      />
      <!-- 消息列表 -->
      <MessageList
        ref="messageListRef"
        :conversationType="conversationType"
        :to="to"
        :msgs="msgs"
        :loading-more="loadingMore"
        :isFirstLoad="isFirstLoad"
        :no-more="noMore"
        :reply-msgs-map="replyMsgsMap"
      />
      <!-- 新消息提示 -->
      <NewMessageTip :visible="showNewMsgTip" @click="scrollToBottomAndHideNewMsgTip" />
      <!-- 回到底部按钮 -->
      <BackToBottomBtn
        :visible="showBackToBottomBtn && !showNewMsgTip"
        :hasNewMessage="showNewMsgTip"
        @click="handleBackToBottom"
      />
      <MultiMessageOperation
        v-if="isMultiSelectMode"
        @cancel="handleMergeCancel"
        @forward="handleMergeForward"
        @delete="handleMergeDelete"
      />
      <!-- 消息输入框 -->
      <MessageInput
        v-else
        :reply-msgs-map="replyMsgsMap"
        :conversation-type="conversationType"
        :to="to"
        :conversationId="selectedConversation"
        :inputPlaceholder="inputPlaceholder"
      />
    </div>
    <div class="chat-slide-bar">
      <div @click="showSettingDrawer" class="slide-bar-icon setting-icon">
        <Icon type="icon-setting" :size="24"></Icon>
      </div>
      <div @click="showChatHistoryDrawer" class="slide-bar-icon chat-history-icon">
        <Icon type="icon-chat-history" :size="24"></Icon>
      </div>
      <!-- 聊天设置 -->
      <ChatSettingDrawer
        v-if="curDrawerVisible == 'setting'"
        :visible="true"
        :to="to"
        :conversationType="conversationType"
        @update:visible="(visible) => !visible && (curDrawerVisible = 'empty')"
      />
      <!-- 聊天历史记录 -->
      <ChatHistoryDrawer
        v-if="curDrawerVisible == 'history'"
        :visible="true"
        :to="to"
        :conversationType="conversationType"
        @update:visible="(visible) => !visible && (curDrawerVisible = 'empty')"
      />
    </div>
  </div>
  <div class="welcome-wrapper" v-else>
    <Welcome />
  </div>
  <MessageForwardModal
    v-if="showForwardModal"
    :visible="showForwardModal"
    :msg="forwardMsg"
    :isMergeForward="isMergeForward"
    @close="handleForwardModalClose"
    @send="handleForwardSendSuccess"
  />
  <!-- 好友名片 组件 -->
  <UserCardModal
    v-if="showUserCardModal"
    :visible="showUserCardModal"
    :account="userCardAccount"
    @close="showUserCardModal = false"
  />
</template>
<script lang="ts" setup>
import { trackInit } from "../utils/reporter";
import { autorun } from "mobx";
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from "vue";
import ChatHeader from "./message/chat-header.vue";
import MessageList from "./message/message-list.vue";
import MessageInput from "./message/message-input.vue";
import MultiMessageOperation from "./forward/multi-message-operation.vue";
import ChatSettingDrawer from "./setting/index.vue";
import ChatHistoryDrawer from "./history/index.vue";
import NewMessageTip from "./message/new-message-tip.vue";
import BackToBottomBtn from "./message/back-to-bottom-btn.vue";
import NotFriendTip from "./message/not-friend-tip.vue";
import MessageForwardModal from "./message/message-forward-modal.vue";
import UserCardModal from "../CommonComponents/UserCardModal.vue";
import { HISTORY_LIMIT, events } from "../utils/constants";
import { t } from "../utils/i18n";
import { V2NIMConst } from "../utils/constants";
import { V2NIMQueryDirection } from "node-nim";
import { showToast, toast } from "../utils/toast";
import { modal } from "../utils/modal";
import Welcome from "../CommonComponents/Welcome.vue";
import Icon from "../CommonComponents/Icon.vue";
import emitter from "../utils/eventBus";
import type { V2NIMMessageForUI } from "../store/types";
import type { V2NIMMessage, V2NIMMessageRefer } from "node-nim/types/v2_def/v2_nim_struct_def";
import { getFileMd5, isDiscussionFunc } from "../utils";
import { getContextState } from "../utils/init";
import { V2NIMConversationType, V2NIMUserStatusType } from "node-nim";
import { getMsgContentTipByType, isMessageNoError } from "../utils/msg";
import packageJson from "../../../../package.json";
import sdkPkg from "node-nim/package.json";

const appVersion = packageJson.version;
const sdkVersion = sdkPkg.version;

export interface YxReplyMsg {
  messageClientId: string;
  scene: V2NIMConversationType;
  from: string;
  receiverId: string;
  to: string;
  idServer: string;
  time: number;
}

const { store, nim } = getContextState();

// 聊天标题
const title = ref("");
// 聊天子标题
const subTitle = ref("");
// 设置抽屉
const curDrawerVisible = ref<"empty" | "setting" | "history">("empty");
// 消息列表
const messageListRef = ref<{
  getScrollInfo: () => {
    height: number;
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
    distanceFromBottom: number;
  };
  scrollToBottom: () => void;
  messageListRef: HTMLElement | null;
} | null>(null);

/**当前选中的会话Id*/
const selectedConversation = ref("");

/**会话类型 */
const conversationType = computed(() => {
  return nim?.conversationIdUtil?.parseConversationType(
    selectedConversation.value
  ) as V2NIMConversationType;
});

/**对话方 */
const to = computed(() => {
  return nim?.conversationIdUtil?.parseConversationTargetId(selectedConversation.value) || "";
});

/**群头像 */
const teamAvatar = ref<string>("");

//上报埋点，便于线上问题排查, 不建议去除
trackInit("ChatUIKit");

/**是否需要显示群组消息已读未读，默认 false */
const teamMsgReceiptVisible = store?.localOptions.teamMsgReceiptVisible;

/**是否需要显示 p2p 消息、p2p会话列表消息已读未读，默认 false */
const p2pMsgReceiptVisible = store?.localOptions.p2pMsgReceiptVisible;

/**是否需要显示在线离线状态 */
const loginStateVisible = store?.localOptions.loginStateVisible;

// 加载更多
const loadingMore = ref(false);

/**是否还有更多历史消息 */

const noMore = ref(false);

/**消息列表 */
const msgs = ref<V2NIMMessage[]>([]);

/**回复消息map，用于回复消息的解析处理 */
const replyMsgsMap = ref<Record<string, V2NIMMessage>>();

/** 已经请求过的被回复消息 idServer 集合，避免重复触发频控 */
const fetchedReplyServerIds = new Set<string>();

/** 新消息提醒 */
const showNewMsgTip = ref(false);

/** 回到底部按钮 */
const showBackToBottomBtn = ref(false);

/** 是否是首次加载 */
const isFirstLoad = ref(true);

/** 陌生人提示相关 */
const strangerTipVisible = ref(false);

/** 陌生人提示相关 */
const appellation = ref("");

/** 关闭陌生人提示 */
const handleStrangerTipClose = () => {
  strangerTipVisible.value = false;
};

/** 检查是否为陌生人关系 */
const checkStrangerRelation = () => {
  if (
    conversationType.value === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P &&
    to.value
  ) {
    const { relation } = store?.uiStore.getRelation(to.value) || {
      relation: "stranger",
    };
    appellation.value = store?.uiStore.getAppellation({
      account: to.value,
    }) as string;
    strangerTipVisible.value = relation === "stranger";
  } else {
    strangerTipVisible.value = false;
  }
};

/** 处理转发消息 */
const showForwardModal = ref(false);
/** 转发消息 */
const forwardMsg = ref<V2NIMMessage>();
const isMergeForward = ref(false);
const isMultiSelectMode = ref(false);

const multiSelectWatch = autorun(() => {
  isMultiSelectMode.value = store?.uiStore.isMultiSelectMode || false;
});

const handleMergeCancel = () => {
  store?.uiStore.setMultiSelectMode(false);
};

const handleMergeForward = async () => {
  const selectedIds = store?.uiStore.selectedMessageIds;
  if (!selectedIds || selectedIds.length === 0) {
    toast.error(t("pleaseSelectMsg"));
    return;
  }

  if (selectedIds.length > 100) {
    toast.error(t("forwardMsgMax100Text"));
    return;
  }

  const msgsToForward = store?.msgStore.getMsg(store.uiStore.selectedConversation, selectedIds);

  if (!msgsToForward || msgsToForward.length === 0) {
    return;
  }

  // Sort messages by time
  msgsToForward.sort((a, b) => (a.createTime || 0) - (b.createTime || 0));

  // 序列化消息列表并上传（需要先序列化以获取深度信息）
  const {
    content: mergedMsgsTxt,
    depth,
    msgDepths,
  } = store.msgStore.serializeMergeMsgs(msgsToForward, {
    appVersion,
    sdkVersion,
  });

  // 一次性收集所有不可转发的消息：发送失败 + 层级 >= 3
  const invalidMsgIds: string[] = [];
  msgsToForward.forEach((msg) => {
    const isFailed =
      msg.sendingState === V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_FAILED ||
      !isMessageNoError(msg.messageStatus?.errorCode);
    const isTooDeep = (msgDepths.get(msg.messageClientId as string) ?? 0) >= 3;
    if (isFailed || isTooDeep) {
      if (msg.messageClientId) {
        invalidMsgIds.push(msg.messageClientId);
      }
    }
  });

  if (invalidMsgIds.length > 0) {
    invalidMsgIds.forEach((id) => {
      store?.uiStore.unselectMessage(id);
    });
    toast.error(t("forwardMsgHasUnforwardableText"));
    return;
  }

  // 检查网络状态，如果断开则提示
  const isConnected =
    store?.connectStore?.connectStatus ===
    V2NIMConst.V2NIMConnectStatus.V2NIM_CONNECT_STATUS_CONNECTED;
  if (!isConnected) {
    toast.error(t("networkError"));
    return;
  }

  // 将 mergedMsgs 写入 txt 文件并上传
  let mergedMsgsFile: File;
  if (window.electronAPI?.fs?.writeTempFile) {
    // Electron 环境：通过 fs API 写入临时文件
    const filePath = await window.electronAPI.fs.writeTempFile(
      mergedMsgsTxt,
      `mergedMsgs_${Date.now()}.txt`
    );

    if (!filePath) {
      toast.error("创建临时文件失败");
      return;
    }

    // 创建包含实际内容的 File 对象
    // Electron 环境下，SDK 上传依赖 path 属性，但 getFileMd5 依赖 File 内容
    mergedMsgsFile = new File([mergedMsgsTxt], "mergedMsgs.txt", {
      type: "text/plain",
    });

    // 关键：在 Electron 中，上传通常依赖于 file.path。手动设置 path 属性。
    Object.defineProperty(mergedMsgsFile, "path", {
      value: filePath,
      writable: false,
    });
  } else {
    // Web 环境
    mergedMsgsFile = new File([mergedMsgsTxt], "mergedMsgs.txt", {
      type: "text/plain",
    });
  }

  let fileUrl: string;
  try {
    fileUrl = await store.storageStore.uploadFileActive(mergedMsgsFile);
  } catch (error) {
    console.error("合并转发上传失败:", error);
    // 上传失败，清理临时文件
    if (window.electronAPI?.fs && (mergedMsgsFile as any).path) {
      await window.electronAPI.fs.deleteTempFile((mergedMsgsFile as any).path);
    }
    toast.error(t("networkError"));
    return;
  }
  const md5 = await getFileMd5(mergedMsgsFile);

  // 上传完成后，如果是 Electron 环境，删除临时文件
  if (window.electronAPI?.fs && (mergedMsgsFile as any).path) {
    await window.electronAPI.fs.deleteTempFile((mergedMsgsFile as any).path);
  }

  // 创建合并转发自定义消息
  const abstracts = [...msgsToForward]
    .sort((a, b) => (a.createTime || 0) - (b.createTime || 0))
    .slice(0, 3)
    .map((m) => {
      const senderId = (m as any).__kit__senderId || m.senderId;
      const senderNick = store.uiStore.getAppellation({
        account: senderId,
        ignoreAlias: true,
      });

      const tip = getMsgContentTipByType({
        messageType: m.messageType,
        text: store.msgStore.isChatMergedForwardMsg(m) ? `[${t("chatHistoryText")}]` : m.text || "",
      });
      const content = typeof tip === "string" ? tip : m.text || "";

      return {
        senderNick,
        content,
        userAccId: senderId,
      };
    });

  const sourceConversationId = msgsToForward[0]?.conversationId || "";
  const convType = nim?.conversationIdUtil?.parseConversationType(sourceConversationId);
  const sessionId = nim?.conversationIdUtil?.parseConversationTargetId(sourceConversationId) || "";
  const sessionName =
    convType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM
      ? store.teamStore.teams.get(sessionId)?.name || sessionId
      : store.uiStore.getAppellation({ account: sessionId, ignoreAlias: true });

  const customForwardMsg = nim?.messageCreator?.createCustomMessage(
    `[${t("chatHistoryText")}]`,
    JSON.stringify({
      type: 101,
      data: {
        abstracts,
        depth,
        md5,
        sessionId,
        sessionName,
        url: fileUrl,
      },
    })
  );

  forwardMsg.value = customForwardMsg as V2NIMMessage;
  isMergeForward.value = true;
  showForwardModal.value = true;
};

const handleMergeDelete = () => {
  const selectedIds = store?.uiStore.selectedMessageIds;
  if (!selectedIds || selectedIds.length === 0) {
    toast.error(t("pleaseSelectMsg"));
    return;
  }

  if (selectedIds.length > 50) {
    toast.error(t("deleteMsgMax50Text"));
    return;
  }

  const msgsToDelete = store?.msgStore.getMsg(store.uiStore.selectedConversation, selectedIds);

  if (!msgsToDelete || msgsToDelete.length === 0) {
    return;
  }

  modal.confirm({
    title: t("deleteText"),
    content: t("deleteMsgConfirmText"),
    onConfirm: async () => {
      try {
        await store?.msgStore.deleteMsgActive(msgsToDelete);
        store?.uiStore.setMultiSelectMode(false);
        toast.success(t("deleteSuccessText"));
      } catch (error) {
        toast.error(t("deleteFailedText"));
      }
    },
  });
};

const handleForwardModalClose = () => {
  showForwardModal.value = false;
};

const handleForwardSendSuccess = () => {
  if (isMergeForward.value) {
    store?.uiStore.setMultiSelectMode(false);
    isMergeForward.value = false;
  }
};

/** 个人名片 */
const showUserCardModal = ref(false);
/** 个人名片账号 */
const userCardAccount = ref("");

/**显示设置 */
const showSettingDrawer = () => {
  curDrawerVisible.value = "setting";
};

/**显示聊天历史 */
const showChatHistoryDrawer = () => {
  curDrawerVisible.value = "history";
};

/**输入框placeholder */
const inputPlaceholder = ref("");

/** 设置页面标题 */
const setChatHeaderAndPlaceholder = () => {
  // 单聊
  if (
    conversationType.value === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P &&
    to.value
  ) {
    title.value = store?.uiStore.getAppellation({
      account: to.value,
    }) as string;
    subTitle.value = "";
    if (loginStateVisible) {
      subTitle.value =
        store?.subscriptionStore.stateMap.get(to.value)?.statusType ===
        V2NIMUserStatusType.V2NIM_USER_STATUS_TYPE_LOGIN
          ? `(${t("userOnlineText")})`
          : `(${t("userOfflineText")})`;
    }

    let userNickOrAccount =
      store?.uiStore.getAppellation({
        account: to.value,
      }) || "";
    if (userNickOrAccount.length > 15) {
      userNickOrAccount = userNickOrAccount.slice(0, 15) + "...";
    }
    inputPlaceholder.value = t("sendToText") + " " + userNickOrAccount;
    // 群聊
  } else if (
    conversationType.value === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM &&
    to.value
  ) {
    const team = store?.teamStore.teams.get(to.value);
    subTitle.value = `(${team?.memberCount || 0}${t("personUnit")})`;
    title.value = team?.name || "";

    inputPlaceholder.value = t("sendToText") + " " + team?.name;
  }
  // 检查陌生人关系
  checkStrangerRelation();
};

/** 解散群组回调 */
const onTeamDismissed = (data: any) => {
  if (data.teamId === to) {
    showToast({
      message: t("onDismissTeamText"),
      type: "info",
      duration: 1000,
    });
  }
};

/** 自己主动离开群组或被管理员踢出回调 */
const onTeamLeft = (data: any) => {
  const isDiscussion = isDiscussionFunc(data?.serverExtension);
  showToast({
    message: isDiscussion ? t("onRemoveDiscussionText") : t("onRemoveTeamText"),
    type: "warning",
    duration: 1000,
  });
};

/** 收到新消息 */
const onReceiveMessages = (msgs: V2NIMMessage[]) => {
  // 当前在聊天页，视为消息已读，发送已读回执
  if (msgs.length && !msgs[0]?.isSelf && msgs[0].conversationId == selectedConversation.value) {
    handleMsgReceipt(msgs);
  }

  if (messageListRef.value && msgs[0].conversationId == selectedConversation.value) {
    const scrollInfo = messageListRef.value.getScrollInfo();
    if (scrollInfo.distanceFromBottom < 300) {
      messageListRef.value.scrollToBottom();
    } else {
      showNewMsgTip.value = true;
    }
  }
};

/** 点击新消息提醒，滚动到底部并隐藏提醒 */
const scrollToBottomAndHideNewMsgTip = async () => {
  showNewMsgTip.value = false;

  // 如果当前处于跳转状态，需要退出跳转状态并重新加载最新消息
  if (store?.uiStore.isJumpedFromHistory) {
    // 退出跳转状态
    store.uiStore.setJumpedFromHistory(false);

    // 清除当前消息并重新拉取最新消息
    if (selectedConversation.value) {
      store?.msgStore.msgs.delete(selectedConversation.value);

      // 重新拉取最新的消息
      await getHistory(0);

      // 等待DOM更新后滚动到底部
      nextTick(() => {
        if (messageListRef.value) {
          messageListRef.value.scrollToBottom();
        }
      });
    }
  } else {
    // 正常情况下只需要滚动到底部
    if (messageListRef.value) {
      messageListRef.value.scrollToBottom();
    }
  }
};

/** 处理回到底部按钮点击 */
const handleBackToBottom = async () => {
  showBackToBottomBtn.value = false;
  showNewMsgTip.value = false; // 清除新消息提示

  // 退出跳转状态
  if (store?.uiStore.isJumpedFromHistory) {
    store.uiStore.setJumpedFromHistory(false);
  }

  // 清除当前消息并重新拉取最新消息
  if (selectedConversation.value) {
    store?.msgStore.msgs.delete(selectedConversation.value);

    // 重新拉取最新的消息
    await getHistory(0);

    // 等待DOM更新后滚动到底部
    nextTick(() => {
      if (messageListRef.value) {
        messageListRef.value.scrollToBottom();
      }
    });
  }
};

/** 处理收到消息的已读回执 */
const handleMsgReceipt = (msg: V2NIMMessage[]) => {
  if (
    msg[0].conversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P &&
    p2pMsgReceiptVisible
  ) {
    store?.msgStore.sendMsgReceiptActive(msg[0]);
  } else if (
    msg[0].conversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM &&
    teamMsgReceiptVisible
  ) {
    store?.msgStore.sendTeamMsgReceiptActive(msg);
  }
};

/** 处理历史消息的已读未读 */
const handleHistoryMsgReceipt = (msgs: V2NIMMessage[]) => {
  /** 如果是单聊 */
  if (
    conversationType.value === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P &&
    p2pMsgReceiptVisible
  ) {
    const myUserAccountId = nim?.loginService?.getLoginUser();
    const othersMsgs = msgs
      .filter(
        (item: V2NIMMessage) =>
          // @ts-ignore
          !["beReCallMsg", "reCallMsg"].includes(item.recallType || "")
      )
      .filter((item: V2NIMMessage) => item.senderId !== myUserAccountId);

    /** 发送单聊消息已读回执 */
    if (othersMsgs.length > 0) {
      store?.msgStore.sendMsgReceiptActive(othersMsgs?.[0]);
    }

    /** 如果是群聊 */
  } else if (
    conversationType.value === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM &&
    teamMsgReceiptVisible
  ) {
    const myUserAccountId = nim?.loginService?.getLoginUser();
    const myMsgs = msgs
      .filter(
        (item: V2NIMMessage) =>
          // @ts-ignore
          !["beReCallMsg", "reCallMsg"].includes(item.recallType || "")
      )
      .filter((item: V2NIMMessage) => item.senderId === myUserAccountId);

    store?.msgStore.getTeamMsgReadsActive(myMsgs, selectedConversation.value);

    // 发送群消息已读回执
    // sdk 要求 一次最多传入 50 个消息对象
    const othersMsgs = msgs
      .filter(
        (item: V2NIMMessage) =>
          // @ts-ignore
          !["beReCallMsg", "reCallMsg"].includes(item.recallType || "")
      )
      .filter((item: V2NIMMessage) => item.senderId !== myUserAccountId);

    if (othersMsgs.length > 0 && othersMsgs.length < 50) {
      store?.msgStore.sendTeamMsgReceiptActive(othersMsgs);
    }
  }
};

/** 拉取历史消息 */
const getHistory = async (endTime: number, lastMsgId?: string) => {
  try {
    if (noMore.value) {
      return [];
    }

    if (loadingMore.value) {
      return [];
    }
    loadingMore.value = true;
    if (selectedConversation.value) {
      const historyMsgs = await store?.msgStore.getHistoryMsgActive({
        conversationId: selectedConversation.value,
        endTime,
        lastMsgId,
        limit: HISTORY_LIMIT,
      });

      loadingMore.value = false;

      if (historyMsgs?.length) {
        if (historyMsgs.length < HISTORY_LIMIT) {
          noMore.value = true;
        }

        // 消息已读未读相关
        handleHistoryMsgReceipt(historyMsgs);
        return historyMsgs;
      } else {
        noMore.value = true;
      }
    }
  } catch (error: any) {
    loadingMore.value = false;
    switch (error.code) {
      case 109404:
        toast.info(t("onDismissTeamText"));
        store?.conversationStore?.deleteConversationActive(selectedConversation.value);
        break;

      default:
        break;
    }
    throw error;
  }
};

/** 订阅在线离线状态 */
const subscribeUserStatus = (selectedConversation: string) => {
  const to = nim?.conversationIdUtil?.parseConversationTargetId(selectedConversation) as string;

  const conversationType = nim?.conversationIdUtil?.parseConversationType(selectedConversation);
  if (
    store?.localOptions.loginStateVisible &&
    conversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P
  ) {
    store.subscriptionStore.subscribeUserStatusActive([to]);
  }
};

/** 加载更多消息 - 基于第一条消息往上查询15条 */
const loadMoreMsgs = (firstMsg: any) => {
  console.log("loadMoreMsgs 被调用，第一条消息:", firstMsg?.text || firstMsg?.messageType);
  if (firstMsg) {
    // 基于第一条消息往上查询15条消息
    getHistory(firstMsg.createTime || 0, firstMsg.messageServerId);
  } else {
    getHistory(0);
  }
};

/** 加载更多新消息（跳转状态下向下滚动） - 基于最后一条消息往下查询,支持自动填充gap */
const loadNextMsgs = async (lastMsg: V2NIMMessage) => {
  console.log("loadNextMsgs 被调用，最后一条消息:", lastMsg?.text || lastMsg?.messageType);
  if (!selectedConversation.value || !lastMsg || loadingMore.value) {
    return;
  }

  try {
    loadingMore.value = true;

    const nextMsgs = await nim?.messageService?.getMessageList({
      conversationId: selectedConversation.value,
      anchorMessage: lastMsg,
      limit: HISTORY_LIMIT,
      direction: V2NIMQueryDirection.V2NIM_QUERY_DIRECTION_ASC, // 向后查询获取后续消息
    });

    console.log(
      `基于最后一条消息往下查询，预期加载 ${HISTORY_LIMIT} 条，实际获取到 ${nextMsgs?.length || 0} 条消息`
    );

    if (nextMsgs && nextMsgs.length > 0) {
      // 过滤掉锚点消息本身（第一条）
      const filteredMsgs = nextMsgs.filter(
        (msg) => msg.messageClientId !== lastMsg.messageClientId
      );

      console.log(`过滤后实际添加 ${filteredMsgs.length} 条消息`);

      if (filteredMsgs.length > 0) {
        store?.msgStore.addMsg(selectedConversation.value, filteredMsgs);
      }

      // 判断是否已经加载完毕：实际返回数量小于预期数量
      if (nextMsgs.length < HISTORY_LIMIT) {
        console.log("实际返回消息数量小于预期，已无更多消息，退出跳转状态");
        store?.uiStore.setJumpedFromHistory(false);

        // 🔑 已经加载到最新消息，隐藏新消息提醒
        showNewMsgTip.value = false;
        console.log("已加载到最新消息，隐藏新消息提醒");

        return;
      }

      // 如果返回的消息数量等于预期数量，继续保持跳转状态
      console.log("返回消息数量等于预期，保持跳转状态");
    } else {
      // 没有更多新消息，直接退出跳转状态
      console.log("没有更多新消息，退出跳转状态");
      store?.uiStore.setJumpedFromHistory(false);

      // 🔑 已经加载到最新消息，隐藏新消息提醒
      showNewMsgTip.value = false;
      console.log("已加载到最新消息，隐藏新消息提醒");
    }
  } catch (error) {
    console.error("Failed to load next messages:", error);
  } finally {
    loadingMore.value = false;
    // 通知消息列表组件重置加载状态
    console.log("📤 发送 RESET_LOADING_MORE_MESSAGES 事件");
    emitter.emit(events.RESET_LOADING_MORE_MESSAGES);
  }
};

const headerUpdateTime = ref<number | undefined>(0);

/** 监听聊天标题 */
const chatHeaderWatch = autorun(() => {
  if (conversationType.value === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P) {
    title.value = store?.uiStore.getAppellation({
      account: to.value,
    }) as string;
    subTitle.value = "";
    headerUpdateTime.value = store?.userStore.myUserInfo.updateTime;
  } else if (
    conversationType.value === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM
  ) {
    const team = store?.teamStore.teams.get(to.value);
    subTitle.value = `(${team?.memberCount || 0}${t("personUnit")})`;
    title.value = team?.name || "";
    headerUpdateTime.value = team?.updateTime;
  }
});

// 重置状态
const resetState = () => {
  replyMsgsMap.value = {};
  msgs.value = [];
  isFirstLoad.value = true;
  curDrawerVisible.value = "empty";
  showNewMsgTip.value = false;
  showBackToBottomBtn.value = false; // 重置回到底部按钮状态
  noMore.value = false;
  loadingMore.value = false;
  title.value = "";
  subTitle.value = "";
  headerUpdateTime.value = undefined;
  fetchedReplyServerIds.clear();

  // 重置跳转相关状态
  if (store?.uiStore) {
    store.uiStore.clearJumpedFromHistory(); // 清除跳转消息状态
  }

  // 重置消息列表组件的加载状态
  emitter.emit(events.RESET_LOADING_MORE_MESSAGES);
};

// 获取群成员
const getTeamMember = async () => {
  if (
    conversationType.value === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM &&
    to.value
  ) {
    const team = store?.teamStore.teams.get(to.value);

    try {
      await store?.teamMemberStore.getTeamMemberActive({
        teamId: to.value,
        queryOption: {
          limit: Math.max(team?.memberLimit || 0, 200),
          roleQueryType: 0,
        },
      });
    } catch (error: any) {
      if (error?.code === 109404) {
        await modal.info({
          title: t("tipText"),
          content: "当前群聊已不存在",
        });
        if (store?.localOptions?.enableCloudConversation) {
          await store?.conversationStore?.deleteConversationActive(selectedConversation.value);
        } else {
          await store?.localConversationStore?.deleteConversationActive(selectedConversation.value);
        }
        store?.uiStore.unselectConversation();
      }
      throw error;
    }
  }
};
/** 处理回复消息 */
const handleReplyMsgs = (messages: V2NIMMessage[]) => {
  // 遍历所有消息，找出被回复消息，储存在map中
  if (messages.length !== 0) {
    const replyMsgsMapForExt: any = {};
    const replyMsgsMapForThreadReply: any = {};
    const extReqMsgs: YxReplyMsg[] = [];
    const threadReplyReqMsgs: V2NIMMessageRefer[] = [];
    const messageClientIds: Record<string, string> = {};
    msgs.value.forEach((msg) => {
      if (msg.serverExtension) {
        try {
          // yxReplyMsg 存储着被回复消息的相关消息
          const { yxReplyMsg } = JSON.parse(msg.serverExtension);
          if (yxReplyMsg) {
            // 从消息列表中找到被回复消息，replyMsg 为被回复的消息
            const beReplyMsg = msgs.value.find(
              (item) => item.messageClientId === yxReplyMsg.idClient
            );
            // 如果直接找到，存储在map中
            if (beReplyMsg) {
              replyMsgsMapForExt[msg.messageClientId as string] = beReplyMsg;
              // 如果没找到，说明被回复的消息可能有三种情况：1.被删除 2.被撤回 3.不在当前消息列表中（一次性没拉到，在之前的消息中）
            } else {
              replyMsgsMapForExt[msg.messageClientId as string] = {
                messageClientId: "noFind",
              };
              const { scene, from, to, idServer, messageClientId, time, receiverId } = yxReplyMsg;

              if (scene && from && to && idServer && messageClientId && time && receiverId) {
                extReqMsgs.push({
                  scene,
                  from,
                  to,
                  idServer,
                  messageClientId,
                  time,
                  receiverId,
                });
                messageClientIds[idServer as string] = msg.messageClientId as string;
              }
            }
          }
        } catch {}
      }

      if (msg.threadReply) {
        //找到被回复的消息
        const beReplyMsg = msgs.value.find(
          (item) => item.messageServerId === msg.threadReply?.messageServerId
        ) as V2NIMMessageForUI;

        if (beReplyMsg) {
          if (beReplyMsg.recallType == "beReCallMsg" || beReplyMsg.recallType == "reCallMsg") {
            replyMsgsMapForThreadReply[msg.messageClientId as string] = {
              messageClientId: "noFind",
            };
          } else {
            replyMsgsMapForThreadReply[msg.messageClientId as string] = beReplyMsg;
          }
        } else {
          replyMsgsMapForThreadReply[msg.messageClientId as string] = {
            messageClientId: "noFind",
          };
          messageClientIds[msg.threadReply.messageServerId as string] =
            msg.messageClientId as string;
          threadReplyReqMsgs.push(msg.threadReply);
        }
      }
    });

    if (extReqMsgs.length > 0) {
      // 从服务器拉取被回复消息, 但是有频率控制
      nim?.messageService
        ?.getMessageListByRefers(
          //@ts-ignore
          extReqMsgs.map((item) => ({
            senderId: item.from,
            receiverId: item.receiverId,
            messageClientId: item.messageClientId,
            messageServerId: item.idServer,
            createTime: item.time,
            conversationType: item.scene,
            conversationId: item.to,
          }))
        )
        .then((res) => {
          if (res?.length > 0) {
            res.forEach((item) => {
              if (item.messageServerId) {
                replyMsgsMapForExt[messageClientIds[item.messageServerId]] = item;
              }
            });
          }
          // 🔑 修复: 智能合并,保留已有的正确数据
          const mergedMap = { ...replyMsgsMap.value };
          Object.keys(replyMsgsMapForExt).forEach((key) => {
            const newValue = replyMsgsMapForExt[key];
            const oldValue = mergedMap[key];
            if (newValue?.messageClientId !== "noFind" || !oldValue) {
              mergedMap[key] = newValue;
            }
          });
          replyMsgsMap.value = mergedMap;
        })
        .catch(() => {
          // 🔑 修复: 即使失败也要智能合并
          const mergedMap = { ...replyMsgsMap.value };
          Object.keys(replyMsgsMapForExt).forEach((key) => {
            const newValue = replyMsgsMapForExt[key];
            const oldValue = mergedMap[key];
            if (newValue?.messageClientId !== "noFind" || !oldValue) {
              mergedMap[key] = newValue;
            }
          });
          replyMsgsMap.value = mergedMap;
        });
    }

    if (threadReplyReqMsgs.length > 0) {
      // 初次进入会话时 msgsWatch 可能触发多次，为避免重复调用 getMessageListByRefers 触发频控：
      // 这里按 messageServerId 去重，并用 fetchedReplyServerIds 记录本会话已请求过的 id
      const deduped = threadReplyReqMsgs.filter((ref) => {
        const id = ref?.messageServerId as string;
        if (!id) return false;
        // 相同的被回复消息（同一个 messageServerId）只请求一次
        if (fetchedReplyServerIds.has(id)) return false;
        fetchedReplyServerIds.add(id);
        return true;
      });
      if (!deduped.length) {
        // 本轮没有新增需要拉取的引用消息
        // 🔑 修复: 智能合并,不要用 noFind 覆盖已经成功获取的回复消息
        const mergedMap = { ...replyMsgsMap.value };

        // 只有当新数据不是 noFind 或者旧数据不存在时,才更新
        Object.keys(replyMsgsMapForExt).forEach((key) => {
          const newValue = replyMsgsMapForExt[key];
          const oldValue = mergedMap[key];
          // 如果新值有效(不是noFind),或者旧值不存在,则使用新值
          if (newValue?.messageClientId !== "noFind" || !oldValue) {
            mergedMap[key] = newValue;
          }
        });

        Object.keys(replyMsgsMapForThreadReply).forEach((key) => {
          const newValue = replyMsgsMapForThreadReply[key];
          const oldValue = mergedMap[key];
          // 如果新值有效(不是noFind),或者旧值不存在,则使用新值
          if (newValue?.messageClientId !== "noFind" || !oldValue) {
            mergedMap[key] = newValue;
          }
        });

        replyMsgsMap.value = mergedMap;
        return;
      }

      nim?.messageService
        ?.getMessageListByRefers(deduped)
        .then((res) => {
          if (res?.length > 0) {
            res.forEach((item) => {
              if (item.messageServerId) {
                replyMsgsMapForThreadReply[messageClientIds[item.messageServerId]] = item;
              }
            });
          }
          // 🔑 修复: 智能合并两个map,避免 noFind 覆盖已有数据
          const mergedMap = { ...replyMsgsMap.value };

          Object.keys(replyMsgsMapForExt).forEach((key) => {
            const newValue = replyMsgsMapForExt[key];
            const oldValue = mergedMap[key];
            if (newValue?.messageClientId !== "noFind" || !oldValue) {
              mergedMap[key] = newValue;
            }
          });

          Object.keys(replyMsgsMapForThreadReply).forEach((key) => {
            const newValue = replyMsgsMapForThreadReply[key];
            const oldValue = mergedMap[key];
            if (newValue?.messageClientId !== "noFind" || !oldValue) {
              mergedMap[key] = newValue;
            }
          });

          replyMsgsMap.value = mergedMap;
        })
        .catch(() => {
          // 🔑 修复: 失败时也要智能合并
          const mergedMap = { ...replyMsgsMap.value };

          Object.keys(replyMsgsMapForExt).forEach((key) => {
            const newValue = replyMsgsMapForExt[key];
            const oldValue = mergedMap[key];
            if (newValue?.messageClientId !== "noFind" || !oldValue) {
              mergedMap[key] = newValue;
            }
          });

          Object.keys(replyMsgsMapForThreadReply).forEach((key) => {
            const newValue = replyMsgsMapForThreadReply[key];
            const oldValue = mergedMap[key];
            if (newValue?.messageClientId !== "noFind" || !oldValue) {
              mergedMap[key] = newValue;
            }
          });

          replyMsgsMap.value = mergedMap;
        });
    } else {
      // 🔑 修复: 同样需要智能合并,避免 noFind 覆盖已有的正确数据
      const mergedMap = { ...replyMsgsMap.value };

      Object.keys(replyMsgsMapForExt).forEach((key) => {
        const newValue = replyMsgsMapForExt[key];
        const oldValue = mergedMap[key];
        if (newValue?.messageClientId !== "noFind" || !oldValue) {
          mergedMap[key] = newValue;
        }
      });

      Object.keys(replyMsgsMapForThreadReply).forEach((key) => {
        const newValue = replyMsgsMapForThreadReply[key];
        const oldValue = mergedMap[key];
        if (newValue?.messageClientId !== "noFind" || !oldValue) {
          mergedMap[key] = newValue;
        }
      });

      replyMsgsMap.value = mergedMap;
    }
  }
};

// 监听会话改变
const selectedConversationWatch = autorun(() => {
  const newConversationId = store?.uiStore?.selectedConversation || "";

  if (newConversationId !== selectedConversation.value) {
    selectedConversation.value = newConversationId;
    store?.uiStore.setMultiSelectMode(false);

    if (selectedConversation.value) {
      // 重置加载状态
      resetState(); // 在确认会话改变后再重置

      if (isFirstLoad.value) {
        // 初始化滚动到底部
        emitter.emit(events.ON_SCROLL_BOTTOM);
        // web im sdk 此处传Date.now() ,但electron im sdk 需要传 0，否则会出现获取不到最新一条消息的情况
        getHistory(0).then(async () => {
          await nextTick();
          isFirstLoad.value = false;
          emitter.emit(events.ON_SCROLL_BOTTOM);
        });
        getTeamMember();
      }
    } else {
      msgs.value = [];
    }
  }

  const to = nim?.conversationIdUtil?.parseConversationTargetId(selectedConversation.value);

  const conversationType = nim?.conversationIdUtil?.parseConversationType(
    selectedConversation.value
  );

  if (conversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM && to) {
    store?.teamStore.getTeamActive(to).then((res) => {
      teamAvatar.value = res.avatar as string;
    });
  } else {
    teamAvatar.value = "";
  }
  setChatHeaderAndPlaceholder();
});

/**监听store层的msg数组 动态更新消息 */
const msgsWatch = autorun(() => {
  const conversationId = store?.uiStore.selectedConversation;

  if (conversationId) {
    const messages = store?.msgStore.getMsg(conversationId) || [];

    msgs.value = messages || [];

    // 遍历所有消息，找出被回复消息，储存在map中
    handleReplyMsgs(messages);
  }
});

/**监听跳转状态，控制回到底部按钮的显示 */
const jumpStateWatch = autorun(() => {
  const isJumped = store?.uiStore.isJumpedFromHistory || false;

  if (isJumped) {
    // 如果是跳转状态，检查最新消息是否在可视区域
    showBackToBottomBtn.value = true;
  } else {
    // 如果不是跳转状态，隐藏按钮
    showBackToBottomBtn.value = false;
  }
});

// 侧边栏tab切换时，如果消息数量超过20条，则删除最旧的消息
const removeMsgs = () => {
  if (selectedConversation.value) {
    // 获取当前会话的所有消息
    const allMsgs = store?.msgStore.getMsg(selectedConversation.value) || [];

    // 如果消息数量大于20条，则删除最旧的消息，只保留最近20条
    if (allMsgs.length > 20) {
      // 按时间排序，确保获取到最旧的消息
      const sortedMsgs = [...allMsgs].sort((a, b) => (a.createTime || 0) - (b.createTime || 0));

      // 计算需要删除的消息数量
      const deleteCount = allMsgs.length - 20;

      // 获取需要删除的消息的 messageClientId
      const msgsToDelete = sortedMsgs.slice(0, deleteCount);
      const idClientsToDelete = msgsToDelete.map((msg) => msg.messageClientId);

      // 删除指定的消息，保留最近20条
      store?.msgStore.removeMsg(selectedConversation.value, idClientsToDelete as string[]);
    }
  }
};

// 当有漫游消息且是首次加载时，漫游和历史消息加起来超过15条，如果仅在拉取历史消息的逻辑中去发送已读回执，就会遗漏漫游消息的已读回执，所以在此处拿到完整的消息一并处理
watch(
  () => selectedConversation.value,
  () => {
    handleHistoryMsgReceipt(msgs.value);
    subscribeUserStatus(selectedConversation.value);
  }
);

// 监听消息加载状态重置事件的处理函数
const handleResetLoadingState = (event: MessageEvent) => {
  if (event.data && event.data.type === "RESET_MESSAGE_LOADING_STATE") {
    const { conversationId } = event.data;
    // 只重置当前选中会话的状态
    if (conversationId === selectedConversation.value) {
      console.log("重置消息加载状态:", conversationId);
      noMore.value = false;
      loadingMore.value = false;
    }
  }
};

onMounted(() => {
  setChatHeaderAndPlaceholder();

  /** 收到消息 */
  nim?.messageService?.on("receiveMessages", onReceiveMessages);
  /** 解散群组回调 */
  nim?.teamService?.on("teamDismissed", onTeamDismissed);
  /** 自己主动离开群组或被管理员踢出回调 */
  nim?.teamService?.on("teamLeft", onTeamLeft);

  // 加载历史消息
  //@ts-ignore
  emitter.on(events.GET_HISTORY_MSG, loadMoreMsgs);

  // 加载更多新消息（跳转状态下向下滚动）
  //@ts-ignore
  emitter.on(events.GET_NEXT_MSG, loadNextMsgs);

  // 监听关闭新消息提醒事件
  emitter.on(events.CLOSE_NEW_MSG_TIP, () => {
    showNewMsgTip.value = false;
  });

  // 监听滚动到底部事件，隐藏新消息提醒
  emitter.on(events.ON_SCROLL_BOTTOM, async () => {
    // 🔑 修复: 只有在非历史跳转状态下才隐藏新消息提醒
    // 在历史跳转状态下,用户向下滚动只是加载gap消息,不应该隐藏提醒
    // 只有当加载到最新消息(isJumpedFromHistory=false)或手动点击提醒时才隐藏
    const isInHistoryJumpState = store?.uiStore.isJumpedFromHistory || false;

    if (!isInHistoryJumpState) {
      // 只在非历史跳转状态下才隐藏新消息提醒
      showNewMsgTip.value = false;
    } else {
      console.log("当前处于历史跳转状态,保持新消息提醒显示");
    }

    // 在跳转状态下，只隐藏新消息提醒，不执行回到底部逻辑
    // 用户可以继续滚动加载更多消息
    if (!store?.uiStore.isJumpedFromHistory) {
      // 只在非跳转状态下才滚动到底部
      nextTick(() => {
        if (messageListRef.value) {
          messageListRef.value.scrollToBottom();
        }
      });
    }
  });

  // 监听重新加载最新消息事件（用于从跳转状态返回）
  emitter.on(events.RELOAD_LATEST_MESSAGES, async () => {
    console.log("收到重新加载最新消息事件");

    // 重新拉取最新的消息
    await getHistory(0);
  });

  //转发消息
  emitter.on(events.CONFIRM_FORWARD_MSG, (msg) => {
    isMergeForward.value = false;
    forwardMsg.value = msg as V2NIMMessage;
    showForwardModal.value = true;
  });

  //消息头像点击
  emitter.on(events.AVATAR_CLICK, (account) => {
    const myUserAccountId = nim?.loginService?.getLoginUser();
    if (account !== myUserAccountId) {
      userCardAccount.value = account as string;
      showUserCardModal.value = true;
    }
  });

  // 监听消息加载状态重置事件
  window.addEventListener("message", handleResetLoadingState);
});

onUnmounted(() => {
  nim?.teamService?.off("teamDismissed", onTeamDismissed);
  nim?.teamService?.off("teamLeft", onTeamLeft);
  nim?.messageService?.off("receiveMessages", onReceiveMessages);
  //@ts-ignore
  emitter.off(events.GET_HISTORY_MSG, loadMoreMsgs);
  //@ts-ignore
  emitter.off(events.GET_NEXT_MSG, loadNextMsgs);
  emitter.off(events.CLOSE_NEW_MSG_TIP);
  emitter.off(events.ON_SCROLL_BOTTOM);
  emitter.off(events.CONFIRM_FORWARD_MSG);
  emitter.off(events.AVATAR_CLICK);

  // 清理消息加载状态重置监听器
  window.removeEventListener("message", handleResetLoadingState);

  msgsWatch();
  chatHeaderWatch();
  selectedConversationWatch();
  jumpStateWatch();
  resetState();
  removeMsgs();
  multiSelectWatch();
});
</script>

<style scoped>
.chat-container {
  width: 100%;
  height: 100%;
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  position: relative;
}

.msg-alert {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: auto;
  z-index: 1;
}

.msg-wrapper {
  width: 100%;
  overflow: hidden;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  position: relative;
  flex: 1;
}

.msg-wrapper-h5 {
  width: 100%;
  height: 100%;
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  position: relative;
}

.msg-wrapper > message-list {
  height: 100%;
}

.welcome-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-container-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  background: #f6f8fa;
}

.chat-slide-bar {
  width: 60px;
  height: 100%;
  border-left: 1px solid #e4e9f2;
  padding: 13px 10px;
  box-sizing: border-box;
}

.setting-icon {
  width: 100%;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.slide-bar-icon {
  width: 100%;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}

.slide-bar-icon:hover {
  background-color: #f0f0f0;
}
</style>
