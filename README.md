网易云信即时通讯界面组件（简称 IM UIKit）是基于 [NIM SDK（网易云信 IM SDK）](https://doc.yunxin.163.com/messaging2/concept/DI0Nzc2NzA?platform=client) 开发的一款即时通讯 UI 组件库，包括聊天、会话、圈组、搜索、通讯录、群管理等组件。通过 IM UIKit，您可快速集成包含 UI 界面的即时通讯应用。

## 适用客群

IM UIKit 简化了基于 NIM SDK 的应用开发过程，适合需要快速集成和定制即时通讯功能的开发者和企业客户。它不仅能助您快速实现 UI 功能，也支持调用 NIM SDK 相应的接口实现即时通讯业务逻辑和数据处理。因此，您在使用 IM UIKit 时仅需关注自身业务或个性化扩展。

<img alt="image.png" src="https://yx-web-nosdn.netease.im/common/97303b4e1105d33afaf2bc65af6cbdf2/image.png" style="width:65%;border: 1px solid #BFBFBF;">

## 主要功能

IM UIKit 主要分为会话、群组、联系人等几个 UI 子组件，每个 UI 组件负责展示不同的内容。更多详情，请参考 [功能概览](https://doc.yunxin.163.com/messaging-uikit/concept/zMzMDQ2MTg?platform=client) 和 [UI 组件介绍](https://doc.yunxin.163.com/messaging-uikit/concept/TI3NTgyNDA?platform=client)。

## 功能优势

### 组件解耦

IM UIKit 不同组件可相互独立运行使用。您可按需选择组件，将其快速集成到您的应用，实现相应的 UI 功能，减少无用依赖。

### 自定义能力

IM UIKit 提供 hooks 函数，以便用户获取内部状态进行一些自定义操作。另外还提供多个自定义渲染函数以及自定义主题修改，以供开发者自行定制 UI。另外还提供完善的语言设置功能，帮助开发者快速定制专属文案。

### 业务逻辑处理

IM UIKit 业务逻辑层提供完善的业务逻辑处理能力。您无需关心 SDK 层不同接口间的复杂处理逻辑，业务逻辑层一个接口帮您搞定所有。

## 工作原理

IM UIKit 提供了多个 UI 组件，您可以自行选择并组合，内部管理了各个组件之间的状态，利用单向数据流来驱动 UI 更新与渲染。

<img alt="app_structure.drawio.png" src="https://yx-web-nosdn.netease.im/common/aa16d3bba199e56f8d92a95d65b20ef4/app_structure.drawio.png" style="width:60%;border: 1px solid #BFBFBF;">

## 配置项目

项目默认使用固定账号登录模式，无需修改代码填写账号信息。您可以复制 `.env.example` 为 `.env`，并按需配置应用 ID（AppKey）、账号和登录令牌：

```bash
cp .env.example .env
```

```dotenv
VITE_NIM_APP_KEY=你的应用 ID（AppKey）
VITE_NIM_ACCOUNT=你的账号
VITE_NIM_TOKEN=你的登录令牌
```

如果未在环境变量中配置完整信息，运行后登录页会展示输入表单，可在页面中手动输入应用 ID（AppKey）、账号和登录令牌后登录。

## 项目运行

```bash
npm install
npm run dev
```

## 鸿蒙产物构建

编译鸿蒙产物前，需要先安装项目依赖，然后执行鸿蒙构建脚本：

```bash
npm ci
npm run build:ohos
```

如需对鸿蒙产物签名，可以在 `ohos-builder.json5` 的 `signing` 中配置签名信息：

```json5
signing: {
  name: "default",
  type: "HarmonyOS",
  certPath: "path/to/app.cer",
  profile: "path/to/profile.p7b",
  keyAlias: "debugKey",
  keyPassword: "******",
  storeFile: "path/to/keystore.p12",
  storePassword: "******",
  signAlg: "SHA256withECDSA",
}
```

如果不希望证书路径、密钥库路径或密码等敏感信息落在仓库中，可以保持 `ohos-builder.json5` 中 `signing` 为空，并通过环境变量配置。关键环境变量如下：

- `OHAP_SIGN_PROFILE`：签名 Profile 文件路径，或使用 `OHAP_SIGN_PROFILE_BASE64` 传入 Base64 内容。
- `OHAP_SIGN_CERT`：签名证书文件路径，或使用 `OHAP_SIGN_CERT_BASE64` 传入 Base64 内容。
- `OHAP_SIGN_STORE_FILE`：签名密钥库文件路径，或使用 `OHAP_SIGN_STORE_FILE_BASE64` 传入 Base64 内容。
- `OHAP_SIGN_KEY_ALIAS`：密钥别名，未配置时默认为 `debugKey`。
- `OHAP_SIGN_KEY_PASSWORD`：密钥密码。
- `OHAP_SIGN_STORE_PASSWORD`：密钥库密码。
- `OHAP_SIGN_CONFIG_NAME`：签名配置名称，未配置时默认为 `default`。
- `OHAP_SIGN_TYPE`：签名类型，未配置时默认为 `HarmonyOS`。
- `OHAP_SIGN_ALG`：签名算法，未配置时默认为 `SHA256withECDSA`。
- `OHAP_REQUIRE_TEAM_SIGNING`：设置为 `true` 时要求必须提供签名配置，CI 的 `ohos` 任务会开启该配置。
- `OHAP_SIGN_MATERIAL_DIR` 或 `OHAP_SIGN_MATERIAL_TAR_BASE64`：当通过 `*_BASE64` 传入签名文件，且 Hvigor 需要额外 `material` 目录时使用。
- `OHAP_APP_IDENTIFIER`：可选，用于校验签名 Profile 中的 `app-identifier` 是否符合预期。

## 相关文档

- IM UIKit 的功能清单，请参考 [IM UIKit 功能概览](https://doc.yunxin.163.com/messaging-uikit/concept/zMzMDQ2MTg)。
- IM UIKit 的集成流程，请参考 [集成 IM UIKit](https://doc.yunxin.163.com/messaging-uikit/guide/zE4MjQzOTQ)。
