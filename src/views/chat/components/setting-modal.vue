<template>
  <Modal
    :visible="visible"
    :title="t('setText')"
    :confirmText="t('okText')"
    :cancelText="t('cancelText')"
    :width="550"
    :height="500"
    :top="100"
    :showDefaultFooter="true"
    @confirm="onConfirm"
    @cancel="handleClose"
  >
    <div class="setting-item-wrapper">
      <div class="setting-item">
        <div class="item-left">{{ t("enableCloudConversationText") }}</div>
        <div class="item-right">
          <Switch
            :checked="enableCloudConversation"
            @change="
              (value) => {
                enableCloudConversation = value;
                onChangeSetting('enableCloudConversation', value);
              }
            "
          />
        </div>
      </div>
      <div class="setting-item">
        <div class="item-left">{{ t("teamManagerEnableText") }}</div>
        <div class="item-right">
          <Switch
            :checked="teamManagerVisible"
            @change="
              (value) => {
                teamManagerVisible = value;
                onChangeSetting('teamManagerVisible', value);
              }
            "
          />
        </div>
      </div>
      <div class="setting-item">
        <div class="item-left">{{ t("enableCloudSearchText") }}</div>
        <div class="item-right">
          <Switch
            :checked="enableCloudSearch"
            @change="
              (value) => {
                enableCloudSearch = value;
                onChangeCloudSearch(value);
              }
            "
          />
        </div>
      </div>
      <div class="setting-item">
        <div class="item-left">{{ t("closeActionSettingText") }}</div>
        <div class="item-right">
          <select
            class="close-action-select"
            v-model="closeActionPreference"
            @change="onChangeCloseAction"
          >
            <option value="default">{{ t("closeActionDefaultText") }}</option>
            <option value="minimize">{{ t("closeActionMinimizeText") }}</option>
            <option value="quit">{{ t("closeActionQuitText") }}</option>
          </select>
        </div>
      </div>
      <div class="setting-item" v-if="isElectronEnv">
        <div class="item-left">
          <div class="item-title">{{ t("desktopNotificationText") }}</div>
          <div class="item-desc">{{ t("desktopNotificationDesc") }}</div>
        </div>
        <div class="item-right">
          <Switch :checked="enableDesktopNotification" @change="onChangeDesktopNotification" />
        </div>
      </div>
      <div class="setting-item">
        <div class="item-left">{{ t("smsApiEnvText") }}</div>
        <div class="item-right">
          <select class="env-select" v-model="smsApiEnv" @change="onChangeSmsApiEnv">
            <option value="prod">{{ t("prodEnvText") }}</option>
            <option value="qa">{{ t("qaEnvText") }}</option>
          </select>
        </div>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import Modal from "../../../components/NEUIKit/CommonComponents/Modal.vue";
import { t } from "../../../components/NEUIKit/utils/i18n";
import { ref, computed, onMounted } from "vue";
import { showToast } from "../../../components/NEUIKit/utils/toast";
import Switch from "../../../components/NEUIKit/CommonComponents/Switch.vue";
import { getContextState } from "../../../components/NEUIKit/utils/init";
import { useRouter } from "vue-router";
import storageManager from "../../../components/NEUIKit/utils/storage";

interface Props {
  visible: boolean;
}

withDefaults(defineProps<Props>(), {
  visible: false,
});

// Emits
interface Emits {
  (e: "update:visible", visible: boolean): void;
  (e: "close"): void;
}

// 获取全局状态
const { store } = getContextState();
const router = useRouter();

const enableCloudConversation = ref(false);
const teamManagerVisible = ref(false);
const switchToEnglishFlag = ref(false);
const closeActionPreference = ref<"default" | "minimize" | "quit">("default");
const enableDesktopNotification = ref(true);
const enableCloudSearch = ref(true);
const smsApiEnv = ref<"prod" | "qa">("prod");

// 检查是否在 Electron 环境中
const isElectronEnv = computed(() => !!window.electronAPI);

