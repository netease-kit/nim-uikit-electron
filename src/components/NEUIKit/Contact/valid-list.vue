<template>
  <div class="valid-list-container">
    <div class="valid-list-content">
      <Empty
        v-if="validMsg.length === 0"
        :text="t('validEmptyText')"
        :emptyStyle="{
          marginTop: '100px',
        }"
      />
      <template v-else>
        <div class="valid-item" v-for="msg in validMsg" :key="msg.timestamp">
          <!-- 好友申请 已同意/已拒绝 -->
          <template
            v-if="
              msg.status ===
                V2NIMConst.V2NIMFriendAddApplicationStatus
                  .V2NIM_FRIEND_ADD_APPLICATION_STATUS_AGREED ||
              msg.status ===
                V2NIMConst.V2NIMFriendAddApplicationStatus
                  .V2NIM_FRIEND_ADD_APPLICATION_STATUS_REJECTED
            "
          >
            <div class="valid-item-left">
              <Avatar :account="getDisplayAccountId(msg)" />
              <div class="valid-name-container">
                <div class="valid-name">
                  <Appellation :account="getDisplayAccountId(msg)" />
                </div>
                <div class="valid-action">
                  {{ getStatusActionText(msg) }}
                </div>
              </div>
            </div>
            <div class="valid-state" v-if="getStatusConfig(msg).showState">
              <Icon :type="getStatusConfig(msg).icon" />
              <span class="valid-state-text">{{
                getStatusConfig(msg).text
              }}</span>
            </div>
          </template>
          <!-- 好友申请 未处理 -->
          <template
            v-else-if="
              msg.status ===
              V2NIMConst.V2NIMFriendAddApplicationStatus
                .V2NIM_FRIEND_ADD_APPLICATION_STATUS_INIT
            "
          >
            <template v-if="!isMeApplicant(msg)">
              <div class="valid-item-left">
                <Avatar :account="msg.applicantAccountId" />
                <div class="valid-name-container">
                  <div class="valid-name">
                    <Appellation :account="msg.applicantAccountId" />
                  </div>
                  <div class="valid-action">
                    {{ t("applyFriendText") }}
                  </div>
                </div>
              </div>
              <div class="valid-buttons">
                <div
                  class="valid-button button-reject"
                  @click="handleRejectApplyFriendClick(msg)"
                  :loading="applyFriendLoading"
                >
                  {{ t("rejectText") }}
                </div>
                <div
                  class="valid-button button-accept"
                  @click="handleAcceptApplyFriendClick(msg)"
                  :loading="applyFriendLoading"
                >
                  {{ t("acceptText") }}
                </div>
              </div>
            </template>
          </template>
        </div>
      </template>
    </div>
  </div>
</template>

<script lang="ts" setup>
/** 验证消息页面 */
import { autorun } from "mobx";
import { onUnmounted, ref } from "vue";
import Empty from "../CommonComponents/Empty.vue";
import Avatar from "../CommonComponents/Avatar.vue";
import Icon from "../CommonComponents/Icon.vue";
import { t } from "../utils/i18n";
import type { V2NIMFriendAddApplicationForUI } from "@components/NEUIKit/store/types";
import { V2NIMConst } from "../utils/constants";
import Appellation from "../CommonComponents/Appellation.vue";
import type { V2NIMMessage } from "node-nim/types/v2_def/v2_nim_struct_def";
import { toast } from "../utils/toast";
import { getContextState } from "../utils/init";

const { store, nim } = getContextState();

const validMsg = ref<V2NIMFriendAddApplicationForUI[]>([]);
const applyFriendLoading = ref(false);

/** 是否是我发起的申请 */
const isMeApplicant = (data: V2NIMFriendAddApplicationForUI) => {
  return data.applicantAccountId === store?.userStore.myUserInfo.accountId;
};

/** 获取要显示的账号ID（根据是否自己发起来决定显示申请人还是接收人） */
const getDisplayAccountId = (msg: V2NIMFriendAddApplicationForUI) => {
  return isMeApplicant(msg) ? msg.recipientAccountId : msg.applicantAccountId;
};

/** 获取已同意状态的文案 */
const getAgreedActionText = (msg: V2NIMFriendAddApplicationForUI) => {
  return isMeApplicant(msg) ? t("applyFriendText") : t("passResultText");
};

/** 获取已拒绝状态的文案 */
const getRejectedActionText = (msg: V2NIMFriendAddApplicationForUI) => {
  return isMeApplicant(msg) ? t("beRejectResultText") : t("applyFriendText");
};

