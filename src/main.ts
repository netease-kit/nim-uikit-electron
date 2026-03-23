import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "./assets/main.css";
import VueVirtualScroller from "vue-virtual-scroller";

const initApp = async () => {
  try {
    const app = createApp(App);

    // 全局 Vue 错误处理，防止未捕获异常导致白屏
    app.config.errorHandler = (err, instance, info) => {
      console.error("[Vue Global Error]", err, "\nComponent:", instance, "\nInfo:", info);
    };

    app.use(router);
    app.use(VueVirtualScroller);
    app.mount("#app");
  } catch (error) {
    console.error("Application initialization failed:", error);
  }
};

// 捕获未处理的 Promise rejection，防止渲染进程崩溃白屏
window.addEventListener("unhandledrejection", (event) => {
  console.error("[Unhandled Rejection]", event.reason);
  event.preventDefault();
});

// 捕获未捕获的全局错误
window.onerror = (message, source, lineno, colno, error) => {
  console.error("[Global Error]", message, source, lineno, colno, error);
  return true; // 阻止默认处理
};

initApp();
