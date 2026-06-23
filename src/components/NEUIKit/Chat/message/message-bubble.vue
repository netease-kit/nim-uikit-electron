<template>
  <MessageDropdown placement="bottom" trigger="contextmenu" :disabled="props.readonly">
    <div class="msg-bubble" :style="{ justifyContent: !msg.isSelf ? 'flex-start' : 'flex-end' }">
      <div
        v-if="!isFailed && (isNormal || isSending)"
        class="msg-bubble-content"
        :class="msg.isSelf ? 'msg-bubble-content-out' : 'msg-bubble-content-in'"
      >
        <div
          class="msg-bubble-main"
          :class="msg.isSelf ? 'msg-bubble-main-out' : 'msg-bubble-main-in'"
        >
          <div v-if="props.msg.isSelf" class="msg-status-wrapper">
            <MessageIsRead
              v-if="
                props.msg.sendingState ===
                  V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_SUCCEEDED &&
                props.msg.messageStatus?.errorCode !== 195002
              "
              :msg="msg"
            />
            <div v-else-if="isSending">
              <Icon
                :size="15"
                color="#337EFF"
                class="msg-status-icon icon-loading"
                type="icon-a-Frame8"
              ></Icon>
            </div>
          </div>
          <div
            class="msg-bubble-shell"
            :class="[
              msg.isSelf ? 'msg-bubble-shell-out' : 'msg-bubble-shell-in',
              {
                'msg-bubble-shell-active': isQuickCommentPickerVisible,
                'msg-bubble-shell-with-actions': canShowHoverActions,
              },
            ]"
          >
            <div
              v-if="bgVisible"
              class="msg-bg"
              :class="[
                msg.isSelf ? 'msg-bg-out' : 'msg-bg-in',
                {
                  'msg-bg-no-padding':
                    msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_IMAGE ||
                    msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_VIDEO ||
                    msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_FILE,
                },
              ]"
            >
              <slot></slot>
              <div
                v-if="canShowQuickCommentRow"
                class="msg-quick-comment-row"
                :class="msg.isSelf ? 'msg-quick-comment-row-out' : 'msg-quick-comment-row-in'"
                @click.stop
                @contextmenu.stop
              >
                <Popover
                  v-model="rowQuickCommentPickerVisible"
                  class="msg-quick-comment-add-popover"
                  trigger="click"
                  placement="top"
                  align="right"
                  :offset="12"
                >
                  <button
                    class="msg-quick-comment-add"
                    type="button"
                    :title="t('quickCommentText')"
                    :disabled="isQuickCommentBusy"
                  >
                    <img class="msg-quick-comment-add-icon" :src="QuickCommentIcon" />
                  </button>
                  <template #content>
                    <Face @emojiClick="handleQuickCommentEmojiClick" />
                  </template>
                </Popover>
                <button
                  v-for="summary in quickCommentSummaries"
                  :key="summary.index"
                  class="msg-quick-comment-chip"
                  :class="{ 'msg-quick-comment-chip-active': summary.addedBySelf }"
                  type="button"
                  :disabled="isQuickCommentIndexBusy(summary.index)"
                  @click="handleQuickCommentChipClick(summary)"
                >
                  <Icon :type="summary.iconType" :size="22"></Icon>
                  <span class="msg-quick-comment-count">{{ summary.count }}</span>
                </button>
              </div>
            </div>
            <slot v-else></slot>
            <div v-if="canShowHoverActions" class="msg-hover-actions" @click.stop @contextmenu.stop>
              <Popover
                v-model="hoverQuickCommentPickerVisible"
                trigger="click"
                placement="top"
                align="right"
                :offset="12"
              >
                <button
                  class="msg-hover-action-btn msg-hover-action-btn-quick"
                  type="button"
                  :title="t('quickCommentText')"
                  :disabled="isQuickCommentBusy"
                >
                  <Icon
                    iconClassName="msg-hover-action-icon msg-hover-action-icon-quick"
                    type="icon-biaoqing"
                    :size="18"
                  ></Icon>
                </button>
                <template #content>
                  <Face @emojiClick="handleQuickCommentEmojiClick" />
                </template>
              </Popover>
              <button
                v-for="item in hoverDirectActions"
                :key="item.key"
                class="msg-hover-action-btn"
                type="button"
                :title="item.name"
                @click.stop="handleHoverActionClick(item.key)"
              >
                <Icon
                  :iconClassName="getHoverActionIconClassName(item.key)"
                  :type="item.iconType"
                  :size="18"
                ></Icon>
              </button>
              <MessageDropdown
                v-if="hoverOverflowActions.length"
                placement="bottom"
                trigger="click"
                align="right"
                class="msg-hover-more-dropdown"
              >
                <button class="msg-hover-action-btn" type="button" :title="t('moreText')">
                  <Icon
                    iconClassName="msg-hover-action-icon msg-hover-action-icon-more"
                    type="icon-more"
                    :size="18"
                  ></Icon>
                </button>
                <template #overlay>
                  <div class="msg-dropdown-menu">
                    <div
                      class="msg-dropdown-item"
                      v-for="item in hoverOverflowActions"
                      :key="item.key"
                      @click="() => handleActionItemClick(item.key)"
                    >
                      <Icon :type="item.iconType" :size="13"></Icon>
                      <span class="action-name">{{ item.name }}</span>
                    </div>
                  </div>
                </template>
              </MessageDropdown>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="isFailed" class="msg-failed-wrapper">
        <div class="msg-failed">
          <Popover trigger="hover" placement="top" :align="'center'">
            <div class="msg-status-wrapper" @click="handleResendMsg">
              <div class="icon-fail">!</div>
            </div>
            <template #content>
              <div>{{ errorTipText }}</div>
            </template>
          </Popover>
          <!-- 显示消息内容 -->
          <div
            v-if="bgVisible"
            class="msg-bg"
            :class="[
              msg.isSelf ? 'msg-bg-out' : 'msg-bg-in',
              {
                'msg-bg-no-padding':
                  msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_IMAGE ||
                  msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_VIDEO,
              },
            ]"
          >
            <slot></slot>
          </div>
          <slot v-else></slot>
        </div>
      </div>
    </div>
    <template #overlay>
      <div class="msg-dropdown-menu">
        <div
          class="msg-dropdown-item"
          v-for="item in visibleMsgActions"
          :key="item.key"
          @click="() => handleActionItemClick(item.key)"
        >
          <Icon :type="item.iconType" :size="13"></Icon>
          <span class="action-name">{{ item.name }}</span>
        </div>
      </div>
    </template>
  </MessageDropdown>
