<template>
  <Modal
    :visible="visible"
    :title="t('createRobotText')"
    :width="420"
    :height="300"
    :showDefaultFooter="false"
    @close="handleClose"
  >
    <div class="create-bot-form">
      <div class="form-item horizontal">
        <label class="form-label">{{ t("robotAvatarText") }}</label>
        <div class="form-control">
          <div class="avatar-upload-area">
            <div v-if="formData.avatar" class="avatar-preview" @click="handleAvatarClick">
              <img :src="formData.avatar" class="avatar-img" alt="avatar" />
            </div>
            <button v-else class="upload-btn" @click="handleAvatarClick">
              {{ t("uploadImageText") }}
            </button>
          </div>
        </div>
      </div>

      <div class="form-item horizontal">
        <label class="form-label">{{ t("robotNameText") }}</label>
        <div class="form-control">
          <Input
            v-model="formData.name"
            :placeholder="t('robotNamePlaceholder')"
            :maxlength="ROBOT_NAME_MAX_LENGTH"
            @input="handleNameInput"
          />
          <div v-if="nameError" class="error-tip">{{ nameError }}</div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="modal-footer">
        <Button type="default" @click="handleClose">{{ t("cancelText") }}</Button>
        <Button type="primary" :disabled="loading" @click="handleSubmit">
          {{ loading ? "..." : t("confirmText") }}
        </Button>
      </div>
    </template>
  </Modal>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import type { V2NIMUserAIBot } from "node-nim/types/v2_def/v2_nim_struct_def";
import Button from "../../CommonComponents/Button.vue";
import Input from "../../CommonComponents/Input.vue";
import Modal from "../../CommonComponents/Modal.vue";
import { getContextState } from "../../utils/init";
import { t } from "../../utils/i18n";
import { showToast, toast } from "../../utils/toast";

defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  close: [];
  success: [bot: V2NIMUserAIBot];
}>();

const ROBOT_NAME_MAX_LENGTH = 15;
const { store } = getContextState();
const formData = ref({
  name: "",
  avatar: "",
});
const nameError = ref("");
const loading = ref(false);
const selectedFilePath = ref("");

const resetForm = () => {
  formData.value = {
    name: "",
    avatar: "",
  };
  nameError.value = "";
  selectedFilePath.value = "";
};

const handleNameInput = () => {
  nameError.value = "";
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
    formData.value.avatar = result.file.base64 || "";
  } catch (error) {
    console.error("选择机器人头像失败:", error);
    showToast({ message: t("selectImageText"), type: "error" });
  }
};

const validateForm = () => {
  const trimmedName = formData.value.name.trim();

  if (!trimmedName) {
    nameError.value = t("robotNameRequiredText");
    return false;
  }

  return true;
};

const handleSubmit = async () => {
  if (!validateForm()) {
    return;
  }

  loading.value = true;

  try {
    const avatarUrl = selectedFilePath.value
      ? await store?.storageStore.uploadFileActive(selectedFilePath.value)
      : "";
    const accountId = `bot_${crypto.randomUUID().replace(/-/g, "").slice(0, 28)}`;
    const name = formData.value.name.trim();

    await store?.aiUserStore.createUserAIBotActive({
      accountId,
      name,
      avatar: avatarUrl,
    });

    toast.success(t("createRobotSuccessText"));
    emit("success", {
      accountId,
      name,
      avatar: avatarUrl,
    });
    resetForm();
  } catch (error) {
    console.error("创建机器人失败:", error);
    toast.error(t("createRobotFailedText"));
  } finally {
    loading.value = false;
  }
};

const handleClose = () => {
  resetForm();
  emit("close");
};
</script>

<style scoped>
.create-bot-form {
  padding: 10px 0;
  height: 170px;
  box-sizing: border-box;
}

.form-item {
  margin-bottom: 10px;
  height: 60px;
  box-sizing: border-box;
}

.form-item.horizontal {
  display: flex;
  align-items: center;
  gap: 16px;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  min-width: 80px;
}

.form-control {
  flex: 1;
}

.avatar-upload-area {
  display: flex;
  align-items: center;
}

.avatar-preview {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.upload-btn {
  height: 32px;
  padding: 0 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
  color: #606266;
  cursor: pointer;
}

.error-tip {
  margin-top: 4px;
  font-size: 12px;
  color: #ff4d4f;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 12px 20px 16px;
}
</style>
