<template>
  <div v-if="showUiKit" class="app-container">
    <router-view></router-view>
  </div>
</template>

<script lang="ts">
import { initIMUIKit, releaseIMUIKit } from "./components/NEUIKit/utils/init";
import { showToast } from "./components/NEUIKit/utils/toast";
import AboutModal from "./components/NEUIKit/CommonComponents/AboutModal.vue";
import storageManager from "./components/NEUIKit/utils/storage";

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
    async init(opts: { appkey: string; account: string; token: string }) {
      const { nim } = await initIMUIKit(opts.appkey);

      nim?.loginService
        ?.login(opts.account, opts.token, {})
        .then(() => {
          this.$router.push("/chat");
          this.showUiKit = true;
        })
        .catch(async (error) => {
          if (error.code === 102422) {
            showToast({
              message: "当前账号已被封禁",
              type: "info",
            });
          }
          await storageManager.clearLoginInfo();
          this.$router.push("/login");
        });
    },
  },
  async mounted() {
    this.init({
      appkey: "", //您在云信控制台注册的appkey
      account: "", //云信控制台上的account
      token: "",
    });
  },
  beforeUnmount() {
    // 移除事件监听器
    window.removeEventListener("beforeunload", () => {
      releaseIMUIKit();
    });

    if (window.electronAPI) {
      window.electronAPI.navigation.removeNavigateToAboutListener();
    }
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
