<template>
  <div class="avatar" :style="{ width: avatarSize + 'px', height: avatarSize + 'px' }">
    <div class="img-mask"></div>
    <img
      :lazy-load="true"
      class="avatar-img"
      v-if="displayAvatarUrl"
      :src="displayAvatarUrl"
      mode="aspectFill"
    />
    <div class="avatar-name-wrapper" :style="{ backgroundColor: color }">
      <div class="avatar-name-text" :style="{ fontSize: fontSize + 'px' }">
        {{ appellation }}
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { getAvatarBackgroundColor } from "../utils";
import { autorun } from "mobx";
import { ref, computed, onUnmounted, watch } from "vue";
import type { V2NIMUser } from "node-nim/types/v2_def/v2_nim_struct_def";
import { getContextState } from "../utils/init";
import { getCachedAvatarUrl } from "../utils/avatar-cache";

const props = withDefaults(
  defineProps<{
    account: string;
    teamId?: string;
    avatar?: string;
    size?: string;
    fontSize?: string;
    isRedirect?: boolean;
  }>(),
  {
    teamId: "",
    avatar: "",
    size: "",
    gotoUserCard: false,
    fontSize: "12",
    isRedirect: false,
  }
);

const { store } = getContextState();

const avatarSize = props.size || 42;
const user = ref<V2NIMUser>();
const appellation = ref();

/** 本地缓存的头像路径 */
const localAvatarPath = ref<string | null>(null);

const uninstallUserInfoWatch = autorun(async () => {
  if (props.account) {
    store?.userStore?.getUserActive(props.account).then((data) => {
      user.value = data;
    });
  }
  appellation.value = store?.uiStore
    .getAppellation({
      account: props.account,
      teamId: props.teamId,
      ignoreAlias: true,
    })
    .slice(-2);
});

/** 原始头像 URL（远程） */
const avatarUrl = computed(() => {
  if (props.account) {
    user.value = store?.userStore?.users?.get(props.account);
  }
  return props.avatar || user.value?.avatar;
});

/** 实际显示的头像 URL（优先使用本地缓存） */
const displayAvatarUrl = computed(() => {
  return localAvatarPath.value || null;
});

const color = computed(() => {
  return getAvatarBackgroundColor(props.account);
});

/**
 * 监听原始头像 URL 变化，触发缓存获取
 */
watch(
  avatarUrl,
  async (newUrl) => {
    if (!newUrl) {
      localAvatarPath.value = null;
      return;
    }

    try {
      const cachedUrl = await getCachedAvatarUrl(newUrl);
      // 确保 URL 没有在获取过程中改变
      if (avatarUrl.value === newUrl) {
        localAvatarPath.value = cachedUrl;
      }
    } catch {
      // 缓存获取失败，保持显示占位符
      localAvatarPath.value = null;
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  uninstallUserInfoWatch();
});
</script>

<style scoped>
.avatar {
  overflow: hidden;
  border-radius: 50%;
  flex-shrink: 0;
  position: relative;
}

.img-mask {
  position: absolute;
  z-index: 10;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  opacity: 0;
}

.avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.avatar-name-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-name-text {
  color: #fff;
  font-size: 14px;
}
</style>
