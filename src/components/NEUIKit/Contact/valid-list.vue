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
          <!-- 群验证消息 -->
          <template v-if="isTeamMsg(msg)">
            <!-- 已处理 (通知类 或 状态非初始) -->
            <template v-if="isTeamMsgHandled(msg)">
              <div class="valid-item-left">
                <Avatar :account="getTeamDisplayAccountId(msg)" />
                <div class="valid-name-container">
                  <div class="valid-name">
                    <Appellation :account="getTeamDisplayAccountId(msg)" />
                  </div>
                  <div class="valid-action">
                    <span>{{ getTeamActionPrefix(msg) }}</span
                    >&nbsp;
                    <strong>{{ getTeamName(msg) }}</strong>
                  </div>
                </div>
              </div>
              <div class="valid-state" v-if="getTeamValidationState(msg).showState">
                <Icon :type="getTeamValidationState(msg).icon" />
                <span class="valid-state-text">{{ getTeamValidationState(msg).text }}</span>
              </div>
            </template>
            <!-- 未处理 (申请/邀请 且 初始状态) -->
            <template v-else>
              <div class="valid-item-left">
                <Avatar :account="getTeamDisplayAccountId(msg)" />
                <div class="valid-name-container">
                  <div class="valid-name">
                    <Appellation :account="getTeamDisplayAccountId(msg)" />
                  </div>
                  <div class="valid-action">
                    <span>{{ getTeamActionPrefix(msg) }}</span
                    >&nbsp;
                    <strong>{{ getTeamName(msg) }}</strong>
                  </div>
                </div>
              </div>
              <div class="valid-buttons">
                <div
                  class="valid-button button-reject"
                  @click="handleRejectTeamClick(msg)"
                  :loading="applyFriendLoading"
                >
                  {{ t("rejectText") }}
                </div>
                <div
                  class="valid-button button-accept"
                  @click="handleAcceptTeamClick(msg)"
                  :loading="applyFriendLoading"
                >
                  {{ t("acceptText") }}
                </div>
              </div>
            </template>
          </template>

          <!-- 好友验证消息 -->
          <template v-else>
            <!-- 已处理 -->
            <template v-if="isFriendMsgHandled(msg)">
              <div class="valid-item-left">
                <Avatar :account="getFriendDisplayAccountId(msg)" />
                <div class="valid-name-container">
                  <div class="valid-name">
                    <Appellation :account="getFriendDisplayAccountId(msg)" />
                  </div>
                  <div class="valid-action">
                    {{ getFriendActionText(msg) }}
                  </div>
                </div>
              </div>
              <div class="valid-state" v-if="getFriendValidationState(msg).showState">
                <Icon :type="getFriendValidationState(msg).icon" />
                <span class="valid-state-text">{{ getFriendValidationState(msg).text }}</span>
              </div>
            </template>
            <!-- 未处理 -->
            <template v-else>
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
import type {
  V2NIMFriendAddApplicationForUI,
  V2NIMTeamJoinActionInfoForUI,
} from "@components/NEUIKit/store/types";
import { V2NIMConst } from "../utils/constants";
import Appellation from "../CommonComponents/Appellation.vue";
import type { V2NIMMessage } from "node-nim/types/v2_def/v2_nim_struct_def";
import { toast } from "../utils/toast";
import { getContextState } from "../utils/init";

const { store, nim } = getContextState();

const validMsg = ref<(V2NIMFriendAddApplicationForUI | V2NIMTeamJoinActionInfoForUI)[]>([]);
const applyFriendLoading = ref(false);

const isTeamMsg = (
  msg: V2NIMFriendAddApplicationForUI | V2NIMTeamJoinActionInfoForUI
): msg is V2NIMTeamJoinActionInfoForUI => {
  return "teamId" in msg;
};

/** 是否是我发起的申请 */
const isMeApplicant = (data: V2NIMFriendAddApplicationForUI) => {
  return data.applicantAccountId === store?.userStore.myUserInfo.accountId;
};