</template>

<script lang="ts" setup>
/** 消息气泡 */
import { onMounted, onUnmounted, ref, computed, nextTick } from "vue";
import Icon from "../../CommonComponents/Icon.vue";
import { events } from "../../utils/constants";
import { isMessageNoError } from "../../utils/msg";
import { autorun } from "mobx";
import { handleJumpStateBeforeSend } from "../../utils/jump-state";
import type { V2NIMMessageForUI } from "../../store/types";
import { V2NIMConst } from "../../utils/constants";
import { msgRecallTime } from "../../utils/constants";
import { t } from "../../utils/i18n";
import { copyText } from "../../utils";
import emitter from "../../utils/eventBus";
import { showToast } from "../../utils/toast";
import MessageIsRead from "./message-read.vue";
import MessageDropdown from "./message-dropdown.vue";
import Face from "./face.vue";
import QuickCommentIcon from "../../static/quick-comment.png";
//@ts-ignore
import Popover from "../../CommonComponents/Popover.vue";
import { getContextState } from "../../utils/init";
import type { V2NIMMessageSendingState } from "node-nim";
import { V2NIMMessage } from "node-nim/types/v2_def/v2_nim_struct_def";
import type { EmojiPickItem, QuickCommentSummaryForUI } from "../../store/types";
const props = withDefaults(
  defineProps<{
    msg: V2NIMMessageForUI;
    tooltipVisible?: boolean;
    bgVisible?: boolean;
    placement?: string;
    readonly?: boolean;
    quickCommentSummaries?: QuickCommentSummaryForUI[];
  }>(),
  {}
);

const { store, nim } = getContextState();

const enableCloudConversation = store?.localOptions.enableCloudConversation;

const isSending = computed(() => {
  return (
    props.msg.sendingState ===
    V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_SENDING
  );
});

const isFailed = computed(() => {
  const errorCode = props.msg.messageStatus?.errorCode;
  return (
    props.msg.sendingState ===
      V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_FAILED ||
    (errorCode !== undefined && !isMessageNoError(errorCode))
  );
});

