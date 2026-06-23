<template>
  <Modal
    :visible="visible"
    :title="''"
    :showDefaultFooter="false"
    :width="350"
    :showClose="false"
    :top="80"
    :maskOpacity="0"
    :bodyStyle="{ padding: 0 }"
    @close="handleClose"
  >
    <div v-if="bot" class="bot-card">
      <div class="header-section"></div>

      <div class="user-info">
        <div class="user-header">
          <div class="avatar-wrapper" @click="handleAvatarClick">
            <Avatar
              size="84"
              fontSize="18"
              :account="bot.accountId"
              :avatar="avatarPreview || bot.avatar"
              :nick="bot.name"
            />
            <img v-if="avatarPreview" :src="avatarPreview" class="avatar-preview-img" />
          </div>
          <div class="username-wrapper">
            <input
              ref="nameInputRef"
              v-model="editName"
              class="bot-name-input"
              :class="{ editing: isEditingName }"
              :readonly="!isEditingName"
              :maxlength="ROBOT_NAME_MAX_LENGTH"
              @click="startEditName"
              @input="handleNameInput"
              @blur="stopEditName"
              @keydown.enter="stopEditName"
            />
          </div>
        </div>

        <div class="user-details">
          <div class="detail-item">
            <span class="label">{{ t("robotAccountIdText") }}</span>
            <span class="value">{{ bot.accountId }}</span>
          </div>
        </div>
      </div>

      <div class="bot-actions">
        <div class="action-item" @click="handleSendMessage">
          <span>{{ t("sendMessageText") }}</span>
          <Icon type="icon-jiantou" :size="14" />
        </div>
        <div class="action-item" @click="handleViewConfig">
          <span>{{ t("viewRobotConfigText") }}</span>
          <Icon type="icon-jiantou" :size="14" />
        </div>
        <div class="action-item" @click="handleRefreshToken">
          <span>{{ t("refreshRobotTokenText") }}</span>
          <Icon type="icon-jiantou" :size="14" />
        </div>
        <div class="action-item danger" @click="handleDelete">
          <span>{{ t("deleteRobotText") }}</span>
          <Icon type="icon-jiantou" :size="14" />
        </div>
      </div>

      <div class="actions">
        <button class="action-btn default" @click="handleCancel">
          {{ t("cancelText") }}
        </button>
        <button class="action-btn primary" :disabled="saveLoading" @click="handleSave">
          {{ saveLoading ? "..." : t("saveText") }}
        </button>
      </div>
    </div>

    <Modal
      v-if="showConfigModal"
      :visible="showConfigModal"
      :title="t('robotConfigText')"
      :showDefaultFooter="false"
      :width="400"
      @close="showConfigModal = false"
    >
      <div class="config-content">
        <div class="config-item">
          <div class="config-value">{{ displayConfigText }}</div>
        </div>
        <div class="config-tip">{{ t("robotConfigWarningText") }}</div>
        <div class="config-actions">
          <Button type="primary" @click="handleCopyFullConfig">
            {{ t("copyFullConfigText") }}
          </Button>
        </div>
      </div>
    </Modal>

    <Modal
      v-if="showDeleteConfirm"
      :visible="showDeleteConfirm"
      :title="t('deleteRobotText')"
      :confirmText="t('deleteText')"
      :cancelText="t('cancelText')"
      :confirmDisabled="deleteLoading"
      @confirm="handleConfirmDelete"
      @cancel="showDeleteConfirm = false"
      @close="showDeleteConfirm = false"
    >
      <div class="confirm-content">
        <p>{{ t("deleteRobotConfirmText") }}</p>
      </div>
    </Modal>

    <Modal
      v-if="showRefreshTokenConfirm"
      :visible="showRefreshTokenConfirm"
      :title="t('refreshRobotTokenText')"
      :confirmText="t('confirmText')"
      :cancelText="t('cancelText')"
      @confirm="handleConfirmRefreshToken"
      @cancel="showRefreshTokenConfirm = false"
      @close="showRefreshTokenConfirm = false"
    >
      <div class="confirm-content">
        <p>{{ t("refreshTokenConfirmText") }}</p>
      </div>
    </Modal>
  </Modal>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, watch } from "vue";
