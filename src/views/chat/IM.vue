<template>
  <div class="container-wrapper">
    <!-- 关闭确认对话框 -->
    <CloseConfirmationModal
      :visible="showCloseConfirmation"
      @close-action-selected="handleCloseActionSelected"
    />
    
    <div class="container">
      <!-- IMUIKIT 相关内容 -->
      <div class="header drag-region">
        <div class="search no-drag">
          <Search @goChat="() => (model = 'chat')" />
        </div>
      </div>
      <div class="content" :class="{ 'no-select': isResizing }">
        <div class="left drag-region">
          <UserAvatar class="no-drag" />
          <div
            class="no-drag"
            :class="{
              'chat-icon': true,
              active: model === 'chat',
            }"
            @click="() => (model = 'chat')"
          >
            <i
              :class="{
                iconfont: true,
                'icon-im': true,
              }"
            />
            <!-- 小红点显示 -->
            <div v-if="totalUnreadCount > 0" class="red-dot"></div>
            <div class="icon-label">{{ t("session") }}</div>
          </div>
          <div
            class="no-drag"
            :class="{
              'contact-icon': true,
              active: model === 'collection',
            }"
            @click="() => (model = 'collection')"
          >
            <i
              :class="{
                iconfont: true,
                'icon-daohang-shoucang': true,
              }"
            />
            <div class="icon-label">{{ t("collectionText") }}</div>
          </div>
          <div
            class="no-drag"
            :class="{
              'contact-icon': true,
              active: model === 'contact',
            }"
            @click="() => (model = 'contact')"
          >
            <i
              :class="{
                iconfont: true,
                'icon-tongxunlu-weixuanzhong': true,
              }"
            />
            <!-- 通讯录未读数小红点显示 -->
            <div v-if="totalSysMsgUnreadCount > 0" class="red-dot"></div>
            <div class="icon-label">{{ t("addressText") }}</div>
          </div>
          <SettingsMenu>
            <div class="setting-menu-icon no-drag">
              <i
                :class="{
                  iconfont: true,
                  'icon-zhankai': true,
                }"
              />
            </div>
          </SettingsMenu>
        </div>
        <div class="right">
          <!-- 网络连接提示 && 安全提示横幅 -->
          <Tip />
          <div v-if="model === 'chat'">
            <div
              class="right-list"
              ref="conversation"
              :style="{ width: conversationWidth + 'px' }"
            >
              <ConversationList />
            </div>
            <div
              class="splitter no-drag"
              @mousedown="onSplitterMouseDown"
              :class="{ active: isResizing }"
            ></div>
            <div class="right-content">
              <MessageList />
            </div>
          </div>
          <div class="collection-container" v-if="model === 'collection'">
            <CollectionList />
          </div>
          <div v-if="model === 'contact'">
            <Concat
              @afterSendMsgClick="() => (model = 'chat')"
              @onGroupItemClick="() => (model = 'chat')"
              @onBlackItemClick="() => (model = 'chat')"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ConversationList from "../../components/NEUIKit/Conversation/conversation-list.vue";
import MessageList from "../../components/NEUIKit/Chat/index.vue";
import Search from "../../components/NEUIKit/Search/index.vue";
import Concat from "../../components/NEUIKit/Contact/index.vue";
import UserAvatar from "../../components/NEUIKit/User/index.vue";
import CollectionList from "../../components/NEUIKit/Chat/collection/index.vue";
import CloseConfirmationModal from "./components/close-confirmation-modal.vue";
import { t } from "../../components/NEUIKit/utils/i18n";
import "./iconfont.css";
import { ref, onMounted, onUnmounted } from "vue";
import { autorun } from "mobx";
import SettingsMenu from "./components/setting.vue";
import Tip from "./components/tip.vue";

import { getContextState } from "../../components/NEUIKit/utils/init";
import { onNotificationClick } from "../../components/NEUIKit/utils/electron";

const { store } = getContextState();

// 响应式数据
const model = ref("chat");
const totalUnreadCount = ref(0);
const totalSysMsgUnreadCount = ref(0);

// 窗口关闭确认对话框
const showCloseConfirmation = ref(false);

// 处理关闭行为选择
const handleCloseActionSelected = (action: 'minimize' | 'quit' | 'cancel', remember: boolean) => {
  showCloseConfirmation.value = false;
  
  if (window.electronAPI) {
    window.electronAPI.windowClose.sendCloseActionSelected(action, remember);
  }
};

// 会话列表宽度，支持拖拽--------------
const conversationWidth = ref(250);
let startX = 0;
let startWidth = 0;
const isResizing = ref(false);

const onMouseMove = (e: MouseEvent) => {
  const minWidth = 240;
  const maxWidth = 400;
  const delta = e.clientX - startX;
  let next = startWidth + delta;
  if (next < minWidth) next = minWidth;
  if (next > maxWidth) next = maxWidth;
  conversationWidth.value = next;
};

