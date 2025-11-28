<template>
  <div v-if="showUiKit" class="app-container">
    <router-view></router-view>
  </div>
</template>

<script lang="ts">
import { initIMUIKit } from "./components/NEUIKit/utils/init";
import { setLanguage } from "./components/NEUIKit/utils/i18n";
import { STORAGE_KEY } from "./components/NEUIKit/utils/constants";
import { showToast } from "./components/NEUIKit/utils/toast";
export default {
  name: "App",
  components: {},
  data() {
    return {
      showUiKit: false,
    };
  },

  methods: {
    async init(opts: { appkey: string; account: string; token: string }) {
      // 设置语言
      setLanguage(
        localStorage.getItem("switchToEnglishFlag") == "en" ? "en" : "zh"
      );

      // 初始化IMUIKit
      const { nim } = initIMUIKit(opts.appkey);

      nim?.loginService
        ?.login(opts.account, opts.token, {})
        .then(() => {
          // IM 登录成功后跳转到会话页面
          // this.$router.push("/chat");
          this.showUiKit = true;
        })
        .catch((error) => {
          if (error.code === 102422) {
            // 账号被封禁
            showToast({
              message: "当前账号已被封禁",
              type: "info",
            });
            // 登录信息无效，清除并跳转到登录页
            localStorage.removeItem(STORAGE_KEY);
            this.$router.push("/login");
          }
        });
    },
    checkLoginStatus() {
      // 获取登录信息
      const loginInfo = localStorage.getItem(STORAGE_KEY);
      // 未登录，跳转到登录页
      if (!loginInfo) {
        // this.$router.push("/login");
        this.showUiKit = true;
        return;
        // 已登录，跳转到会话页面
      } else {
        try {
          const { account, token } = JSON.parse(loginInfo);
          // 重新初始化 IMUIKit
          this.init({
            appkey: "",
            account,
            token,
          });
        } catch (error) {
          console.error("解析登录信息失败", error);
          // 登录信息无效，清除并跳转到登录页
          localStorage.removeItem(STORAGE_KEY);
          // this.$router.push("/login");
        }
      }
    },
  },
  mounted() {
    // 检查登录状态
    this.init({
      appkey: "", // 请填写你的appkey
      account: "", // 请填写你的account
      token: "", // 请填写你的token
    });
  },
};
</script>

<style>
.app-container {
  height: 100vh;
  width: 100vw;
  box-sizing: border-box;
  background-image: url("./assets/bg.png");
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}
</style>