import { V2NIMConst } from "node-nim";
import type { V2NIMUserAIBot } from "node-nim/types/v2_def/v2_nim_struct_def";
import Avatar from "../../CommonComponents/Avatar.vue";
import Button from "../../CommonComponents/Button.vue";
import Icon from "../../CommonComponents/Icon.vue";
import Modal from "../../CommonComponents/Modal.vue";
import { getContextState, imAppkey } from "../../utils/init";
import { t } from "../../utils/i18n";
import { showToast, toast } from "../../utils/toast";

const props = defineProps<{
  visible: boolean;
  bot: V2NIMUserAIBot | null;
}>();

const emit = defineEmits<{
  close: [];
  delete: [];
  updated: [];
  afterSendMsgClick: [];
}>();

const ROBOT_NAME_MAX_LENGTH = 15;
const { store } = getContextState();
const showConfigModal = ref(false);
const showDeleteConfirm = ref(false);
const showRefreshTokenConfirm = ref(false);
const tokenInfo = ref("");
const deleteLoading = ref(false);
const saveLoading = ref(false);
const isEditingName = ref(false);
const editName = ref("");
const nameInputRef = ref<HTMLInputElement>();
const avatarPreview = ref("");
const selectedFilePath = ref("");

const configAppkey = computed(() => imAppkey || "");
const fullConfigText = computed(() =>
  [configAppkey.value, props.bot?.accountId || "", tokenInfo.value].join("|")
);
const displayConfigText = computed(() => {
  const text = fullConfigText.value;
  if (!text) return "";
  const visibleLength = Math.ceil(text.length / 3);
  return visibleLength >= text.length ? text : `${text.slice(0, visibleLength)}...`;
});

watch(
  () => props.bot,
  (bot) => {
    editName.value = bot?.name || "";
    avatarPreview.value = "";
    selectedFilePath.value = "";
  },
  { immediate: true }
);

const startEditName = async () => {
  if (isEditingName.value) return;
  isEditingName.value = true;
  await nextTick();
  nameInputRef.value?.focus();
  nameInputRef.value?.select();
};

const stopEditName = () => {
  isEditingName.value = false;
};

const handleNameInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.value.length > ROBOT_NAME_MAX_LENGTH) {
    target.value = target.value.slice(0, ROBOT_NAME_MAX_LENGTH);
  }
  editName.value = target.value;
};

const handleAvatarClick = async () => {
  try {
    const result = await window.electronAPI.fs.chooseFile({
      type: "image",
      title: t("selectAvatarText") || t("selectImageText"),
    });

    if (!result) {
      return;
    }

    selectedFilePath.value = result.file.url;
    avatarPreview.value = result.file.base64 || "";
  } catch (error) {
    console.error("选择机器人头像失败:", error);
    showToast({ message: t("selectImageText"), type: "error" });
  }
};

const handleSave = async () => {
  if (!props.bot) return;
  const name = editName.value.trim();
  if (!name) {
    showToast(t("robotNameRequiredText"));
    return;
  }

  saveLoading.value = true;
  try {
    const avatar = selectedFilePath.value
      ? await store?.storageStore.uploadFileActive(selectedFilePath.value)
      : props.bot.avatar;

    await store?.aiUserStore.updateUserAIBotActive({
      accountId: props.bot.accountId,
      name,
      avatar,
    });

    toast.success(t("saveRobotSuccessText"));
    avatarPreview.value = "";
    selectedFilePath.value = "";
    emit("updated");
  } catch (error) {
    console.error("保存机器人失败:", error);
    toast.error(t("saveRobotFailedText"));
  } finally {
    saveLoading.value = false;
  }
};

const handleCancel = () => {
  editName.value = props.bot?.name || "";
  avatarPreview.value = "";
  selectedFilePath.value = "";
  emit("close");
};

const handleSendMessage = async () => {
  if (!props.bot) return;
  if (store?.localOptions?.enableCloudConversation) {
    await store.conversationStore?.insertConversationActive(
      V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P,
      props.bot.accountId,
      true
    );
  } else {
    await store?.localConversationStore?.insertConversationActive(
      V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P,
      props.bot.accountId,
      true
    );
  }
  emit("afterSendMsgClick");
  handleClose();
};

