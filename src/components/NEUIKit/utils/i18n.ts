import en from "../locale/en";
import zh from "../locale/zh-Hans";
import { updateLanguage } from "./electron";

const i18nData: any = {
  en,
  zh,
};

let currentLanguage: string = "zh";

export function setLanguage(language: string) {
  currentLanguage = language;

  // 同步语言到主进程（托盘菜单国际化）
  const mainProcessLanguage = language === "zh" ? "zh-Hans" : "en";
  updateLanguage(mainProcessLanguage);
}

export const t = (key: string, params?: Record<string, any>) => {
  let text = i18nData[currentLanguage][key] || key;

  // 如果有参数，进行模板替换
  if (params && typeof text === "string") {
    Object.keys(params).forEach((paramKey) => {
      const placeholder = `{${paramKey}}`;
      text = text.replace(new RegExp(placeholder, "g"), params[paramKey]);
    });
  }

  return text;
};