const isTeamMsgHandled = (msg: V2NIMTeamJoinActionInfoForUI) => {
  // 1. 如果 actionType 本身就是通知类（终态），则视为已处理
  if (
    msg.actionType ===
      V2NIMConst.V2NIMTeamJoinActionType.V2NIM_TEAM_JOIN_ACTION_TYPE_REJECT_APPLICATION ||
    msg.actionType ===
      V2NIMConst.V2NIMTeamJoinActionType.V2NIM_TEAM_JOIN_ACTION_TYPE_REJECT_INVITATION
  ) {
    return true;
  }

  // 2. 对于申请(0)或邀请(2)，只有状态不为 INIT (0) 时才视为已处理
  return (
    msg.actionStatus !== V2NIMConst.V2NIMTeamJoinActionStatus.V2NIM_TEAM_JOIN_ACTION_STATUS_INIT
  );
};

const getTeamDisplayAccountId = (msg: V2NIMTeamJoinActionInfoForUI) => {
  return msg.operatorAccountId || "";
};

const getTeamValidationState = (msg: V2NIMTeamJoinActionInfoForUI) => {
  // 仅申请(0)和邀请(2)类型需要显示状态图标
  const isOperableType =
    msg.actionType === V2NIMConst.V2NIMTeamJoinActionType.V2NIM_TEAM_JOIN_ACTION_TYPE_APPLICATION ||
    msg.actionType === V2NIMConst.V2NIMTeamJoinActionType.V2NIM_TEAM_JOIN_ACTION_TYPE_INVITATION;

  if (!isOperableType) {
    return {
      icon: "",
      text: "",
      showState: false,
    };
  }

  const status = msg.actionStatus;
  const AGREED = V2NIMConst.V2NIMTeamJoinActionStatus.V2NIM_TEAM_JOIN_ACTION_STATUS_AGREED;
  const REJECTED = V2NIMConst.V2NIMTeamJoinActionStatus.V2NIM_TEAM_JOIN_ACTION_STATUS_REJECTED;
  const EXPIRED = V2NIMConst.V2NIMTeamJoinActionStatus.V2NIM_TEAM_JOIN_ACTION_STATUS_EXPIRED;

  if (status === AGREED) {
    return {
      icon: "icon-yidu",
      text: t("acceptResultText"),
      showState: true,
    };
  }

  if (status === REJECTED) {
    return {
      icon: "icon-shandiao",
      text: t("rejectResultText"),
      showState: true,
    };
  }

  if (status === EXPIRED) {
    return {
      icon: "icon-shandiao",
      text: t("expiredText"),
      showState: true,
    };
  }

  return {
    icon: "",
    text: "",
    showState: false,
  };
};

const isFriendMsgHandled = (msg: V2NIMFriendAddApplicationForUI) => {
  return (
    msg.status !==
    V2NIMConst.V2NIMFriendAddApplicationStatus.V2NIM_FRIEND_ADD_APPLICATION_STATUS_INIT
  );
};

const getFriendDisplayAccountId = (msg: V2NIMFriendAddApplicationForUI) => {
  return isMeApplicant(msg) ? msg.recipientAccountId : msg.applicantAccountId;
};

const getFriendActionText = (msg: V2NIMFriendAddApplicationForUI) => {
  const isAgreed =
    msg.status ===
    V2NIMConst.V2NIMFriendAddApplicationStatus.V2NIM_FRIEND_ADD_APPLICATION_STATUS_AGREED;
  return isAgreed
    ? isMeApplicant(msg)
      ? t("applyFriendText")
      : t("passResultText")
    : isMeApplicant(msg)
      ? t("beRejectResultText")
      : t("applyFriendText");
};

