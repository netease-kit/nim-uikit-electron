import { EventTracking } from "@xkit-yx/utils";
import sdkPkg from "node-nim/package.json";
import { imAppkey } from "./init";
import { getOS } from "./index";
import { NEUIKIT_VERSION } from "./constants";

//上报埋点，便于线上问题排查, 不建议去除
export const trackInit = (
  component: "ChatUIKit" | "ContactUIKit" | "ConversationUIKit" | "SearchUIKit"
): void => {
  const eventTracking = new EventTracking({
    appKey: imAppkey,
    version: NEUIKIT_VERSION,
    component: component,
    imVersion: sdkPkg.version,
    platform: "Electron",
    channel: "netease",
    os: getOS(),
    framework: "Electron",
    language: "Vue3",
    container: "PC",
  });
  eventTracking.track("init", "");
};