const isNormal = computed(() => {
  return (
    !isFailed.value &&
    (isMessageNoError(props.msg.messageStatus?.errorCode) ||
      props.msg.sendingState ===
        V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_UNKNOWN ||
      props.msg.sendingState ===
        V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_SUCCEEDED)
  );
});

const isSensitiveError = computed(() => {
  const statusCode = props.msg.messageStatus?.errorCode;
  const directCode = (props.msg as any).errorCode;
  return statusCode === 195002 || directCode === 195002;
});

const errorTipText = computed(() => {
  // 消息发送失败时，在感叹号，hover上提示失败原因
  if (props.msg.messageStatus?.errorCode === 102426) {
    return t("sendFailWithInBlackText");
  } else if (props.msg.messageStatus?.errorCode === 104404) {
    return t("sendFailWithDeleteText");
  } else if (props.msg.messageStatus?.errorCode === 108306) {
    return t("teamBannedText");
  } else if (props.msg.messageStatus?.errorCode === 195002) {
    return t("sensitiveText");
  } else {
    return t("msgNetworkErrorText");
  }
});

const isFriend = ref(true);

// 未知消息
const isUnknownMsg = ref(false);
const hoverQuickCommentPickerVisible = ref(false);
const rowQuickCommentPickerVisible = ref(false);

const msgActions = computed(() => {
  return [
    {
      name: t("deleteText"),
      class: "action-delete",
      key: "action-delete",
      show: true,
      iconType: "icon-delete",
    },
    {
      name: t("recallText"),
      class: "action-recall",
      key: "action-recall",
      show:
        !isSensitiveError.value &&
        props.msg.messageType !== V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CALL &&
        props.msg.isSelf &&
        ![
          V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_SENDING,
          V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_FAILED,
        ].includes(props.msg.sendingState as V2NIMMessageSendingState),

      iconType: "icon-recall",
    },
    {
      name: t("copyText"),
      class: "action-copy",
      key: "action-copy",
      show:
        !isSensitiveError.value &&
        props.msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT &&
        isNormal.value &&
        ![
          V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_SENDING,
          V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_FAILED,
        ].includes(props.msg.sendingState as V2NIMMessageSendingState),
      iconType: "icon-fuzhi1",
    },
    {
      name: t("replyText"),
      class: "action-reply",
      key: "action-reply",
      iconType: "icon-reply",
      show:
        !isSensitiveError.value &&
        props.msg.messageType !== V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CALL &&
        ![
          V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_SENDING,
          V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_FAILED,
        ].includes(props.msg.sendingState as V2NIMMessageSendingState),
    },
    {
      name: t("forwardText"),
      class: "action-forward",
      key: "action-forward",
      iconType: "icon-forward",
      show:
        !isSensitiveError.value &&
        props.msg.messageType !== V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CALL &&
        props.msg.messageType !== V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_AUDIO &&
        ![
          V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_SENDING,
          V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_FAILED,
        ].includes(props.msg.sendingState as V2NIMMessageSendingState),
    },
    {
      name: t("collectionText"),
      class: "action-collect",
      key: "action-collect",
      show:
        !isSensitiveError.value &&
        props.msg.messageType !== V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CALL &&
        props.msg.sendingState !==
          V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_SENDING &&
        props.msg &&
        isNormal.value,
      iconType: "icon-collection",
    },
    {
      name: t("multiSelectText"),
      class: "action-multi-select",
      key: "action-multi-select",
      show: true,
      iconType: "icon-duoxuan",
    },
  ];
});

const visibleMsgActions = computed(() => msgActions.value.filter((item) => item.show));

const hoverDirectActionKeys = ["action-reply", "action-forward"];

const hoverDirectActions = computed(() =>
  visibleMsgActions.value.filter((item) => hoverDirectActionKeys.includes(item.key))
);

const hoverOverflowActions = computed(() =>
  visibleMsgActions.value.filter((item) => !hoverDirectActionKeys.includes(item.key))
);

const getHoverActionIconClassName = (key: string) => {
  return `msg-hover-action-icon msg-hover-action-icon-${key.replace("action-", "")}`;
};

const canShowHoverActions = computed(() => {
  return (
    !props.readonly &&
    !isFailed.value &&
    !isSending.value &&
    isNormal.value &&
    !isUnknownMsg.value &&
    props.msg.messageType !== V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_NOTIFICATION &&
    props.msg.messageType !== V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CALL
  );
});