const getFriendValidationState = (msg: V2NIMFriendAddApplicationForUI) => {
  const status = msg.status;
  const AGREED =
    V2NIMConst.V2NIMFriendAddApplicationStatus.V2NIM_FRIEND_ADD_APPLICATION_STATUS_AGREED;
  const REJECTED =
    V2NIMConst.V2NIMFriendAddApplicationStatus.V2NIM_FRIEND_ADD_APPLICATION_STATUS_REJECTED;

  if (status === AGREED) {
    return {
      icon: "icon-yidu",
      text: t("acceptResultText"),
      showState: true,
    };
  }

  if (status === REJECTED) {
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

/** 获取群消息的前缀文案 (不包含群名) */
const getTeamActionPrefix = (msg: V2NIMTeamJoinActionInfoForUI) => {
  // 1. 处理通知类型的 actionType (直接显示对应的文案)
  if (
    msg.actionType ===
    V2NIMConst.V2NIMTeamJoinActionType.V2NIM_TEAM_JOIN_ACTION_TYPE_REJECT_APPLICATION
  ) {
    return t("rejectApplyText");
  }
  if (
    msg.actionType ===
    V2NIMConst.V2NIMTeamJoinActionType.V2NIM_TEAM_JOIN_ACTION_TYPE_REJECT_INVITATION
  ) {
    return t("rejectInviteText");
  }

  // 2. 对于申请(0)或邀请(2)，无论状态如何，始终显示"申请加入"或"邀请您加入"
  // 结果通过右侧的状态图标来展示
  if (
    msg.actionType === V2NIMConst.V2NIMTeamJoinActionType.V2NIM_TEAM_JOIN_ACTION_TYPE_APPLICATION
  ) {
    return t("applyTeamText");
  } else {
    return t("inviteTeamText");
  }
};

/** 获取群名称 */
const getTeamName = (msg: V2NIMTeamJoinActionInfoForUI) => {
  // 优先使用消息对象上的 teamName 字段
  if (msg.teamName) {
    return msg.teamName;
  }
  // 兜底返回 teamId
  return msg.teamId || "";
};

const handleTeamActionErrorCode = (
  code: number,
  msg: V2NIMTeamJoinActionInfoForUI,
  defaultTip: string
) => {
  switch (code) {
    case 109432:
      toast.error(t("noPermission"));
      break;
    case 109404:
      toast.error(t("processedValidationMessageText"));
      store?.sysMsgStore.updateTeamJoinActionMsg([
        {
          ...msg,
          actionStatus: V2NIMConst.V2NIMTeamJoinActionStatus.V2NIM_TEAM_JOIN_ACTION_STATUS_EXPIRED,
        },
      ]);
      break;
    case 108404:
      toast.error(t("teamNotExitsText"));
      store?.sysMsgStore.updateTeamJoinActionMsg([
        {
          ...msg,
          actionStatus: V2NIMConst.V2NIMTeamJoinActionStatus.V2NIM_TEAM_JOIN_ACTION_STATUS_EXPIRED,
        },
      ]);
      break;
    case 109311:
      toast.error(t("aleadyInTeamText"));
      store?.sysMsgStore.updateTeamJoinActionMsg([
        {
          ...msg,
          actionStatus: V2NIMConst.V2NIMTeamJoinActionStatus.V2NIM_TEAM_JOIN_ACTION_STATUS_EXPIRED,
        },
      ]);
      break;
    case 109313:
      toast.error(t("verifyMsgNotExitsText"));
      store?.sysMsgStore.updateTeamJoinActionMsg([
        {
          ...msg,
          actionStatus: V2NIMConst.V2NIMTeamJoinActionStatus.V2NIM_TEAM_JOIN_ACTION_STATUS_EXPIRED,
        },
      ]);
      break;
    case 108437:
      toast.error(t("teamMemberLimitText"));
      store?.sysMsgStore.updateTeamJoinActionMsg([
        {
          ...msg,
          actionStatus: V2NIMConst.V2NIMTeamJoinActionStatus.V2NIM_TEAM_JOIN_ACTION_STATUS_EXPIRED,
        },
      ]);
      break;
    default:
      toast.error(defaultTip);
  }
};

/** 拒绝好友申请 */
const handleRejectApplyFriendClick = async (msg: V2NIMFriendAddApplicationForUI) => {
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
const handleAcceptApplyFriendClick = async (msg: V2NIMFriendAddApplicationForUI) => {
  applyFriendLoading.value = true;
  try {
    try {
      await store?.friendStore.acceptAddApplicationActive(msg);
      toast.success(t("acceptedText"));
    } catch {
      toast.info(t("acceptFailedText"));
    }

    const textMsg = nim?.messageCreator?.createTextMessage(
      t("passFriendAskText")
    ) as unknown as V2NIMMessage;

    await store?.msgStore.sendMessageActive({
      msg: textMsg,
      conversationId: nim?.conversationIdUtil?.p2pConversationId(
        msg.operatorAccountId || ""
      ) as string,
    });
  } catch (error) {
    console.log("error", error);
  } finally {
    applyFriendLoading.value = false;
  }
};

/** 拒绝入群申请/邀请 */
const handleRejectTeamClick = async (msg: V2NIMTeamJoinActionInfoForUI) => {
  applyFriendLoading.value = true;
  try {
    if (
      msg.actionType === V2NIMConst.V2NIMTeamJoinActionType.V2NIM_TEAM_JOIN_ACTION_TYPE_APPLICATION
    ) {
      await store?.teamStore.rejectTeamApplyActive(msg);
    } else {
      await store?.teamStore.rejectTeamInviteActive(msg);
    }
    // 手动更新 store 状态
    store?.sysMsgStore.updateTeamJoinActionMsg([
      {
        ...msg,
        actionStatus: V2NIMConst.V2NIMTeamJoinActionStatus.V2NIM_TEAM_JOIN_ACTION_STATUS_REJECTED,
      },
    ]);
    toast.info(t("rejectedText"));
  } catch (e: any) {
    if (e?.code) {
      handleTeamActionErrorCode(e.code, msg, t("rejectFailedText"));
    } else {
      toast.info(t("rejectFailedText"));
    }
  } finally {
    applyFriendLoading.value = false;
  }
};

/** 同意入群申请/邀请 */
const handleAcceptTeamClick = async (msg: V2NIMTeamJoinActionInfoForUI) => {
  applyFriendLoading.value = true;
  try {
    if (
      msg.actionType === V2NIMConst.V2NIMTeamJoinActionType.V2NIM_TEAM_JOIN_ACTION_TYPE_APPLICATION
    ) {
      await store?.teamStore.acceptJoinApplicationActive(msg);
    } else {
      await store?.teamStore.acceptTeamInviteActive(msg);
    }
    // 手动更新 store 状态
    store?.sysMsgStore.updateTeamJoinActionMsg([
      {
        ...msg,
        actionStatus: V2NIMConst.V2NIMTeamJoinActionStatus.V2NIM_TEAM_JOIN_ACTION_STATUS_AGREED,
      },
    ]);
    toast.success(t("acceptedText"));
  } catch (e: any) {
    if (e?.code) {
      handleTeamActionErrorCode(e.code, msg, t("acceptFailedText"));
    } else {
      toast.info(t("acceptFailedText"));
    }
  } finally {
    applyFriendLoading.value = false;
  }
};

/** 监听验证消息 */
const validMsgWatch = autorun(() => {
  const friendMsgs = store?.sysMsgStore.friendApplyMsgs || [];
  const teamMsgs = store?.sysMsgStore.teamJoinActionMsgs || [];

  validMsg.value = [...friendMsgs, ...teamMsgs].sort(
    (a, b) => (b?.timestamp ? +b.timestamp : 0) - (a?.timestamp ? +a.timestamp : 0)
  );

  store?.sysMsgStore.friendApplyMsgs?.map((item) => {
    store?.userStore.getUserActive(item.applicantAccountId);
  });

  // 异步获取群信息并填充 teamName
  store?.sysMsgStore.teamJoinActionMsgs?.map(async (item) => {
    if (item.operatorAccountId) {
      store?.userStore.getUserActive(item.operatorAccountId);
    }
    if (item.teamId && !item.teamName) {
      try {
        const team = await store?.teamStore.getTeamActive(item.teamId);
        if (team?.name) {
          // 更新消息对象的 teamName 字段
          store?.sysMsgStore.updateTeamJoinActionMsg([
            {
              ...item,
              teamName: team.name,
            },
          ]);
        }
      } catch (error) {
        console.error("Failed to get team info:", error);
      }
    }
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
