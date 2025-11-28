import {
  V2NIMMessage,
  V2NIMMessagePin,
} from "node-nim/types/v2_def/v2_nim_struct_def";
import { PIN_CONVERSATION_LIMIT } from "./constant";
import { makeAutoObservable } from "mobx";

export type PinInfo = V2NIMMessagePin & {
  operatorId?: string;
  pinState: number;
  message?: V2NIMMessage;
};

export type PinInfos = Array<PinInfo>;

class PinMsgsMap {
  map: Map<string, Map<string, PinInfo>> = new Map();
  pinConversationLimit = PIN_CONVERSATION_LIMIT;
  constructor(limit: number = PIN_CONVERSATION_LIMIT) {
    this.pinConversationLimit = limit;
    makeAutoObservable(this);
  }
  set(conversationId: string, pinInfos: PinInfos) {
    const map = this.map.get(conversationId) || new Map<string, PinInfo>();

    if (this.map.has(conversationId)) {
      // 更新 LRU 队列
      this.map.delete(conversationId);
    }

    pinInfos.forEach((pinInfo) => {
      if (pinInfo.pinState !== 0) {
        map.set(pinInfo.messageRefer?.messageClientId as string, pinInfo);
      } else {
        // map 里面不维护 pinState 为 0 的 pin
        map.delete(pinInfo.messageRefer?.messageClientId as string);
      }
    });

    this.map.set(conversationId, map);

    if (this.map.size > this.pinConversationLimit) {
      const val = this.map.keys().next().value;

      // 最近最少用的出队
      if (val) this.map.delete(val);
    }
  }
  get(conversationId: string) {
    const map = this.map.get(conversationId);

    if (map) {
      // 更新 LRU 队列
      this.map.delete(conversationId);
      this.map.set(conversationId, map);
      return map;
    } else {
      return null;
    }
  }
  delete(conversationId: string, messageClientIds: string[]) {
    const curMap = this.map.get(conversationId);

    if (curMap) {
      // 更新 LRU 队列
      this.map.delete(conversationId);
      messageClientIds.forEach((messageClientId) => {
        curMap.delete(messageClientId);
      });
      this.map.set(conversationId, curMap);
    }
  }
  clear() {
    if (this.map) {
      this.map.forEach((map) => {
        map.clear();
      });
      this.map.clear();
    }
  }
}

export default PinMsgsMap;
