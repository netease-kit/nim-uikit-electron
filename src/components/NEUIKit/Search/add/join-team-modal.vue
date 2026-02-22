<template>
  <Modal
    :visible="visible"
    :title="t('joinTeamText')"
    :width="500"
    :height="260"
    :top="100"
    :showDefaultFooter="!searchRes"
    :confirmText="t('searchButtonText')"
    :cancelText="t('cancelText')"
    :confirmDisabled="!searchValue.trim()"
    @confirm="handleSearch"
    @cancel="handleClose"
    @close="handleClose"
    @update:visible="handleUpdateVisible"
  >
    <div class="join-team-content">
      <!-- 搜索输入框 -->
      <Input
        v-model="searchValue"
        :placeholder="t('teamIdPlaceholder')"
        @input="handleChange"
        :inputStyle="{
          width: '100%',
          padding: '8px 12px',
          border: '1px solid #d9d9d9',
          borderRadius: '6px',
        }"
      />

      <!-- 搜索结果为空 -->
      <div v-if="searchResEmpty" class="empty-content">
        {{ t("teamIdNotMatchText") }}
      </div>

      <!-- 搜索结果 -->
      <div v-else-if="searchRes && searchRes !== 'notFind'" class="search-result-content">
        <div class="team-info">
          <Avatar size="40" :avatar="searchRes.avatar" :account="searchRes.teamId || ''" />
          <div class="team-details">
            <div class="team-name">
              {{ searchRes.name || searchRes.teamId }}
            </div>
            <div class="team-id">
              {{ searchRes.teamId }}
            </div>
          </div>
          <div class="action-button">
            <Button v-if="inTeam" type="primary" @click="handleChat">
              {{ t("chatButtonText") }}
            </Button>
            <Button v-else type="primary" :loading="adding" @click="handleAdd">
              {{ t("addText") }}
            </Button>
          </div>
        </div>
      </div>
      <!-- 未找到 -->
      <div v-if="searchRes == 'notFind'" class="empty-content">
        {{ t("searchNoResText") }}
      </div>
    </div>
  </Modal>
</template>

<script lang="ts" setup>
import { ref, onBeforeUnmount } from "vue";
import { autorun } from "mobx";
import Modal from "../../CommonComponents/Modal.vue";
import Input from "../../CommonComponents/Input.vue";
import Avatar from "../../CommonComponents/Avatar.vue";
import Button from "../../CommonComponents/Button.vue";
import { showToast } from "../../utils/toast";
import { t } from "../../utils/i18n";
import { V2NIMConst } from "../../utils/constants";
import type { V2NIMTeam } from "node-nim/types/v2_def/v2_nim_struct_def";
import { getContextState } from "../../utils/init";

// Props
interface Props {
  visible: boolean;
  prefix?: string;
  commonPrefix?: string;
}

withDefaults(defineProps<Props>(), {
  visible: false,
  prefix: "search",
  commonPrefix: "common",
});

// Emits
const emit = defineEmits<{
  close: [];
  chat: [teamId: string];
  "update:visible": [value: boolean];
  goChat: [];
}>();

const { store } = getContextState();

// 响应式数据
const searchValue = ref("");
const searchRes = ref<V2NIMTeam | undefined | "notFind">(undefined);
const searchResEmpty = ref(false);
const adding = ref(false);

// 是否已入群
const inTeam = ref(false);

// MobX autorun 清理函数
let disposeAutorun: (() => void) | null = null;

// 事件处理函数
const handleChange = (event: InputEvent) => {
  searchValue.value = (event.target as HTMLInputElement).value;
  searchResEmpty.value = false;
  searchRes.value = undefined;
};

const handleSearch = async () => {
  try {
    const team = await store?.teamStore.getTeamForceActive(searchValue.value);

    if (!team) {
      searchResEmpty.value = true;
    } else {
      searchRes.value = team;
      // 搜索成功后,检查是否已入群
      checkInTeamStatus(team.teamId || "");
    }
  } catch {
    searchRes.value = "notFind";
    showToast({
      message: t("searchFailText"),
      type: "info",
    });
  }
};

// 检查是否已入群
const checkInTeamStatus = (teamId: string) => {
  if (!teamId) return;

  const conversationId = store?.nim.conversationIdUtil?.teamConversationId(teamId) || "";
  const hasConversation = store?.sdkOptions?.enableCloudConversation
    ? store?.conversationStore?.conversations.has(conversationId)
    : store?.localConversationStore?.conversations.has(conversationId);

  const hasTeam = store?.teamStore.teams.has(teamId);

  inTeam.value = !!hasConversation || !!hasTeam;
};

