/**
 * 主进程国际化工具
 * @description 由于主进程无法直接访问渲染进程的 locale store，需要独立实现
 */

// 定义支持的语言类型
export type Language = "zh-Hans" | "en";

// 当前语言，默认为中文
let currentLanguage: Language = "zh-Hans";

// 国际化文本定义
const translations = {
  "zh-Hans": {
    trayShowWindowText: "显示窗口",
    trayAboutText: "关于",
    trayQuitText: "退出",
    trayUnreadMessagesText: "未读消息",
    trayNoUnreadMessagesText: "无未读消息",
    trayTooltipText: "云信 IM",
  },
  en: {
    trayShowWindowText: "Show Window",
    trayAboutText: "About",
    trayQuitText: "Quit",
    trayUnreadMessagesText: "Unread Messages",
    trayNoUnreadMessagesText: "No Unread Messages",
    trayTooltipText: "Netease NIM",
  },
};

/**
 * 设置当前语言
 * @param language 语言代码
 */
export function setLanguage(language: Language): void {
  if (language in translations) {
    currentLanguage = language;
  }
}

/**
 * 获取当前语言
 */
export function getLanguage(): Language {
  return currentLanguage;
}

/**
 * 获取翻译文本
 * @param key 翻译键
 */
export function t(key: keyof typeof translations["zh-Hans"]): string {
  return translations[currentLanguage][key] || key;
}

/**
 * 获取所有翻译文本（用于一次性获取）
 */
export function getTranslations() {
  return translations[currentLanguage];
}