const quickCommentSummaries = computed(() => {
  return props.quickCommentSummaries || props.msg.quickCommentSummaries || [];
});

const canShowQuickCommentRow = computed(() => {
  return canShowHoverActions.value && quickCommentSummaries.value.length > 0;
});

const isQuickCommentPickerVisible = computed(() => {
  return hoverQuickCommentPickerVisible.value || rowQuickCommentPickerVisible.value;
});

const isQuickCommentBusy = computed(() => {
  return store?.msgStore.isQuickCommentOperating(props.msg.messageClientId) || false;
});

const handleActionItemClick = (key: string) => {
  switch (key) {
    case "action-delete":
      handleDeleteMsg();
      break;
    case "action-recall":
      handleRecallMsg();
      break;
    case "action-reply":
      handleReplyMsg();
      break;
    case "action-copy":
      handleCopyMsg();
      break;
    case "action-forward":
      handleForwardMsg();
      break;
    case "action-collect":
      handleCollectMsg();
      break;
    case "action-multi-select":
      handleMultiSelectMsg();
      break;
    default:
      break;
  }
};

const handleHoverActionClick = (key: string) => {
  handleActionItemClick(key);
};

const closeQuickCommentPickers = () => {
  hoverQuickCommentPickerVisible.value = false;
  rowQuickCommentPickerVisible.value = false;
};

const isQuickCommentIndexBusy = (index: number) => {
  return store?.msgStore.isQuickCommentOperating(props.msg.messageClientId, index) || false;
};

const handleQuickCommentEmojiClick = async (emoji: EmojiPickItem) => {
  closeQuickCommentPickers();
  await handleQuickCommentIndex(emoji.index);
};

const handleQuickCommentChipClick = async (summary: QuickCommentSummaryForUI) => {
  await handleQuickCommentIndex(summary.index);
};

const handleQuickCommentIndex = async (index: number) => {
  if (isQuickCommentIndexBusy(index)) {
    return;
  }

  try {
    await store?.msgStore.toggleQuickComment(props.msg, index);
  } catch (error) {
    showToast({
      message: t("quickCommentFailedText"),
      type: "error",
    });
  }
};

const handleCopyMsg = () => {
  try {
    copyText(props.msg.text || "");
    showToast({
      message: t("copySuccessText"),
      type: "success",
    });
  } catch {
    showToast({
      message: t("copyFailedText"),
      type: "error",
    });
  }
};

const handleMultiSelectMsg = () => {
  store?.uiStore.setMultiSelectMode(true);
  if (props.msg.messageClientId) {
    store?.uiStore.selectMessage(props.msg.messageClientId);
    // 进入多选模式后，将当前消息滚动到视野内，避免被底部操作栏遮挡
    nextTick(() => {
      emitter.emit(events.SCROLL_MSG_INTO_VIEW, props.msg.messageClientId);
    });
  }
};

const handleForwardMsg = () => {
  emitter.emit(events.CONFIRM_FORWARD_MSG, props.msg);
};

const scrollBottom = async () => {
  const timer = setTimeout(() => {
    emitter.emit(events.ON_SCROLL_BOTTOM);
    clearTimeout(timer);
  }, 300);
};

// 收藏消息
const handleCollectMsg = async () => {
  try {
    const conversationId = store?.uiStore.selectedConversation as string;

    const conversation = enableCloudConversation
      ? store?.conversationStore?.conversations.get(conversationId)
      : store?.localConversationStore?.conversations.get(conversationId);

    const conversationType = nim?.conversationIdUtil?.parseConversationType(
      props.msg.conversationId as string
    );
    const isTeamMessage =
      conversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM; // V2NIM_CONVERSATION_TYPE_TEAM

    // 获取teamId（如果是群聊）
    const teamId = isTeamMessage
      ? nim?.conversationIdUtil?.parseConversationTargetId(props.msg.conversationId as string)
      : undefined;

    await nim?.messageService?.addCollection({
      collectionType: (props.msg?.messageType || 0) + 1000,
      collectionData: JSON.stringify({
        message: nim?.messageConverter?.messageSerialization(props.msg),
        conversationName: conversation?.name,
        senderName: store?.uiStore.getAppellation({
          account: props.msg.senderId as string,
          teamId: teamId,
        }),
        avatar: store?.userStore.users.get(props.msg.senderId as string)?.avatar,
      }),
      uniqueId: props.msg.messageServerId,
    });
    showToast({
      message: t("addCollectionSuccessText"),
      type: "success",
    });
  } catch {
    showToast({
      message: t("addCollectionFailedText"),
      type: "error",
    });
  }
};