/** 获取状态操作文案（统一处理已同意/已拒绝） */
const getStatusActionText = (msg: V2NIMFriendAddApplicationForUI) => {
  const isAgreed =
    msg.status ===
    V2NIMConst.V2NIMFriendAddApplicationStatus
      .V2NIM_FRIEND_ADD_APPLICATION_STATUS_AGREED;
  return isAgreed ? getAgreedActionText(msg) : getRejectedActionText(msg);
};

/** 获取状态配置（图标、文案、是否显示状态） */
const getStatusConfig = (msg: V2NIMFriendAddApplicationForUI) => {
  if (
    msg.status ===
    V2NIMConst.V2NIMFriendAddApplicationStatus
      .V2NIM_FRIEND_ADD_APPLICATION_STATUS_AGREED
  ) {
    return {
      icon: "icon-yidu",
      text: t("acceptResultText"),
      showState: true,
    };
  }

  if (
    msg.status ===
    V2NIMConst.V2NIMFriendAddApplicationStatus
      .V2NIM_FRIEND_ADD_APPLICATION_STATUS_REJECTED
  ) {
    return {
      icon: "icon-shandiao",
      text: t("rejectResultText"),
      showState: !isMeApplicant(msg),
    };
  }

  return {
    icon: "",
    text: "",
    showState: false,
  };
};

/** 拒绝好友申请 */
const handleRejectApplyFriendClick = async (
  msg: V2NIMFriendAddApplicationForUI,
) => {
  applyFriendLoading.value = true;
  try {
    await store?.friendStore.rejectAddApplicationActive(msg);
    toast.info(t("rejectedText"));
  } catch {
    toast.info(t("rejectFailedText"));
  } finally {
    applyFriendLoading.value = false;
  }
};

/** 接受好友申请 */
const handleAcceptApplyFriendClick = async (
  msg: V2NIMFriendAddApplicationForUI,
) => {
  applyFriendLoading.value = true;
  try {
    try {
      await store?.friendStore.acceptAddApplicationActive(msg);
      toast.success(t("acceptedText"));
    } catch {
      toast.info(t("acceptFailedText"));
    }

    const textMsg = nim?.messageCreator?.createTextMessage(
      t("passFriendAskText"),
    ) as unknown as V2NIMMessage;

    await store?.msgStore.sendMessageActive({
      msg: textMsg,
      conversationId: nim?.conversationIdUtil?.p2pConversationId(
        msg.operatorAccountId || "",
      ) as string,
    });
  } catch (error) {
    console.log("error", error);
  } finally {
    applyFriendLoading.value = false;
  }
};

/** 监听验证消息 */
const validMsgWatch = autorun(() => {
  validMsg.value = (store?.sysMsgStore.friendApplyMsgs || []).sort();
  store?.sysMsgStore.friendApplyMsgs?.map((item) => {
    store?.userStore.getUserActive(item.applicantAccountId);
  });
});

onUnmounted(() => {
  validMsgWatch();
});
</script>

<style scoped>
.valid-list-container {
  height: 100%;
  overflow: auto;
}

.valid-list-content {
  padding: 0;
}

.valid-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 60px;
  padding: 0 20px;
  border-bottom: 1px solid #f5f8fc;
  transition: background-color 0.2s ease;
}

.valid-item:hover {
  background-color: #f8f9fa;
}

.valid-item:last-child {
  border-bottom: none;
}

.valid-name-container {
  display: flex;
  flex-direction: column;
  margin-left: 10px;
  flex: 1;
  padding-right: 20px;
}

.valid-name {
  font-size: 16px;
  color: #000;
  max-width: 35vw;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.valid-action {
  color: #888;
  font-size: 14px;
  max-width: 40vw;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.valid-item-left {
  display: flex;
  align-items: center;
}

.valid-buttons {
  display: flex;
  align-items: center;
}

.valid-button {
  margin: 0;
  width: 60px;
  height: 32px;
  line-height: 32px;
  font-size: 14px;
  text-align: center;
  border-radius: 3px;
  background-color: #fff;
  cursor: pointer;
  transition: all 0.2s ease;
}

.button-reject {
  color: #000;
  border: 1px solid #d9d9d9;
  margin-right: 10px;
}

.button-accept {
  color: #337eef;
  border: 1px solid #337eef;
}

.button-accept:hover {
  background-color: #337eef;
  color: #fff;
}

.button-reject:hover {
  background-color: #f5f5f5;
}

.valid-state {
  display: flex;
  align-items: center;
}

.valid-state-text {
  margin-left: 10px;
  color: #000;
}
</style>
