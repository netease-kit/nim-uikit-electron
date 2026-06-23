<template>
  <div class="fixed-login-form">
    <div class="fixed-login-title">{{ t("fixedLoginTitleText") }}</div>
    <div class="fixed-login-desc">{{ t("fixedLoginFormDescText") }}</div>

    <div class="fixed-login-fields">
      <label class="fixed-login-field">
        <span>{{ t("appKeyText") }}</span>
        <Input
          v-model="loginForm.appKey"
          :input-wrapper-style="inputWrapperStyle"
          :input-style="inputStyle"
          :placeholder="t('appKeyPlaceholderText')"
          @confirm="submitLoginForm"
        />
      </label>
      <label class="fixed-login-field">
        <span>{{ t("accountText") }}</span>
        <Input
          v-model="loginForm.account"
          :input-wrapper-style="inputWrapperStyle"
          :input-style="inputStyle"
          :placeholder="t('accountPlaceholderText')"
          @confirm="submitLoginForm"
        />
      </label>
      <label class="fixed-login-field">
        <span>{{ t("tokenText") }}</span>
        <Input
          v-model="loginForm.token"
          :type="showToken ? 'text' : 'password'"
          :input-wrapper-style="inputWrapperStyle"
          :input-style="inputStyle"
          :placeholder="t('tokenPlaceholderText')"
          @confirm="submitLoginForm"
        >
          <template #suffix>
            <button
              class="token-visibility-btn"
              type="button"
              :aria-label="showToken ? t('hideTokenText') : t('showTokenText')"
              :title="showToken ? t('hideTokenText') : t('showTokenText')"
              @click="showToken = !showToken"
            >
              <svg
                v-if="showToken"
                class="token-visibility-icon"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M3.3 2.3 21.7 20.7"
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                />
                <path
                  d="M10.6 5.1A8.8 8.8 0 0 1 12 5c5.1 0 8.4 4.6 9.4 6.3.2.4.2.9 0 1.3a17.5 17.5 0 0 1-2.6 3.2"
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                />
                <path
                  d="M6.5 6.9a16.4 16.4 0 0 0-3.9 4.4c-.2.4-.2.9 0 1.3C3.6 14.4 6.9 19 12 19c1.4 0 2.7-.3 3.8-.9"
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                />
                <path
                  d="M9.9 9.9a3 3 0 0 0 4.2 4.2"
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                />
              </svg>
              <svg
                v-else
                class="token-visibility-icon"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M2.6 11.4C3.6 9.6 6.9 5 12 5s8.4 4.6 9.4 6.4c.2.4.2.8 0 1.2C20.4 14.4 17.1 19 12 19s-8.4-4.6-9.4-6.4a1.3 1.3 0 0 1 0-1.2Z"
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="3"
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                />
              </svg>
            </button>
          </template>
        </Input>
      </label>
    </div>

    <div v-if="missingFields.length > 0" class="fixed-login-alert">
      {{ t("fixedLoginMissingFieldsText", { fields: missingFields.join("、") }) }}
    </div>

    <Button
      type="primary"
      :custom-style="loginButtonStyle"
      :disabled="isLoginDisabled"
      @click="submitLoginForm"
    >
      {{ t("loginText") }}
    </Button>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import Button from "../../CommonComponents/Button.vue";
import Input from "../../CommonComponents/Input.vue";
import { initIMUIKit } from "../../utils/init";
import { t } from "../../utils/i18n";
import storageManager from "../../utils/storage";
import { showToast } from "../../utils/toast";
import { appConfig, FIXED_LOGIN_APP_KEY_STORAGE_KEY } from "../../../../config/appConfig";

const router = useRouter();
const showToken = ref(false);
const isLoggingIn = ref(false);

const loginForm = reactive({
  appKey: appConfig.appKey,
  account: appConfig.account,
  token: appConfig.token,
});

const inputWrapperStyle = {
  height: "40px",
  backgroundColor: "#fff",
  border: "1px solid #dcdfe6",
  borderRadius: "4px",
  boxSizing: "border-box",
};

const inputStyle = {
  padding: "0 12px",
};

const loginButtonStyle = {
  display: "flex",
  height: "40px",
  minHeight: "40px",
  marginTop: "16px",
  padding: "0 15px",
  width: "100%",
};

onMounted(async () => {
  const [savedAppKey, savedLoginInfo] = await Promise.all([
    storageManager.getItemAsync(FIXED_LOGIN_APP_KEY_STORAGE_KEY),
    storageManager.getLoginInfo(),
  ]);

  if (!loginForm.appKey && savedAppKey) {
    loginForm.appKey = savedAppKey;
  }

  if (!loginForm.account && savedLoginInfo?.account) {
    loginForm.account = savedLoginInfo.account;
  }

  if (!loginForm.token && savedLoginInfo?.token) {
    loginForm.token = savedLoginInfo.token;
  }
});

const missingFields = computed(() => {
  const fields: string[] = [];

  if (!loginForm.appKey.trim()) {
    fields.push(t("appKeyText"));
  }

  if (!loginForm.account.trim()) {
    fields.push(t("accountText"));
  }

  if (!loginForm.token.trim()) {
    fields.push(t("tokenText"));
  }

  return fields;
});

const isLoginDisabled = computed(() => isLoggingIn.value || missingFields.value.length > 0);

const submitLoginForm = async () => {
  if (isLoginDisabled.value) {
    return;
  }

  isLoggingIn.value = true;

  const account = loginForm.account.trim();
  const token = loginForm.token.trim();

  try {
    const { nim } = await initIMUIKit(loginForm.appKey.trim());
    if (!nim?.loginService) {
      throw new Error(t("loginFailMsg"));
    }

    await nim.loginService.login(account, token, {});
    await storageManager.setItem(FIXED_LOGIN_APP_KEY_STORAGE_KEY, loginForm.appKey.trim());
    await storageManager.saveLoginInfo(account, token);
    router.push("/chat");
  } catch (error: any) {
    if (error?.code === 102422) {
      showToast({
        message: t("accountBannedText"),
        type: "info",
      });
      return;
    }

    showToast({
      message: error?.message || t("loginFailMsg"),
      type: "info",
    });
  } finally {
    isLoggingIn.value = false;
  }
};
</script>

<style scoped>
.fixed-login-form {
  display: flex;
  flex-direction: column;
  height: 100%;
  justify-content: center;
  margin: 0 auto;
  max-width: 360px;
  width: 100%;
}

.fixed-login-title {
  color: #1f2329;
  font-size: 21px;
  font-weight: 600;
  line-height: 29px;
  text-align: center;
}

.fixed-login-desc {
  color: #646a73;
  font-size: 14px;
  line-height: 22px;
  margin: 8px 0 24px;
  text-align: center;
}

.fixed-login-fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.fixed-login-field {
  color: #1f2329;
  display: flex;
  flex-direction: column;
  font-size: 14px;
  gap: 8px;
  line-height: 20px;
}

.token-visibility-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  width: 28px;
  border: 0;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
}

.token-visibility-icon {
  display: block;
  height: 18px;
  width: 18px;
}

.fixed-login-alert {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 8px;
  box-sizing: border-box;
  color: #9a3412;
  font-size: 13px;
  line-height: 19px;
  margin-top: 16px;
  padding: 10px 12px;
}
</style>
