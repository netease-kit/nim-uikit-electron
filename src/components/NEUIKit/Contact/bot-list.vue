<template>
  <div class="bot-list-container">
    <div class="bot-list-header">
      <div class="header-title">{{ t("myRobotsText") }}</div>
      <div class="create-bot-btn" @click="handleCreateBot">
        <Icon iconClassName="add-icon" :size="16" type="icon-tianjiaanniu" />
      </div>
    </div>

    <Loading v-if="loading" />

    <div v-else-if="botList.length === 0" class="empty-state">
      <Empty :text="t('robotEmptyText')" />
      <p class="empty-tip">{{ t("robotEmptyTipText") }}</p>
    </div>

    <div v-else class="bot-list">
      <div
        v-for="bot in botList"
        :key="bot.accountId"
        class="bot-item"
        @click="handleBotClick(bot)"
      >
        <Avatar
          size="48"
          :account="bot.accountId"
          :avatar="bot.avatar"
          :nick="bot.name"
        />
        <div class="bot-info">
          <div class="bot-name">{{ bot.name || bot.accountId }}</div>
        </div>
      </div>
    </div>

    <CreateBotModal
      v-if="showCreateModal"
      :visible="showCreateModal"
      @close="handleCloseCreateModal"
      @success="handleCreateSuccess"
    />

    <BotCardModal
      v-if="showCardModal"
      :visible="showCardModal"
      :bot="selectedBot"
      @close="handleCloseCardModal"
      @delete="handleDeleteSuccess"
      @updated="handleBotUpdated"
      @afterSendMsgClick="emit('afterSendMsgClick')"
    />
  </div>
</template>

<script lang="ts" setup>
import { autorun } from "mobx";
import { onMounted, onUnmounted, ref } from "vue";
import type { V2NIMUserAIBot } from "node-nim/types/v2_def/v2_nim_struct_def";
import Avatar from "../CommonComponents/Avatar.vue";
import Empty from "../CommonComponents/Empty.vue";
import Icon from "../CommonComponents/Icon.vue";
import Loading from "../CommonComponents/Loading.vue";
import { getContextState } from "../utils/init";
import { t } from "../utils/i18n";
import { showToast } from "../utils/toast";
import BotCardModal from "./bot/bot-card-modal.vue";
import CreateBotModal from "./bot/create-bot-modal.vue";

const emit = defineEmits<{
  afterSendMsgClick: [];
}>();

const { store } = getContextState();
const loading = ref(false);
const botList = ref<V2NIMUserAIBot[]>([]);
const showCreateModal = ref(false);
const showCardModal = ref(false);
const selectedBot = ref<V2NIMUserAIBot | null>(null);

let aiBotsWatch = () => {};

const syncBotList = () => {
  botList.value = [...(store?.aiUserStore.aiBots.values() || [])].sort(
    (a, b) => (b.createTime || 0) - (a.createTime || 0)
  );
};

const fetchBotList = async () => {
  loading.value = true;
  try {
    const result = await store?.aiUserStore.getUserAIBotListActive();
    botList.value = result?.bots || [];
  } catch (error) {
    console.error("获取机器人列表失败:", error);
    showToast({ message: t("getRobotListFailedText"), type: "error" });
  } finally {
    loading.value = false;
  }
};

const handleBotClick = (bot: V2NIMUserAIBot) => {
  selectedBot.value = bot;
  showCardModal.value = true;
};

const handleCreateBot = () => {
  if (botList.value.length >= 10) {
    showToast(t("robotLimitReachedText"));
    return;
  }

  showCreateModal.value = true;
};

const handleCloseCreateModal = () => {
  showCreateModal.value = false;
};

const handleCreateSuccess = (bot: V2NIMUserAIBot) => {
  handleCloseCreateModal();
  selectedBot.value = bot;
  showCardModal.value = true;
  fetchBotList();
};

const handleCloseCardModal = () => {
  showCardModal.value = false;
  selectedBot.value = null;
};

const handleDeleteSuccess = () => {
  handleCloseCardModal();
};

const handleBotUpdated = async () => {
  await fetchBotList();
  if (selectedBot.value) {
    const updated = botList.value.find((bot) => bot.accountId === selectedBot.value?.accountId);
    if (updated) {
      selectedBot.value = updated;
    }
  }
};

onMounted(() => {
  aiBotsWatch = autorun(syncBotList);
  fetchBotList();
});

onUnmounted(() => {
  aiBotsWatch();
});
</script>

<style scoped>
.bot-list-container {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #f6f8fa;
}

.bot-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 66px;
  border-bottom: 1px solid #e9eff5;
  flex-shrink: 0;
}

.header-title {
  font-size: 16px;
  font-weight: 500;
  color: #333;
}

.create-bot-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background-color: #f1f5f8;
  border-radius: 6px;
  cursor: pointer;
}

.create-bot-btn:hover {
  background-color: #e9eff5;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
}

.empty-tip {
  margin-top: 10px;
  font-size: 14px;
  color: #666;
}

.bot-list {
  flex: 1;
  overflow: auto;
}

.bot-item {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  min-height: 60px;
  box-sizing: border-box;
  cursor: pointer;
}

.bot-item:hover {
  background-color: #eef3f8;
}

.bot-info {
  flex: 1;
  margin-left: 12px;
  overflow: hidden;
}

.bot-name {
  font-size: 14px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;
}
</style>
