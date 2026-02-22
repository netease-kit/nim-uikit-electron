<template>
  <div class="search-container-wrapper">
    <div class="search-input-wrapper" @click="searchModalVisible = true">
      <div class="search-icon-wrapper">
        <Icon iconClassName="search-icon" :size="14" color="#A6ADB6" type="icon-sousuo"></Icon>
        <div class="search-title">{{ t("searchTitleText") }}</div>
      </div>
    </div>
    <Add @goChat="emit('goChat')" />
    <SearchModal
      v-if="searchModalVisible"
      :visible="searchModalVisible"
      @close="searchModalVisible = false"
      @goChat="emit('goChat')"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import Icon from "../CommonComponents/Icon.vue";
import Add from "./add/index.vue";
import { t } from "../utils/i18n";
import SearchModal from "./search-modal.vue";
import { showToast } from "../utils/toast";
import { useRouter } from "vue-router";
import { getContextState } from "../utils/init";
import storageManager from "../utils/storage";

const searchModalVisible = ref(false);
const { store, nim } = getContextState();

const router = useRouter();

const handelKickedOffline = async () => {
  showToast({
    message: "您已被踢下线",
    type: "info",
  });

  await storageManager.clearLoginInfo();
  router.push("/login");
  store?.destroy();
  nim?.loginService?.off("kickedOffline", handelKickedOffline);
};

const emit = defineEmits<{
  goChat: [];
}>();

onMounted(() => {
  nim?.loginService?.on("kickedOffline", handelKickedOffline);
});

onUnmounted(() => {
  nim?.loginService?.off("kickedOffline", handelKickedOffline);
});
</script>

<style scoped>
.search-container-wrapper {
  width: 100%;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  user-select: none;
}

.search-input-wrapper {
  width: 100%;
  padding: 8px 0;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  font-size: 14px;
  color: #b3b7bc;
  background: #fff;
  border-radius: 4px;
  cursor: pointer;
}

.search-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-title {
  margin-left: 5px;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 14px;
  color: #333;
}

.search-input::placeholder {
  color: #a6adb6;
}

.dropdown-menu {
  min-width: 120px;
  padding: 4px 0;
}

.dropdown-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  gap: 8px;
}

.dropdown-item:hover {
  background-color: #f5f5f5;
}

.menu-text {
  font-size: 14px;
  color: #333;
}
</style>
