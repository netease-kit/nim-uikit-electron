<template>
  <!-- 聊天头部导航栏容器 -->
  <div class="nav-bar-wrapper">
    <!-- 头像区域: 单聊时可点击查看用户名片，群聊时不可点击 -->
    <div
      :key="to"
      :style="{
        cursor:
          props.conversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P
            ? 'pointer'
            : '',
      }"
      @click="onAvatarClick"
    >
      <!-- 
        头像组件
        - headerUpdateTime 作为 key 确保当前对话方资料更新时头像能重新渲染
        - to: 用户账号ID或群组ID
        - avatar: 头像URL
      -->
      <Avatar size="36" :account="to" :avatar="avatar" :key="headerUpdateTime" />
    </div>

    <!-- 标题信息区域: 显示聊天对象名称和副标题(如在线状态、群成员数等) -->
    <div class="title-container">
      <!-- 主标题: 显示用户昵称/备注名或群名称 -->
      <div class="title">{{ title }}</div>
      <!-- 副标题: 显示在线状态、群成员数等附加信息 -->
      <div class="subTitle" v-if="subTitle">{{ subTitle }}</div>
      <!-- 图标插槽: 用于在标题右侧插入自定义图标(如静音、置顶等标识) -->
      <slot name="icon"></slot>
    </div>

    <!-- 右侧操作区域插槽: 用于插入自定义操作按钮(如音视频通话、更多操作等) -->
    <div>
      <slot name="right"></slot>
    </div>

    <!-- 用户名片弹窗: 单聊时点击头像展示对方用户信息 -->
    <UserCardModal
      v-if="showUserCardModal"
      :visible="showUserCardModal"
      :account="to"
      :nick="title"
      @close="handleCloseModal"
    />
  </div>
</template>

<script lang="ts" setup>
/**
 * 聊天头部组件
 * 功能:
 * 1. 显示聊天对象的头像、名称和状态信息
 * 2. 单聊时支持点击头像查看用户名片
 * 3. 提供插槽供外部自定义图标和右侧操作按钮
 */
import { ref } from "vue";
import Avatar from "../../CommonComponents/Avatar.vue";
import UserCardModal from "../../CommonComponents/UserCardModal.vue";
import { V2NIMConst } from "../../utils/constants";
import type { V2NIMConversationType } from "node-nim";

/**
 * 组件属性定义
 * @property {string} title - 主标题(用户昵称/备注名或群名称)
 * @property {string} subTitle - 副标题(在线状态、群成员数等)
 * @property {string} backgroundColor - 背景颜色(预留属性,暂未使用)
 * @property {string} to - 对话方ID(用户账号ID或群组ID)
 * @property {string} avatar - 头像URL
 * @property {V2NIMConversationType} conversationType - 会话类型(单聊/群聊/超大群等)
 * @property {number} headerUpdateTime - 头部更新时间戳,用于触发头像重新渲染
 */
const props = withDefaults(
  defineProps<{
    title: string;
    subTitle?: string;
    backgroundColor?: string;
    to: string;
    avatar?: string;
    conversationType: V2NIMConversationType;
    headerUpdateTime?: number;
  }>(),
  {
    subTitle: "",
    backgroundColor: "",
  }
);

/** 控制用户名片弹窗的显示状态 */
const showUserCardModal = ref(false);

/**
 * 头像点击事件处理
 * 仅在单聊(P2P)会话时打开用户名片弹窗
 * 群聊会话不响应点击事件
 */
const onAvatarClick = () => {
  if (props.conversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P) {
    showUserCardModal.value = true;
  }
};

/**
 * 关闭用户名片弹窗
 */
const handleCloseModal = () => {
  showUserCardModal.value = false;
};
</script>

<style scoped>
/* 导航栏容器 */
.nav-bar-wrapper {
  display: flex;
  padding: 10px;
  z-index: 9999;
  color: #000;
  font-size: 16px;
  border-bottom: 1px solid #dbe0e8;
  background-color: #f6f8fa;
  height: 60px;
  align-items: center;
}

/* 标题容器 */
.title-container {
  margin-left: 10px;
  width: 500px;
  display: flex;
  align-items: center;
  text-align: left;
}

/* 主标题 */
.title {
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  white-space: nowrap;
  font-weight: 500;
  font-size: 16px;
}

/* 副标题 */
.subTitle {
  white-space: nowrap;
  color: #999999;
}
</style>