const handleViewConfig = async () => {
  if (!props.bot) return;
  try {
    const result = await store?.aiUserStore.getUserAIBotActive({
      accountId: props.bot.accountId,
    });
    tokenInfo.value = result?.token || "";
    showConfigModal.value = true;
  } catch (error) {
    console.error("获取机器人配置失败:", error);
    tokenInfo.value = "";
    showToast(t("viewConfigFailedText"));
  }
};

const handleCopyFullConfig = async () => {
  try {
    await navigator.clipboard.writeText(fullConfigText.value);
    toast.success(t("copySuccessText"));
  } catch (error) {
    console.error("复制机器人配置失败:", error);
  }
};

const handleRefreshToken = () => {
  showRefreshTokenConfirm.value = true;
};

const handleConfirmRefreshToken = async () => {
  if (!props.bot) return;
  showRefreshTokenConfirm.value = false;
  try {
    const result = await store?.aiUserStore.refreshUserAIBotTokenActive({
      accountId: props.bot.accountId,
    });
    tokenInfo.value = result?.token || "";
    toast.success(t("refreshTokenSuccessText"));
  } catch (error) {
    console.error("刷新机器人 Token 失败:", error);
    showToast(t("refreshTokenFailedText"));
  }
};

const handleDelete = () => {
  showDeleteConfirm.value = true;
};

const handleConfirmDelete = async () => {
  if (!props.bot) return;
  deleteLoading.value = true;
  try {
    await store?.aiUserStore.deleteUserAIBotActive({
      accountId: props.bot.accountId,
    });
    toast.success(t("deleteRobotSuccessText"));
    showDeleteConfirm.value = false;
    emit("delete");
  } catch (error) {
    console.error("删除机器人失败:", error);
    showToast(t("deleteRobotFailedText"));
  } finally {
    deleteLoading.value = false;
  }
};

const handleClose = () => {
  emit("close");
};
</script>

<style scoped>
.bot-card {
  position: relative;
  background-color: #fff;
  border-radius: 8px;
  overflow: hidden;
  width: 100%;
}

.header-section {
  height: 90px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.user-info {
  padding: 0 20px 10px;
  position: relative;
}

.user-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: -40px;
  margin-bottom: 10px;
  position: relative;
  z-index: 2;
}

.avatar-wrapper {
  position: relative;
  width: 84px;
  height: 84px;
  flex-shrink: 0;
  cursor: pointer;
  border-radius: 50%;
  border: 3px solid #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  background: #fff;
  overflow: hidden;
}

.avatar-preview-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  z-index: 20;
}

.username-wrapper {
  flex: 1;
  padding-top: 54px;
}

.bot-name-input {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  background: #f1f5f8;
  border: none;
  outline: none;
  padding: 4px 8px;
  width: 100%;
  border-radius: 4px;
  cursor: pointer;
  box-sizing: border-box;
}

.bot-name-input.editing {
  cursor: text;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
}

.label {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.value {
  font-size: 14px;
  color: #333;
  text-align: right;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: monospace;
}

.bot-actions {
  padding: 4px 20px;
}

.action-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 0;
  cursor: pointer;
  border-radius: 6px;
  font-size: 14px;
  color: #333;
}

.action-item:hover {
  color: #537ff4;
}

.action-item.danger {
  color: #ff4d4f;
}

.actions {
  padding: 10px 20px 20px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  gap: 10px;
}

.action-btn {
  flex: 1;
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-btn.primary {
  background-color: #537ff4;
  color: #fff;
}

.action-btn.default {
  background-color: #f0f0f0;
  color: #333;
}

.config-content {
  padding: 20px 0;
}

.config-item {
  margin-bottom: 20px;
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 6px;
}

.config-value {
  font-size: 14px;
  color: #333;
  font-family: monospace;
  word-break: break-all;
  padding: 8px;
  background-color: #fff;
  border-radius: 4px;
}

.config-tip {
  margin-bottom: 16px;
  font-size: 12px;
  line-height: 1.5;
  color: #faad14;
}

.config-actions {
  display: flex;
  justify-content: center;
}

.confirm-content {
  padding: 20px 0;
}

.confirm-content p {
  font-size: 14px;
  color: #333;
  line-height: 1.6;
}
</style>