// 重发消息
const handleResendMsg = async () => {
  const _msg = props.msg as V2NIMMessageForUI;
  const conversationId = _msg.conversationId as string;
  const isTopicFirstMessage =
    !!conversationId &&
    !!_msg.messageClientId &&
    !!store?.isAIBotTopicConversation(conversationId) &&
    store.topicStore.isTopicFirstMessage(conversationId, _msg.messageClientId);
  const isTopicMessage =
    !!conversationId &&
    !!_msg.topicRefer?.topicId &&
    !!store?.isAIBotTopicConversation(conversationId);

  if (!isTopicFirstMessage && !isTopicMessage) {
    store?.msgStore?.removeMsg(_msg.conversationId, [_msg.messageClientId as string]);
  }

  // 处理跳转状态下的重发消息：先清空当前消息，加载最新消息
  await handleJumpStateBeforeSend(_msg.conversationId, "重发消息");

  try {
    if (isTopicFirstMessage) {
      await store?.topicStore.retryFirstTopicMessage(
        conversationId,
        _msg.messageClientId as string,
        {
          progress: () => true,
        }
      );
      scrollBottom();
      return;
    }

    if (isTopicMessage) {
      await store?.topicStore.retryTopicMessage(conversationId, _msg, {
        progress: () => true,
      });
      scrollBottom();
      return;
    }

    if (_msg.threadReply) {
      const beReplyMsg = await nim?.messageService?.getMessageListByRefers([_msg.threadReply]);
      if ((beReplyMsg?.length || 0) > 0) {
        store?.msgStore.replyMsgActive(beReplyMsg?.[0] as V2NIMMessage);
      }
    }
    switch (_msg.messageType) {
      case V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_IMAGE:
      case V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_VIDEO:
        store?.msgStore
          .sendMessageActive({
            msg: _msg,
            conversationId: _msg.conversationId as string,
            progress: () => true,
            sendBefore: () => {
              scrollBottom();
            },
          })
          .then(() => {
            scrollBottom();
          });
        break;
      case V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT:
        store?.msgStore.sendMessageActive({
          msg: _msg,
          conversationId: _msg.conversationId as string,
          sendBefore: () => {
            scrollBottom();
          },
        });
        break;
      default:
        store?.msgStore.sendMessageActive({
          msg: _msg,
          conversationId: _msg.conversationId as string,
          sendBefore: () => {
            scrollBottom();
          },
        });
        break;
    }
    scrollBottom();
  } catch (error) {
    console.log(error);
  }
};

// 回复消息
const handleReplyMsg = async () => {
  const _msg = props.msg;
  store?.msgStore?.replyMsgActive(_msg);
  emitter.emit(events.REPLY_MSG, props.msg);
  // 在群里回复其他人的消息，也是@被回复人
  if (
    props.msg.conversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM &&
    !props.msg.isSelf
  ) {
    emitter.emit(events.AIT_TEAM_MEMBER, {
      accountId: props.msg.senderId,
      appellation: store?.uiStore.getAppellation({
        account: props.msg.senderId as string,
        teamId: props.msg.receiverId,
        ignoreAlias: true,
      }),
    });
  }
};

// 撤回消息
const handleRecallMsg = () => {
  const diff = Date.now() - (props.msg?.createTime || 0);
  if (diff > msgRecallTime) {
    showToast({
      message: t("msgRecallTimeErrorText"),
      type: "info",
    });
    return;
  }

  store?.msgStore
    ?.reCallMsgActive(props.msg)
    .then(() => {
      if (props.msg.conversationId && props.msg.topicRefer?.topicId) {
        store?.topicStore.recallTopicMessage(
          props.msg.conversationId,
          props.msg as V2NIMMessageForUI
        );
      }
    })
    .catch(() => {
      showToast({
        message: t("recallMsgFailText"),
        type: "info",
      });
    });
};

