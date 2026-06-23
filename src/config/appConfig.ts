type AppEnvKey =
  | "VITE_NIM_LOGIN_MODE"
  | "VITE_NIM_APP_KEY"
  | "VITE_NIM_ACCOUNT"
  | "VITE_NIM_TOKEN"
  | "VITE_NIM_SMS_API_BASE_URL";

const readEnv = (key: AppEnvKey) => {
  return (import.meta.env[key] || "").trim();
};

export const appConfig = {
  loginMode: readEnv("VITE_NIM_LOGIN_MODE") || "fixed",
  appKey: readEnv("VITE_NIM_APP_KEY"),
  account: readEnv("VITE_NIM_ACCOUNT"),
  token: readEnv("VITE_NIM_TOKEN"),
};

export const isFixedLoginMode = appConfig.loginMode === "fixed";

export const FIXED_LOGIN_APP_KEY_STORAGE_KEY = "fixedLoginAppKey";

export const getSmsApiBaseUrl = () => readEnv("VITE_NIM_SMS_API_BASE_URL");

export const getMissingFixedLoginFields = () => {
  const missingFields: string[] = [];

  if (!appConfig.appKey) {
    missingFields.push("VITE_NIM_APP_KEY");
  }

  if (!appConfig.account) {
    missingFields.push("VITE_NIM_ACCOUNT");
  }

  if (!appConfig.token) {
    missingFields.push("VITE_NIM_TOKEN");
  }

  return missingFields;
};

export const getMissingSmsLoginFields = () => {
  const missingFields: string[] = [];

  if (!appConfig.appKey) {
    missingFields.push("VITE_NIM_APP_KEY");
  }

  if (!getSmsApiBaseUrl()) {
    missingFields.push("VITE_NIM_SMS_API_BASE_URL");
  }

  return missingFields;
};
