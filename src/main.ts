import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "./assets/main.css";
import VueVirtualScroller from 'vue-virtual-scroller'

const initApp = async () => {
  try {
    const app = createApp(App);
    app.use(router);
    app.use(VueVirtualScroller)
    app.mount("#app");
  } catch (error) {
    console.error("Application initialization failed:", error);
  }
};

initApp();