onMounted(async () => {
  // 使用统一存储加载设置
  teamManagerVisible.value = (await storageManager.getItemAsync("teamManagerVisible")) !== "off";
  enableCloudConversation.value =
    (await storageManager.getItemAsync("enableCloudConversation")) === "on";
  switchToEnglishFlag.value = (await storageManager.getItemAsync("switchToEnglishFlag")) === "en";

  // 加载桌面通知设置
  const savedNotification = await storageManager.getItemAsync("enableDesktopNotification");
  enableDesktopNotification.value = savedNotification !== "off";

  // 加载云端搜索设置
  const savedCloudSearch = await storageManager.getItemAsync("enableCloudSearch");
  enableCloudSearch.value = savedCloudSearch !== "off";

  // 加载 API 环境设置
  const apiEnv = await storageManager.getItemAsync("smsApiEnv");
  if (apiEnv === "qa" || apiEnv === "prod") {
    smsApiEnv.value = apiEnv;
  }

  // 加载关闭行为偏好（统一所有平台）
  if (window.electronAPI) {
    try {
      const preference = await window.electronAPI.windowClose.getClosePreference();
      closeActionPreference.value = (preference || "default") as "default" | "minimize" | "quit";
    } catch (error) {
      console.error("Failed to get close preference:", error);
    }
  }
});

const emit = defineEmits<Emits>();

const onConfirm = () => {};

const handleClose = () => {
  emit("close");
};

const onChangeSetting = async (key: string, value: boolean) => {
  await storageManager.setItem(key, value ? "on" : "off");
  showToast({
    type: "info",
    message: "重启应用生效",
  });
  emit("close");
};

const onChangeCloseAction = async () => {
  if (window.electronAPI) {
    try {
      await window.electronAPI.windowClose.setClosePreference(closeActionPreference.value);
      showToast({
        type: "info",
        message: t("saveSuccessText"),
      });
    } catch (error) {
      console.error("Failed to set close preference:", error);
      showToast({
        type: "error",
        message: t("saveFailedText"),
      });
    }
  }
};

const onChangeSmsApiEnv = async () => {
  await storageManager.setItem("smsApiEnv", smsApiEnv.value);
  const { nim } = getContextState();
  try {
    await nim?.loginService?.logout();
  } catch {
    /**/
  }
  await storageManager.clearLoginInfo();
  store?.resetState();
  router.push("/login");
};

/**
 * 处理桌面通知设置变更
 * @param value 是否启用桌面通知
 */
const onChangeDesktopNotification = async (value: boolean) => {
  enableDesktopNotification.value = value;
  // 保存到统一存储
  await storageManager.setItem("enableDesktopNotification", value ? "on" : "off");
  // 更新 store 中的 localOptions（实时生效）
  if (store?.localOptions) {
    store.localOptions.enableDesktopNotification = value;
  }
  showToast({
    type: "info",
    message: t("saveSuccessText"),
  });
};

/**
 * 处理云端搜索设置变更
 * @param value 是否启用云端搜索
 */
const onChangeCloudSearch = async (value: boolean) => {
  enableCloudSearch.value = value;
  // 保存到统一存储
  await storageManager.setItem("enableCloudSearch", value ? "on" : "off");
  // 更新 store 中的 localOptions（实时生效）
  if (store?.localOptions) {
    store.localOptions.enableCloudSearch = value;
  }
  showToast({
    type: "info",
    message: t("saveSuccessText"),
  });
};
</script>

<style scoped>
.wrapper {
  background-color: rgb(245, 246, 247);
  width: 100%;
  min-height: 100vh;
  box-sizing: border-box;
}

.setting-item-wrapper {
  background: #fff;
  border-radius: 8px;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  color: #000;
}

.item-left {
  font-size: 16px;

  .item-title {
    font-size: 16px;
    color: #000;
  }

  .item-desc {
    font-size: 12px;
    color: #999;
    margin-top: 4px;
  }
}

.item-right {
  .close-action-select {
    padding: 6px 12px;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    font-size: 14px;
    color: #333;
    background-color: #fff;
    cursor: pointer;
    outline: none;
    transition: border-color 0.3s;

    &:hover {
      border-color: #40a9ff;
    }

    &:focus {
      border-color: #1890ff;
      box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
    }
  }
}

.env-select {
  padding: 6px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
  color: #333;
  background-color: #fff;
  cursor: pointer;
  outline: none;
  transition: border-color 0.3s;
}

.box-shadow {
  height: 1px;
  background-color: #ebedf0;
  margin: 0 16px;
}
</style>