const onMouseUp = () => {
  document.removeEventListener("mousemove", onMouseMove);
  document.removeEventListener("mouseup", onMouseUp);
  isResizing.value = false;
  document.body.classList.remove("no-select");
};
const onSplitterMouseDown = (e: MouseEvent) => {
  e.preventDefault();
  startX = e.clientX;
  startWidth = conversationWidth.value;
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
  isResizing.value = true;
  document.body.classList.add("no-select");
};

// 是否启用云端会话
const enableCloudConversation = store?.localOptions.enableCloudConversation;

// autorun监听器
let totalUnreadCountWatch = () => {};
let totalSysMsgUnreadCountWatch = () => {};
// 通知点击事件监听器清理函数
let removeNotificationClickListener = () => {};

/**
 * 处理通知点击事件 - 跳转到对应会话
 * @param conversationId 会话 ID
 */
const handleNotificationClick = (conversationId?: string) => {
  if (!conversationId) {
    return;
  }
  // 切换到聊天模式
  model.value = 'chat';
  // 选中对应的会话
  store?.uiStore.selectConversation(conversationId);
};

// 生命周期钩子
onMounted(() => {
  // autorun监听未读消息数量变化
  totalUnreadCountWatch = autorun(() => {
    if (enableCloudConversation) {
      // 云端会话
      totalUnreadCount.value = store?.conversationStore?.totalUnreadCount || 0;
    } else {
      // 本地会话
      totalUnreadCount.value =
        store?.localConversationStore?.totalUnreadCount || 0;
    }
  });
  // autorun监听系统消息未读数量变化
  totalSysMsgUnreadCountWatch = autorun(() => {
    totalSysMsgUnreadCount.value =
      store?.sysMsgStore?.getTotalUnreadMsgsCount() || 0;
  });
  
  // 监听主进程请求显示关闭确认对话框
  if (window.electronAPI) {
    window.electronAPI.windowClose.onRequestCloseConfirmation(() => {
      showCloseConfirmation.value = true;
    });
  }

  // 监听通知点击事件
  removeNotificationClickListener = onNotificationClick(handleNotificationClick);
});

onUnmounted(() => {
  // 清理autorun监听
  totalUnreadCountWatch();
  totalSysMsgUnreadCountWatch();
  // 清理通知点击事件监听
  removeNotificationClickListener();
  document.removeEventListener("mousemove", onMouseMove);
  document.removeEventListener("mouseup", onMouseUp);
  document.body.classList.remove("no-select");
});
</script>

<style scoped>
.container-wrapper {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.container {
  width: 100%;
  height: 100%;
  box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.1);
  position: relative;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #fff;
  overflow: hidden;
}

.header {
  width: 100%;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #e7f2fc;
  border-bottom: 1px solid #d9d7d7;
}

.search {
  width: 600px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.add {
  margin-left: 20px;
}

.content {
  width: 100%;
  height: calc(100% - 60px);
  display: flex;
}

.left {
  width: 60px;
  border-right: 1px solid #d9d7d7;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  box-sizing: border-box;
  min-width: 60px;
  background-color: #e9f1f8;
}

.iconfont {
  font-size: 24px;
}

.chat-icon,
.contact-icon {
  margin: 0 0 25px 0;
  font-size: 22px;
  color: rgba(0, 0, 0, 0.6);
  height: 45px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  width: 36px;
  position: relative;
  user-select: none;
}

.active {
  color: #2a6bf2;
}

/* 小红点样式 */
.red-dot {
  position: absolute;
  top: 2px;
  right: -4px;
  width: 8px;
  height: 8px;
  background-color: #ff4d4f;
  border-radius: 50%;
  border: 1px solid #fff;
  z-index: 10;
}

.icon-label {
  font-size: 11px;
  text-align: center;
}

.right {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.right > div:not(.tip) {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.right-list {
  width: 320px;
}

.right-content {
  flex: 1;
  width: 0;
}
.splitter {
  width: 3px;
  cursor: col-resize;
  background: #f6f8fa;
  position: relative;
}
.splitter::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  transform: translateX(-0.5px);
  width: 1px;
  background-color: #2a6bf2;
  opacity: 0;
  transition: opacity 0.12s ease;
  pointer-events: none;
}
.splitter:hover::before,
.splitter.active::before {
  opacity: 1;
}
.no-select {
  user-select: none;
  -webkit-user-select: none;
}
.collect {
  width: 100%;
  height: 100%;
}
.collection-container {
  width: 100%;
  height: 100%;
}
.drag-region {
  -webkit-app-region: drag;
}
.no-drag {
  -webkit-app-region: no-drag;
}
</style>