// 删除消息
const handleDeleteMsg = () => {
  store?.msgStore?.deleteMsgActive([props.msg]);
  store?.msgStore?.removeMsg(props.msg.conversationId, [props.msg?.messageClientId as string]);
  if (props.msg.conversationId && props.msg.topicRefer?.topicId) {
    store?.topicStore.removeTopicMessages(props.msg.conversationId, [props.msg]);
  }
};

const uninstallFriendsWatch = autorun(() => {
  const _isFriend = store?.uiStore.friends
    .filter((item) => !store.relationStore.blacklist.includes(item.accountId as string))
    .map((item) => item.accountId)
    .some((item: any) => item.account === props.msg.receiverId);
  isFriend.value = _isFriend as boolean;
});

onMounted(() => {
  // 当前版本仅支持文本、图片、文件、语音、视频 话单消息，其他消息类型统一为未知消息
  isUnknownMsg.value = !(
    props.msg.messageType == V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT ||
    props.msg.messageType == V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_IMAGE ||
    props.msg.messageType == V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_FILE ||
    props.msg.messageType == V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_AUDIO ||
    props.msg.messageType == V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_VIDEO ||
    props.msg.messageType == V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CALL
  );
});

//卸载监听
onUnmounted(() => {
  uninstallFriendsWatch();
});
</script>

<style scoped>
.msg-bubble {
  display: flex;
  position: relative;
}

.msg-bubble-content {
  display: flex;
  flex-direction: column;
  max-width: 100%;
}

.msg-bubble-content-in {
  align-items: flex-start;
}

.msg-bubble-content-out {
  align-items: flex-end;
}

.msg-bubble-main {
  display: flex;
  max-width: 100%;
}

.msg-bubble-main-in {
  flex-direction: row;
  justify-content: flex-start;
}

.msg-bubble-main-out {
  flex-direction: row;
  justify-content: flex-end;
}

.msg-bubble-shell {
  position: relative;
  width: fit-content;
  max-width: 100%;
}

.msg-bubble-shell-with-actions {
  padding-top: 38px;
  margin-top: -38px;
}

.msg-bubble-shell-with-actions::before {
  content: "";
  position: absolute;
  top: 0;
  width: max(100%, 148px);
  height: 38px;
  z-index: 7;
}

.msg-bubble-shell-in.msg-bubble-shell-with-actions::before {
  right: 0;
}

.msg-bubble-shell-out.msg-bubble-shell-with-actions::before {
  left: 0;
}

.msg-bubble-shell:hover .msg-hover-actions,
.msg-bubble-shell-active .msg-hover-actions {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.msg-hover-actions {
  box-sizing: border-box;
  position: absolute;
  top: 2px;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 36px;
  padding: 5px;
  background: #fff;
  border: 1px solid rgba(25, 31, 37, 0.08);
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(25, 31, 37, 0.08);
  opacity: 0;
  pointer-events: none;
  transform: translateY(3px);
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
  z-index: 20;
}

.msg-bubble-shell-in .msg-hover-actions {
  right: 0;
}

.msg-bubble-shell-out .msg-hover-actions {
  left: 0;
}

.msg-hover-action-btn {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 6px;
  padding: 0;
  background: transparent;
  cursor: pointer;
}

.msg-hover-action-btn:hover:not(:disabled) {
  background: #f2f3f5;
}

.msg-hover-action-btn-quick {
  transform: translateY(1px);
}

.msg-hover-action-btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.msg-hover-action-btn :deep(.icon-wrapper) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
}

.msg-hover-action-btn :deep(.icon) {
  display: block;
  filter: brightness(0);
  opacity: 0.56;
}

.msg-hover-action-btn:hover:not(:disabled) :deep(.icon) {
  opacity: 0.74;
}

.msg-hover-action-btn :deep(.msg-hover-action-icon-quick .icon) {
  transform: translateY(0.5px);
}

.msg-hover-action-btn :deep(.msg-hover-action-icon-reply .icon) {
  width: 15px !important;
  height: 15px !important;
}

.msg-hover-action-btn :deep(.msg-hover-action-icon-forward .icon) {
  width: 15px !important;
  height: 15px !important;
  transform: translateY(-0.5px);
}

.msg-hover-action-btn :deep(.msg-hover-action-icon-more .icon) {
  width: 18px !important;
  height: 18px !important;
}

.msg-hover-more-dropdown {
  display: inline-flex;
  width: auto;
}

.msg-quick-comment-row {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  margin-top: 10px;
  flex-wrap: wrap;
}

