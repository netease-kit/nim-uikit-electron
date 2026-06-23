<template>
  <div
    v-if="
      props.msg.messageType ===
      V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT
    "
  >
    <ReplyMessage
      :visible="shouldShowReply"
      :replyMsg="replyMsg"
    />
    <!-- 文本消息 -->
    <MessageAIMarkdown
      v-if="shouldRenderMarkdown"
      :msg="props.msg"
    />
    <MessageText
      v-else
      :msg="props.msg"
    />
  </div>
  <!-- 图片消息 -->
  <div
    v-else-if="
      props.msg.messageType ===
      V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_IMAGE
    "
  >
    <div v-if="shouldShowReply" class="media-reply-wrapper">
      <ReplyMessage
        :visible="true"
        :replyMsg="replyMsg"
      />
    </div>
    <div :class="{ 'media-content-wrapper': shouldShowReply }">
      <MessageImage
        :msg="props.msg"
      />
    </div>
  </div>
  <!-- 视频消息 -->
  <div
    v-else-if="
      props.msg.messageType ===
      V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_VIDEO
    "
  >
    <div v-if="shouldShowReply" class="media-reply-wrapper">
      <ReplyMessage
        :visible="true"
        :replyMsg="replyMsg"
      />
    </div>
    <div :class="{ 'media-content-wrapper': shouldShowReply }">
      <MessageVideo
        :msg="msg"
      />
    </div>
  </div>
  <!-- 音视频消息 -->
  <div
    v-else-if="
      props.msg.messageType ===
      V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CALL
    "
  >
    <ReplyMessage
      :visible="shouldShowReply"
      :replyMsg="replyMsg"
    />
    <MessageG2
      :msg="props.msg"
      :readonly="props.readonly"
    />
  </div>
  <!-- 文件消息 -->
  <div
    v-else-if="
      props.msg.messageType ===
      V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_FILE
    "
  >
    <div v-if="shouldShowReply" class="media-reply-wrapper">
      <ReplyMessage
        :visible="true"
        :replyMsg="replyMsg"
      />
    </div>
    <div :class="{ 'media-content-wrapper': shouldShowReply }">
      <MessageFile
        :msg="props.msg"
        :embedded="shouldShowReply"
      />
    </div>
  </div>
  <!-- 语音消息 -->
  <div
    v-else-if="
      props.msg.messageType ===
      V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_AUDIO
    "
  >
    <ReplyMessage
      :visible="shouldShowReply"
      :replyMsg="replyMsg"
    />
    <MessageAudio
      :msg="props.msg"
      :readonly="props.readonly"
    />
  </div>
  <!-- 合并转发消息 -->
  <div
    v-else-if="
      props.msg.messageType ===
      V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM &&
      store?.msgStore?.isChatMergedForwardMsg(props.msg)
    "
  >
    <ReplyMessage
      :visible="shouldShowReply"
      :replyMsg="replyMsg"
    />
    <MessageMergeForward
      :msg="props.msg"
    />
  </div>
  <!-- 未知消息 -->
  <div v-else>
    <ReplyMessage
      :visible="shouldShowReply"
      :replyMsg="replyMsg"
    />
    <div class="unknown-msg">[{{ t("unknownMsgText") }}]</div>
  </div>
</template>

<script lang="ts" setup>
/** 消息内容 */
import ReplyMessage from "./message-reply.vue";
import MessageFile from "./message-file.vue";
import MessageText from "./message-text.vue";
import MessageAIMarkdown from "./message-ai-markdown.vue";
import MessageAudio from "./message-audio.vue";
import MessageG2 from "./message-g2.vue";
import MessageImage from "./message-image.vue";
import MessageMergeForward from "../forward/message-merge-forward.vue";
import { V2NIMConst } from "../../utils/constants";
import MessageVideo from "./message-video.vue";
import { t } from "../../utils/i18n";
import type { V2NIMMessageForUI } from "../../store/types";
import { getContextState } from "../../utils/init";
import { computed } from "vue";
import type { V2NIMMessageRefer } from "node-nim/types/v2_def/v2_nim_struct_def";
import { shouldRenderMessageMarkdown } from "../../utils/msg";

const { store, nim } = getContextState();

const props = withDefaults(
  defineProps<{
    msg: V2NIMMessageForUI & { timeValue?: number };
    replyMsg?: V2NIMMessageForUI;
    showReply?: boolean;
    readonly?: boolean;
  }>(),
  {
    showReply: true,
    readonly: false,
  }
);

const isSameMessageRefer = (
  left?: V2NIMMessageRefer,
  right?: V2NIMMessageRefer
): boolean => {
  if (!left || !right) {
    return false;
  }

  return (
    (!!left.messageServerId && left.messageServerId === right.messageServerId) ||
    (!!left.messageClientId && left.messageClientId === right.messageClientId)
  );
};

const isTopicReplyToRoot = computed(() => {
  return !!props.msg.topicRefer && isSameMessageRefer(props.msg.threadRoot, props.msg.threadReply);
});

const shouldShowReply = computed(() => {
  return props.showReply && !!props.msg.threadReply && !isTopicReplyToRoot.value;
});

const conversationTargetId = computed(() => {
  if (!props.msg.conversationId) {
    return "";
  }

  return nim?.conversationIdUtil?.parseConversationTargetId(props.msg.conversationId) || "";
});

const shouldRenderMarkdown = computed(() => {
  const targetId = conversationTargetId.value;

  return shouldRenderMessageMarkdown(props.msg, {
    currentAccountId: store?.userStore.myUserInfo.accountId,
    conversationTargetId: targetId,
    isAIBotTopicConversation: store?.isAIBotTopicConversation(props.msg.conversationId || ""),
    isAIBot: (accountId) =>
      !!store?.aiUserStore.isAIBot(accountId) ||
      store?.uiStore.getRelation(accountId).relation === "aiBot",
  });
});
</script>

<style scoped>
.media-reply-wrapper {
  box-sizing: border-box;
  padding: 12px 16px 0;
}

.media-reply-wrapper :deep(.reply-msg-wrapper) {
  margin-bottom: 0;
}

.media-content-wrapper {
  box-sizing: border-box;
  padding: 12px 16px;
}

.unknown-msg {
  font-size: 14px;
  color: #000000;
}
</style>
