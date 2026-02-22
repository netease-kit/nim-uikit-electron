<template>
  <div class="search-result-item" @click="handleClick">
    <div class="message-info">
      <!-- 消息发送者头像 -->
      <Avatar
        :account="message.senderId || ''"
        :avatar="senderAvatar"
        :size="'32'"
        class="sender-avatar"
      />

      <div class="message-content">
        <!-- 消息发送者和时间 -->
        <div class="message-meta">
          <span class="sender-name">{{ senderNick }}</span>
          <span class="message-time">{{ formatTime(message.createTime || Date.now()) }}</span>
        </div>

        <!-- 消息文本内容，高亮关键字 -->
        <div class="message-text">
          <HighlightedMessageText :msg="message" :keyword="keyword" :fontSize="14" />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import type { V2NIMMessageForUI } from "../../store/types";
import { getContextState } from "../../utils/init";
import { formatDate } from "../../utils/date";
import Avatar from "../../CommonComponents/Avatar.vue";
import HighlightedMessageText from "./highlighted-message-text.vue";
import { V2NIMConst } from "../../utils/constants";
import type { V2NIMConversationType } from "node-nim";

interface Props {
  message: V2NIMMessageForUI;
  keyword: string;
  to: string;
  conversationType: V2NIMConversationType;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  click: [message: V2NIMMessageForUI];
}>();

const { store } = getContextState();

if (!store) {
  throw new Error("Store not initialized");
}

// 发送者信息
const senderNick = computed(() => {
  if (!props.message.senderId) return "";
  // 昵称展示顺序 群昵称 > 备注 > 个人昵称 > 帐号
  return store?.uiStore?.getAppellation({
    account: props.message.senderId as string,
    teamId:
      props.message.conversationType ===
      V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM
        ? props.to
        : "",
  });
});

const senderAvatar = computed(() => {
  if (!props.message.senderId) return "";
  const user = store.userStore.users.get(props.message.senderId);
  return user?.avatar || "";
});

// 时间格式化
const formatTime = (timestamp: number) => {
  return formatDate(timestamp);
};

// 点击处理
const handleClick = () => {
  emit("click", props.message);
};
</script>

<style scoped>
.search-result-item {
  height: 80px;
  padding: 10px 12px;
  cursor: pointer;
  border-bottom: 1px solid #f5f5f5;
  transition: background-color 0.2s;
  box-sizing: border-box;
  display: flex;
  align-items: flex-start;
}

.search-result-item:hover {
  background-color: #f8f8f8;
}

.search-result-item:last-child {
  border-bottom: none;
}

.message-info {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  height: 100%;
}

.sender-avatar {
  flex-shrink: 0;
  margin-top: 4px;
}

.message-content {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
  flex-shrink: 0;
}

.sender-name {
  font-size: 12px;
  font-weight: 500;
  color: #333;
}

.message-time {
  font-size: 11px;
  color: #999;
}

.message-text {
  flex: 1;
  font-size: 14px;
  color: #333;
  line-height: 1.3;
  word-wrap: break-word;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2; /* 限制最多显示2行 */
  -webkit-box-orient: vertical;
  text-overflow: ellipsis;
  max-height: calc(1.3em * 2); /* 2行的高度 */
}

/* 确保MessageText组件的高亮样式生效 - 优化为纯文本颜色高亮 */
.message-text :deep(.highlight) {
  color: #337ecc;
  font-weight: 600;
}
</style>