.msg-quick-comment-row-in {
  justify-content: flex-start;
}

.msg-quick-comment-row-out {
  justify-content: flex-start;
}

.msg-quick-comment-add,
.msg-quick-comment-chip {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  min-width: 28px;
  border: 1px solid rgba(25, 31, 37, 0.08);
  border-radius: 14px;
  background: #fff;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(25, 31, 37, 0.04);
}

.msg-quick-comment-add {
  width: 28px;
  min-width: 28px;
  height: 28px;
  padding: 0;
}

.msg-quick-comment-add-popover {
  display: inline-flex;
  align-items: center;
  height: 28px;
}

.msg-quick-comment-add-popover :deep(.popover-trigger) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 28px;
}

.msg-quick-comment-add-icon {
  width: 23px;
  height: 23px;
  display: block;
}

.msg-quick-comment-chip {
  gap: 4px;
  padding: 0 9px 0 7px;
  color: #4e5969;
}

.msg-quick-comment-row-out .msg-quick-comment-chip:not(.msg-quick-comment-chip-active) {
  border-color: rgba(51, 126, 255, 0.18);
  background: #eef5ff;
  box-shadow: 0 1px 2px rgba(51, 126, 255, 0.04);
}

.msg-quick-comment-add:hover:not(:disabled),
.msg-quick-comment-chip:hover:not(:disabled),
.msg-quick-comment-chip-active,
.msg-quick-comment-row-out .msg-quick-comment-chip-active {
  border-color: rgba(51, 126, 255, 0.28);
  background: rgba(51, 126, 255, 0.08);
}

.msg-quick-comment-add:disabled,
.msg-quick-comment-chip:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.msg-quick-comment-count {
  font-size: 13px;
  line-height: 1;
  color: #666;
}

.msg-bg {
  max-width: 600px;
  width: fit-content;
  overflow: hidden;
  padding: 12px 16px;
}

.msg-bg-no-padding {
  padding: 0;
}

.msg-bg-no-padding .msg-quick-comment-row {
  padding: 0 8px 8px;
}

.msg-bg-in {
  border-radius: 0 8px 8px 8px;
  background-color: #e8eaed;
  margin-left: 8px;
}

.msg-bg-out {
  border-radius: 8px 0 8px 8px;
  background-color: #d6e5f6;
  margin-right: 8px;
}

.msg-action-groups {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  max-width: 224px;
  width: max-content;
}

.msg-action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 10px;
  width: 56px;
}

.msg-action-btn-icon {
  color: #656a72;
  font-size: 18px;
}

.msg-action-btn-text {
  color: #000;
  font-size: 14px;
  word-break: keep-all;
}

.msg-failed-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  width: 100%;
}

.msg-failed-wrapper .in-blacklist {
  color: #b3b7bc;
  font-size: 14px;
  position: relative;
  right: 20%;
  margin: 10px 0;
}

.msg-failed-wrapper .friend-delete {
  color: #b3b7bc;
  font-size: 14px;
  margin: 10px 0;
}

.msg-failed-wrapper .friend-delete .friend-verification {
  color: #337eff;
  font-size: 14px;
}

.msg-status-wrapper {
  box-sizing: border-box;
  display: flex;
  align-items: flex-end;
}

.msg-status-wrapper .msg-bg-out {
  margin-right: 0;
  flex: 1;
}

.msg-status-icon {
  margin-right: 8px;
  font-size: 21px;
  color: #337eff;
}

@keyframes loadingCircle {
  100% {
    transform: rotate(360deg);
  }
}

.icon-loading {
  color: #337eff;
  margin-right: 8px;
  animation: loadingCircle 1s infinite linear;
}

.icon-fail {
  background: #fc596a;
  color: white;
  border-radius: 50%;
  width: 15px;
  height: 15px;
  text-align: center;
  line-height: 15px;
  font-size: 12px;
  flex-shrink: 0;
  cursor: pointer;
}

.msg-failed {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  gap: 8px;
}

.msg-dropdown-item {
  padding: 5px 12px;
  height: 32px;
  box-sizing: border-box;
  font-size: 14px;
  cursor: pointer;
  color: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  white-space: nowrap;
}

.msg-dropdown-item:hover {
  background-color: #f5f5f5;
}

.action-name {
  margin-left: 5px;
  font-size: 14px;
}
</style>