// 设置会话监听
const setupConversationWatch = (teamId: string) => {
  // 清除之前的 autorun
  if (disposeAutorun) {
    disposeAutorun();
  }

  // 使用 MobX autorun 监听会话列表变化
  disposeAutorun = autorun(() => {
    const conversationId = store?.nim.conversationIdUtil?.teamConversationId(teamId) || "";
    const conversationStore = store?.sdkOptions?.enableCloudConversation
      ? store?.conversationStore
      : store?.localConversationStore;

    // 检查会话是否存在
    const hasConversation = conversationStore?.conversations.has(conversationId);

    // 检查是否在群组列表中
    const hasTeam = store?.teamStore.teams.has(teamId);

    // 更新 inTeam 状态
    if (hasConversation || hasTeam) {
      inTeam.value = true;
      // 检测到入群后,清除监听
      if (disposeAutorun) {
        disposeAutorun();
        disposeAutorun = null;
      }
    }
  });
};

const handleAdd = async () => {
  try {
    if (searchRes.value && searchRes.value !== "notFind") {
      if (searchRes.value.teamType === V2NIMConst.V2NIMTeamType.V2NIM_TEAM_TYPE_INVALID) {
        showToast({
          message: t("notSupportJoinText"),
          type: "error",
        });
        return;
      }

      adding.value = true;
      const teamId = searchRes.value.teamId || "";
      await store?.teamStore.applyTeamActive(teamId);

      // 根据joinMode判断显示的提示文案和按钮状态
      // V2NIM_TEAM_JOIN_MODE_FREE = 0 自由加入，无须验证
      // V2NIM_TEAM_JOIN_MODE_APPLY = 1 需申请，群主或管理同意后加入
      const joinMode = searchRes.value.joinMode;
      if (joinMode === V2NIMConst.V2NIMTeamJoinMode.V2NIM_TEAM_JOIN_MODE_APPLY) {
        // 需要审核:显示"申请已发送"
        showToast({
          message: t("joinTeamApplySentText"),
          type: "success",
        });
      } else {
        // 无需审核:显示"加入成功"
        showToast({
          message: t("joinTeamSuccessText"),
          type: "success",
        });
      }
      // 设置会话监听,通过监听会话列表变化来判断是否真正入群
      setupConversationWatch(teamId);
    }

    adding.value = false;
  } catch (error: any) {
    if (error.code === 108437) {
      showToast({
        message: t("joinTeamLimitText"),
        type: "error",
      });
    } else {
      showToast({
        message: t("joinTeamFailedText"),
        type: "error",
      });
    }

    adding.value = false;
  }
};

const handleChat = async () => {
  if (searchRes.value && searchRes.value !== "notFind") {
    if (store?.sdkOptions?.enableCloudConversation) {
      await store?.conversationStore?.insertConversationActive(
        V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM,
        searchRes.value.teamId || ""
      );
    } else {
      await store?.localConversationStore?.insertConversationActive(
        V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM,
        searchRes.value.teamId || ""
      );
    }
    emit("goChat");

    handleClose();
  }
};

const handleClose = () => {
  // 清除 MobX autorun
  if (disposeAutorun) {
    disposeAutorun();
    disposeAutorun = null;
  }
  emit("close");
};

const handleUpdateVisible = (value: boolean) => {
  emit("update:visible", value);
};

onBeforeUnmount(() => {
  // 组件销毁时清除 MobX autorun
  if (disposeAutorun) {
    disposeAutorun();
    disposeAutorun = null;
  }
});
</script>

<style scoped>
.join-team-content {
  padding: 20px 0 0 0;
}

.empty-content {
  text-align: center;
  color: #f24957;
  margin-top: 20px;
  font-size: 14px;
}

.search-result-content {
  margin-top: 20px;
}

.team-info {
  display: flex;
  align-items: center;
  padding: 10px;
  border-radius: 8px;
}

.team-details {
  flex: 1;
  margin: 0 12px;
  overflow: hidden;
  font-size: 14px;
}

.team-name {
  color: #000;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.team-id {
  font-size: 14px;
  color: #666;
  font-size: 14px;
}

.action-button {
  max-width: 80px;
}
</style>
