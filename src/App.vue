<template>
  <div v-if="showUiKit" class="app-container">
    <router-view></router-view>
    <!-- 全局关于 Modal -->
    <AboutModal v-model:visible="showAboutModal" />
  </div>
</template>

<script lang="ts">
import { initIMUIKit, releaseIMUIKit } from "./components/NEUIKit/utils/init";
import { setLanguage, t } from "./components/NEUIKit/utils/i18n";
import { showToast } from "./components/NEUIKit/utils/toast";
import AboutModal from "./components/NEUIKit/CommonComponents/AboutModal.vue";
import storageManager from "./components/NEUIKit/utils/storage";
import {
  appConfig,
  FIXED_LOGIN_APP_KEY_STORAGE_KEY,
  getMissingFixedLoginFields,
  isFixedLoginMode,
} from "./config/appConfig";

export default {
  name: "App",
  components: {
    AboutModal,
  },
  data() {
    return {
      showUiKit: false,
      showAboutModal: false,
    };
  },

  methods: {
    /**
     * 初始化存储管理器
     * 预加载所有配置项到缓存中，提高后续访问性能
     */
    async initializeStorage() {
      try {
        await storageManager.initialize();
        console.log("[App] StorageManager 初始化完成");
      } catch (error) {
        console.error("[App] StorageManager 初始化失败:", error);
      }
    },

    /**
     * 设置事件监听器
     */
    async setupEventListeners() {
      // 监听窗口关闭事件，执行清理操作
      window.addEventListener("beforeunload", this.handleBeforeUnload);

      // 监听来自主进程的打开关于 Modal 事件
      if (window.electronAPI) {
        window.electronAPI.navigation.onNavigateToAbout(() => {
          this.showAboutModal = true;
        });
      }
    },

    async init(opts: { appKey: string; account: string; token: string }) {
      const languageSetting = await storageManager.getItemAsync("switchToEnglishFlag");
      setLanguage(languageSetting === "en" ? "en" : "zh");

      const { nim } = await initIMUIKit(opts.appKey);

      nim?.loginService
        ?.login(opts.account, opts.token, {})
        .then(() => {
          this.$router.push("/chat");
          this.showUiKit = true;
        })
        .catch(async (error) => {
          if (error.code === 102422) {
            showToast({
              message: t("accountBannedText"),
              type: "info",
            });
          }
          await storageManager.clearLoginInfo();
          this.$router.push("/login");
          this.showUiKit = true;
        });
    },
    async loginWithFixedCredentials() {
      const missingFields = getMissingFixedLoginFields();

      if (missingFields.length === 0) {
        this.init({
          appKey: appConfig.appKey,
          account: appConfig.account,
          token: appConfig.token,
        });
        return;
      }

      const [savedAppKey, savedLoginInfo] = await Promise.all([
        storageManager.getItemAsync(FIXED_LOGIN_APP_KEY_STORAGE_KEY),
        storageManager.getLoginInfo(),
      ]);

      if (!savedAppKey || !savedLoginInfo?.account || !savedLoginInfo?.token) {
        this.$router.push("/login");
        this.showUiKit = true;
        return;
      }

      this.init({
        appKey: savedAppKey,
        account: savedLoginInfo.account,
        token: savedLoginInfo.token,
      });
    },
    async checkLoginStatus() {
      if (isFixedLoginMode) {
        this.loginWithFixedCredentials();
        return;
      }

      try {
        const loginInfo = await storageManager.getLoginInfo();

        if (!loginInfo) {
          this.$router.push("/login");
          this.showUiKit = true;
          return;
        }

        const { account, token } = loginInfo;
        if (!account || !token) {
          // 登录信息无效，清除并跳转到登录页
          await storageManager.clearLoginInfo();
          this.$router.push("/login");
          this.showUiKit = true;
          return;
        }
        this.init({
          appKey: appConfig.appKey,
          account,
          token,
        });
      } catch (error) {
        console.error("读取登录信息失败", error);
        // 登录信息无效，清除并跳转到登录页
        await storageManager.clearLoginInfo();
        this.$router.push("/login");
        this.showUiKit = true;
      }
    },
    handleBeforeUnload() {
      // 窗口即将关闭，清理 SDK
      console.log("[App] 窗口即将关闭，正在清理 IM UIKit...");
      releaseIMUIKit();
    },
  },
  async mounted() {
    // 并行执行初始化和检查登录状态
    await Promise.all([this.initializeStorage(), this.setupEventListeners()]);

    // 检查登录状态
    this.checkLoginStatus();
  },
  beforeUnmount() {
    // 移除事件监听器
    window.removeEventListener("beforeunload", this.handleBeforeUnload);

    if (window.electronAPI) {
      window.electronAPI.navigation.removeNavigateToAboutListener();
    }
  },
};
</script>

<style>
.app-container {
  position: fixed;
  inset: 0;
  width: auto;
  height: auto;
  min-width: 0;
  max-width: none;
  box-sizing: border-box;
  overflow: hidden;
  background-image: url("./assets/bg.png");
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}
</style>
