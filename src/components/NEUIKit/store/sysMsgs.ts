import { makeAutoObservable } from "mobx";
import RootStore from ".";
import { V2NIMClient } from "node-nim";
import {
  V2NIMFriendAddApplicationForUI,
  V2NIMTeamJoinActionInfoForUI,
} from "./types";
import { V2NIMConst } from "../utils/constants";
import * as storeUtils from "./utils";

/**Mobx 可观察对象，负责管理系统消息的子 store */
export class SysMsgStore {
  /** 好友申请消息 */
  friendApplyMsg: Map<string, V2NIMFriendAddApplicationForUI> = new Map();
  teamJoinActionMsg: Map<string, V2NIMTeamJoinActionInfoForUI> = new Map();
  logger: typeof storeUtils.logger | null = null;

  constructor(private rootStore: RootStore, private nim: V2NIMClient) {
    makeAutoObservable(this);
    this.logger = this.rootStore.logger;
    void this.nim;
  }

  resetState(): void {
    this.friendApplyMsg.clear();
    this.teamJoinActionMsg.clear();
  }

  /**
   * 销毁SysMsgStore，会取消系统消息事件监听
   */
  destroy(): void {
    this.resetState();
  }

  get friendApplyMsgs(): V2NIMFriendAddApplicationForUI[] {
    return Array.from(this.friendApplyMsg.values()).sort(
      (a, b) => (b?.timestamp || 0) - (a?.timestamp || 0)
    );
  }

  get teamJoinActionMsgs(): V2NIMTeamJoinActionInfoForUI[] {
    return Array.from(this.teamJoinActionMsg.values()).sort(
      (a, b) => (b?.timestamp || 0) - (a?.timestamp || 0)
    );
  }

  /**
   * 增加内存中的好友申请消息
   * @param msgs 系统消息对象数组
   */
  addFriendApplyMsg(msgs: V2NIMFriendAddApplicationForUI[]): void {
    msgs.reverse().forEach((msg) => {
      const key = this.createFriendApplyMsgKey(msg);
      this.friendApplyMsg.set(key, msg);
    });
  }

  /**
   * 删除内存中的好友申请消息
   * @param msgs 系统消息对象数组
   */
  deleteFriendApplyMsg(msgs: V2NIMFriendAddApplicationForUI[]): void {
    msgs.forEach((msg) => {
      const key = this.createFriendApplyMsgKey(msg);

      this.friendApplyMsg.delete(key);
    });
  }

  /**
   * 更新内存中的好友申请消息
   * @param msgs 系统消息对象数组
   */
  updateFriendApplyMsg(msgs: V2NIMFriendAddApplicationForUI[]): void {
    msgs.forEach((msg) => {
      const key = this.createFriendApplyMsgKey(msg);
      const oldMsg = this.friendApplyMsg.get(key);

      if (oldMsg) {
        this.friendApplyMsg.set(key, { ...oldMsg, ...msg });
      }
    });
  }

  /**
   * 增加内存中的入群申请消息
   * @param msgs 系统消息对象数组
   */
  addTeamJoinActionMsg(msgs: V2NIMTeamJoinActionInfoForUI[]): void {
    msgs.reverse().forEach((msg) => {
      const key = this.createTeamJoinActionMsgKey(msg);

      this.teamJoinActionMsg.set(key, msg);
    });
  }

  /**
   * 删除内存中的入群申请消息
   * @param msgs 系统消息对象数组
   */
  deleteTeamJoinActionMsg(msgs: V2NIMTeamJoinActionInfoForUI[]): void {
    msgs.forEach((msg) => {
      const key = this.createTeamJoinActionMsgKey(msg);

      this.teamJoinActionMsg.delete(key);
    });
  }

  /**
   * 更新内存中的入群申请消息
   * @param msgs 系统消息对象数组
   */
  updateTeamJoinActionMsg(msgs: V2NIMTeamJoinActionInfoForUI[]): void {
    msgs.forEach((msg) => {
      const key = this.createTeamJoinActionMsgKey(msg);
      const oldMsg = this.teamJoinActionMsg.get(key);
      const newMsg = { ...oldMsg, ...msg };

      this.teamJoinActionMsg.set(key, newMsg);
    });
  }

  /** 获取未读好友申请消息数量 */
  getUnreadFriendApplyMsgsCount(): number {
    return this.friendApplyMsgs.filter((msg) => !msg.read && msg.status === V2NIMConst.V2NIMFriendAddApplicationStatus.V2NIM_FRIEND_ADD_APPLICATION_STATUS_INIT).length;
  }

  /** 获取未读入群申请消息数量 */
  getUnreadTeamJoinActionMsgsCount(): number {
    return this.teamJoinActionMsgs.filter((msg) => !msg.read && msg.actionStatus === V2NIMConst.V2NIMTeamJoinActionStatus.V2NIM_TEAM_JOIN_ACTION_STATUS_INIT).length;
  }

  /** 获取未读消息总数 */
  getTotalUnreadMsgsCount(): number {
    return (
      this.getUnreadFriendApplyMsgsCount() +
      this.getUnreadTeamJoinActionMsgsCount()
    );
  }

  /** 设置所有申请消息为已读 */
  setAllApplyMsgRead(): void {
    this.nim.friendService?.setAddApplicationRead().then(() => {
      this.updateFriendApplyMsg(
        this.friendApplyMsgs.map((msg) => ({ ...msg, read: true }))
      );
    })
    this.teamJoinActionMsgs.map((msg) => {
      this.nim.teamService?.setTeamJoinActionInfoRead(msg)
    })
    this.updateTeamJoinActionMsg(
      this.teamJoinActionMsgs.map((msg) => ({ ...msg, read: true }))
    );
  }

  /** 创建群组申请消息的 key */
  createTeamJoinActionMsgKey(msg: V2NIMTeamJoinActionInfoForUI): string {
    return `${msg.teamId}_${msg.operatorAccountId}_${msg.actionType}`;
  }

  /** 创建好友申请消息的 key */
  createFriendApplyMsgKey(msg: V2NIMFriendAddApplicationForUI): string {
    return `${msg.applicantAccountId}_${msg.recipientAccountId}`;
  }
}
