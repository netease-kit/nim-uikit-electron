import { createRouter, createWebHashHistory } from "vue-router";

// 创建路由实例
const router = createRouter({
  // 使用 hash 模式的路由
  history: createWebHashHistory(),
  routes: [
    {
      // 根路径重定向到登录页，避免初始路由为 "/" 时找不到匹配
      path: "/",
      redirect: "/chat",
    },
    {
      // 聊天页面路由
      path: "/chat",
      name: "Chat",
      component: () => import("../views/chat/IM.vue"),
    },
    {
      // 登录页面
      path: "/login",
      name: "Login",
      component: () => import("../views/login/LoginPage.vue"),
    },
    {
      // 兜底：所有未匹配的路径跳到登录页
      path: "/:pathMatch(.*)*",
      redirect: "/login",
    },
  ],
});

export default router;
