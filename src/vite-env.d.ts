/// <reference types="vite/client" />
declare module "vue-virtual-scroller";

interface ImportMetaEnv {
  readonly VITE_NIM_LOGIN_MODE?: string;
  readonly VITE_NIM_APP_KEY?: string;
  readonly VITE_NIM_ACCOUNT?: string;
  readonly VITE_NIM_TOKEN?: string;
  readonly VITE_NIM_SMS_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
