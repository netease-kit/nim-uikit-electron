import { logDebug } from "@xkit-yx/utils";
import packageJson from "node-nim/package.json";
import { V2NIMMessageForUI } from "./types";
import { V2NIMConst } from "../utils/constants";

export { logDebug };

export const logger = logDebug({
  level: "debug",
  version: packageJson.version,
  appName: packageJson.name,
  needStringify: false,
});

export const frequencyControl = <
  P extends string,
  R extends { accountId: string }
>(
  fn: (params: P[]) => Promise<R[]>,
  delay: number,
  limit: number
): ((params: P) => Promise<R>) => {
  const promiseQueue: { args: P; queue: { resolve: any; reject: any }[] }[] =
    [];
  let requesting = false;
  let timer: any;

  return function (args) {
    return new Promise((resolve, reject) => {
      const p = promiseQueue.find((item) => item.args === args);

      if (p) {
        p.queue.push({ resolve, reject });
      } else {
        promiseQueue.push({ args, queue: [{ resolve, reject }] });
      }

      if (requesting) {
        return;
      }

      const handler = (
        pq: { args: P; queue: { resolve: any; reject: any }[] }[]
      ) => {
        if (!pq.length) {
          return;
        }

        requesting = true;
        fn.call(
          // @ts-ignore
          this,
          pq.map((item) => item.args)
        )
          .then((res) => {
            while (pq.length) {
              const p = pq.shift();

              if (p) {
                const _ = res.find((j) => j.accountId === p.args);

                p.queue.forEach((j) => j.resolve(_));
              }
            }
          })
          .catch((err) => {
            while (pq.length) {
              const p = pq.shift();

              if (p) {
                p.queue.forEach((item) => item.reject(err));
              }
            }
          })
          .finally(() => {
            requesting = false;
            if (promiseQueue.length) {
              handler(promiseQueue.splice(0, limit));
            }
          });
      };

      // 如果参数数量到达 limit，立即执行
      if (promiseQueue.length >= limit) {
        clearTimeout(timer);
        handler(promiseQueue.splice(0, limit));
      } else {
        clearTimeout(timer);
        timer = setTimeout(() => {
          handler(promiseQueue.splice(0, limit));
        }, delay);
      }
    });
  };
};

/**
 * 过滤消息，处理了撤回消息的过滤
 */
export const getFilterMsgs = (
  msgs: V2NIMMessageForUI[],
  filterFn?: (msg: V2NIMMessageForUI, index?: number) => boolean
): V2NIMMessageForUI[] => {
  let filterMsgs = [...msgs];

  if (filterFn) {
    filterMsgs = filterMsgs.filter(filterFn);
  }

  const res: V2NIMMessageForUI[] = [];
  const filterRecallMsg: V2NIMMessageForUI[] = [];
  let startWithoutRecallMsg: number | undefined;

  filterMsgs.forEach((item) => {
    // 找到第一条不是撤回消息的消息，记录时间
    if (
      !(
        item.messageType ===
          V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM &&
        ["beReCallMsg", "reCallMsg"].includes(item.recallType || "")
      ) &&
      startWithoutRecallMsg === void 0
    ) {
      startWithoutRecallMsg = item.createTime;
    }

    // 不在上述时间范围内的撤回消息过滤掉不显示
    if (
      item.messageType ===
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM &&
      ["beReCallMsg", "reCallMsg"].includes(item.recallType || "")
    ) {
      if (
        startWithoutRecallMsg !== void 0 &&
        (item?.createTime || 0) >= startWithoutRecallMsg
      ) {
        res.push(item);
      } else {
        filterRecallMsg.push(item);
      }
    } else {
      res.push(item);
    }
  });

  // 如果当前只有撤回消息，则需要显示
  if (!res.length && filterRecallMsg.length) {
    return filterRecallMsg;
  }

  return res;
};

export const batchRequest = <P>(
  fn: (params: P[], ...args: any) => Promise<void>,
  max: number
): ((params: P[]) => Promise<void>) => {
  return async function (params: P[], ...args: any): Promise<void> {
    if (!params.length) {
      // @ts-ignore
      await fn.apply(this, [params].concat(args));
    }

    const batches: P[][] = [];

    for (let i = 0; i < params.length; i += max) {
      batches.push(params.slice(i, i + max));
    }

    for (const batch of batches) {
      // @ts-ignore
      await fn.apply(this, [batch].concat(args));
    }
  };
};

export function detectLanguage() {
  // 通过全局变量检测
  if (typeof window !== "undefined") {
    //@ts-ignore
    if (window?.__VUE__) {
      //@ts-ignore
      return window?.Vue?.version?.startsWith("2") ? "Vue2" : "Vue3";
    }

    // @ts-ignore
    if (window?.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      return "React";
    }
  }

  return "Vue3";
}

export function detectContainer(platform: string) {
  if (platform === "Web") {
    return "PC";
  }

  if (platform === "H5") {
    return "H5";
  }

  if (platform === "UniApp") {
    //@ts-ignore
    return uni?.getSystemInfoSync()?.uniPlatform?.toUpperCase();
  }
}
