import { t } from "./i18n";
import sdkpkg from "node-nim/package.json";

/**
 *
 * @details 带资源编号的错误码格式为 IM业务编号1 + 资源编号(2位) + 错误码(3位), 例如 101414
 * | 编号 | 资源 |
 * | :--: | :--: |
 * | 01 | 应用 |
 * | 02 | 用户账号 |
 * | 03 | 用户资料 |
 * | 04 | 好友 |
 * | 05 | 静音 |
 * | 06 | 黑名单 |
 * | 07 | 消息 |
 * | 08 | 群 |
 * | 09 | 群成员 |
 * | 10 | 会话 |
 * | 11 | 广播消息 |
 * | 12 | 系统消息 |
 * | 13 | 聊天室 |
 * | 14 | 聊天室成员/虚构用户 |
 * | 15 | 会话概览 |
 * | 16 | 会话分组 |
 * | 17 | 聊天室队列 |
 * | 89 | 其他 |
 * | 90 | 通用 |
 * | 91 | 接口 |
 * | 92 | 连接 |
 * | 93 | 数据库 |
 * | 94 | 文件 |
 * | 95 | 反垃圾 |
 */
const V2NIMErrorMap = {
  /** 未知错误 / unknown error */
  V2NIM_ERROR_CODE_UNKNOWN: {
    code: 0,
    message: "unknown error",
  },
  /** 请求成功 / success */
  V2NIM_ERROR_CODE_SUCCESS: {
    code: 200,
    message: "success",
  },

  // ========= 全局错误
  /* 握手错误 / handshake error */
  V2NIM_ERROR_CODE_HANDSHAKE: {
    code: 201,
    message: "handshake error",
  },
  /* 请求被服务器暂时禁止 / request temprary forbidden */
  V2NIM_ERROR_CODE_REQUEST_TEMPERARY_FORBIDDEN: {
    code: 398,
    message: "request temprary forbidden",
  },
  /* 服务器单元错误 / server unit error */
  V2NIM_ERROR_CODE_SERVER_UNIT_ERROR: {
    code: 399,
    message: "server unit error",
  },
  /* 没有权限 / forbidden */
  V2NIM_ERROR_CODE_FORBIDDEN: {
    code: 403,
    message: "forbidden",
  },
  /* 资源不存在  / not found */
  V2NIM_ERROR_CODE_NOT_FOUND: {
    code: 404,
    message: "not found",
  },
  /* 参数错误 / parameter error */
  V2NIM_ERROR_CODE_PARAMETER_ERROR: {
    code: 414,
    message: "parameter error",
  },
  /* 频率超限 / rate limit reached */
  V2NIM_ERROR_CODE_RATE_LIMIT_REACHED: {
    code: 416,
    message: "rate limit reached",
  },
  /* 多端登录被禁止 / multi login forbidden */
  V2NIM_ERROR_CODE_MULTI_LOGIN_FORBIDDEN: {
    code: 417,
    message: "multi login forbidden",
  },
  /* 服务器内部错误 / server internal error */
  V2NIM_ERROR_CODE_SERVER_INTERNAL_ERROR: {
    code: 500,
    message: "server internal error",
  },
  /* 服务器繁忙 / server busy */
  V2NIM_ERROR_CODE_SERVER_BUSY: {
    code: 503,
    message: "server busy",
  },
  /* app 服务不可达 / app server unreachable */
  V2NIM_ERROR_CODE_APP_UNREACHABLE: {
    code: 511,
    message: "app server unreachable",
  },
  /* 服务不可用  / service unavailable */
  V2NIM_ERROR_CODE_SERVICE_UNAVAILABLE: {
    code: 514,
    message: "service unavailable",
  },
  /* 协议被黑洞规则过滤 / protocol filtered by blackhole rule */
  V2NIM_ERROR_CODE_PROTOCOL_BLACKHOLE_FILTERED: {
    code: 599,
    message: "protocol filtered by blackhole rule",
  },
  /* appid 没有权限调用该协议 / appid has no permission to call the protocol */
  V2NIM_ERROR_CODE_NO_PERMISSION: {
    code: 997,
    message: "appid has no permission to call the protocol",
  },
  /* 解包错误 / unpack error */
  V2NIM_ERROR_CODE_UNPACK_ERROR: {
    code: 998,
    message: "unpack error",
  },
  /* 打包错误 / pack error */
  V2NIM_ERROR_CODE_PACK_ERROR: {
    code: 999,
    message: "pack error",
  },

  // ========= 应用类型错误
  /* IM 未开通 / IM disabled */
  V2NIM_ERROR_CODE_IM_DISABLED: {
    code: 101301,
    message: "IM disabled",
  },
  /* 服务地址非法 / service address invalid */
  V2NIM_ERROR_CODE_SERVICE_ADDRESS_INVALID: {
    code: 101302,
    message: "service address invalid",
  },
  /* appkey 不存在 / appkey not exist */
  V2NIM_ERROR_CODE_APPKEY_NOT_EXIST: {
    code: 101303,
    message: "appkey not exist",
  },
  /* bundleid 校验失败 / bundleid check failed */
  V2NIM_ERROR_CODE_BUNDLEID_CHECK_FAILED: {
    code: 101304,
    message: "bundleid check failed",
  },
  /* appkey 被禁用 / appkey blocked */
  V2NIM_ERROR_CODE_APPKEY_BLOCKED: {
    code: 101403,
    message: "appkey blocked",
  },

  // ========= 帐号类型错误
  /* 无效 token / invalid token */
  V2NIM_ERROR_CODE_INVALID_TOKEN: {
    code: 102302,
    message: "invalid token",
  },
  /* 机器人账号不得登录 / robot not allowed */
  V2NIM_ERROR_CODE_ROBOT_NOT_ALLOWED: {
    code: 102303,
    message: "robot not allowed",
  },
  /* 用户不存在 / account not exist */
  V2NIM_ERROR_CODE_ACCOUNT_NOT_EXIST: {
    code: 102404,
    message: "account not exist",
  },
  /* 用户被禁言 / account chat banned */
  V2NIM_ERROR_CODE_ACCOUNT_CHAT_BANNED: {
    code: 102421,
    message: "account chat banned",
  },
  /* 用户被禁用 / account banned */
  V2NIM_ERROR_CODE_ACCOUNT_BANNED: {
    code: 102422,
    message: "account banned",
  },
  /* 用户被拉黑 / account in block list */
  V2NIM_ERROR_CODE_ACCOUNT_IN_BLOCK_LIST: {
    code: 102426,
    message: "account in block list",
  },

  // ========= 用户资料类型错误
  /* 用户资料不存在 / user profile not exist */
  V2NIM_ERROR_CODE_USER_PROFILE_NOT_EXIST: {
    code: 103404,
    message: "user profile not exist",
  },
  /* 用户资料反垃圾 / user profile hit antispam */
  V2NIM_ERROR_CODE_USER_PROFILE_HIT_ANTISPAM: {
    code: 103451,
    message: "user profile hit antispam",
  },

  // ========= 好友类型错误
  /* 对方好友超限 / peer friend limit */
  V2NIM_ERROR_CODE_PEER_FRIEND_LIMIT: {
    code: 104301,
    message: "peer friend limit",
  },
  /* 好友申请不存在 / friend application not exist */
  V2NIM_ERROR_CODE_FRIEND_APPLICATION_NOT_EXIST: {
    code: 104302,
    message: "friend application not exist",
  },
  /* 好友不存在 / friend not exist */
  V2NIM_ERROR_CODE_FRIEND_NOT_EXIST: {
    code: 104404,
    message: "friend not exist",
  },
  /* 好友已存在 / friend already exist */
  V2NIM_ERROR_CODE_FRIEND_ALREADY_EXIST: {
    code: 104405,
    message: "friend already exist",
  },
  /* 不允许对自己进行好友操作 / self friend operation not allowed */
  V2NIM_ERROR_CODE_SELF_FRIEND_OPERATION_NOT_ALLOWED: {
    code: 104429,
    message: "self friend operation not allowed",
  },
  /* 好友超限 / friend limit */
  V2NIM_ERROR_CODE_FRIEND_LIMIT: {
    code: 104435,
    message: "friend limit",
  },
  /* 好友操作频率超限 / friend operation rate limit */
  V2NIM_ERROR_CODE_FRIEND_OPERATION_RATE_LIMIT: {
    code: 104449,
    message: "friend operation rate limit",
  },
  /* 好友反垃圾 / friend hit antispam */
  V2NIM_ERROR_CODE_FRIEND_HIT_ANTISPAM: {
    code: 104451,
    message: "friend hit antispam",
  },

  // ========= 静音
  /* 不允许对自己进行静音操作 / self mute operation not allowed */
  V2NIM_ERROR_CODE_SELF_MUTE_OPERATION_NOT_ALLOWED: {
    code: 105429,
    message: "self mute operation not allowed",
  },
  /* 静音列表超限 / mute list limit */
  V2NIM_ERROR_CODE_MUTE_LIST_LIMIT: {
    code: 105435,
    message: "mute list limit",
  },

  // ========= 黑名单
  /* 不允许对自己进行黑名单操作 / self block list operation not allowed */
  V2NIM_ERROR_CODE_SELF_BLOCK_LIST_OPERATION_NOT_ALLOWED: {
    code: 106429,
    message: "self block list operation not allowed",
  },
  /* 黑名单超限 / block list limit */
  V2NIM_ERROR_CODE_BLOCK_LIST_LIMIT: {
    code: 106435,
    message: "block list limit",
  },

  // ========= 消息
  /* 不允许撤回第三方业务消息 / revoke third party message not allowed */
  V2NIM_ERROR_CODE_REVOKE_THIRD_PARTY_MESSAGE_NOT_ALLOWED: {
    code: 107301,
    message: "revoke third party message not allowed",
  },
  /* 短链转长链失败 / short to long URL failed */
  V2NIM_ERROR_CODE_SHORT_TO_LONG_URL_FAILED: {
    code: 107307,
    message: "short to long URL failed",
  },
  /* 无效 URL / URL invalid */
  V2NIM_ERROR_CODE_URL_INVALID: {
    code: 107308,
    message: "URL invalid",
  },
  /* duration 超出范围 / duration out of range */
  V2NIM_ERROR_CODE_DURATION_OUT_OF_RANGE: {
    code: 107309,
    message: "duration out of range",
  },
  /* 获取文件 meta 信息失败 / get file meta info failed */
  V2NIM_ERROR_CODE_GET_FILE_META_INFO_FAILED: {
    code: 107310,
    message: "get file meta info failed",
  },
  /* 音频文件大小超限 / audio file size limit */
  V2NIM_ERROR_CODE_AUDIO_FILE_SIZE_LIMIT: {
    code: 107311,
    message: "audio file size limit",
  },
  /* 语音转文字超时 / voice to text timeout */
  V2NIM_ERROR_CODE_VOICE_TO_TEXT_TIMEOUT: {
    code: 107312,
    message: "voice to text timeout",
  },
  /* 语音转文字失败 / voice to text failed */
  V2NIM_ERROR_CODE_VOICE_TO_TEXT_FAILED: {
    code: 107313,
    message: "voice to text failed",
  },
  /* 撤回消息超过时间限制 / revoke message exceed time limit */
  V2NIM_ERROR_CODE_REVOKE_EXCEED_TIME_LIMIT: {
    code: 107314,
    message: "revoke message exceed time limit",
  },
  /* 不允许撤回指定消息 / revoke specific message not allowed */
  V2NIM_ERROR_CODE_REVOKE_MESSAGE_NOT_ALLOWED: {
    code: 107315,
    message: "revoke specific message not allowed",
  },
  /* 强推列表超过上限 / force push list limit */
  V2NIM_ERROR_CODE_FORCE_PUSH_LIST_LIMIT: {
    code: 107316,
    message: "force push list limit",
  },
  /* 群消息已读操作超频 / team message receipt rate limit */
  V2NIM_ERROR_CODE_TEAM_MESSAGE_RECEIPT_RATE_LIMIT: {
    code: 107317,
    message: "team message receipt rate limit",
  },
  /* 快照不存在 / snapshot not exist */
  V2NIM_ERROR_CODE_SNAPSHOT_NOT_EXIST: {
    code: 107318,
    message: "snapshot not exist",
  },
  /* pin 数量超限 / pin limit */
  V2NIM_ERROR_CODE_PIN_LIMIT: {
    code: 107319,
    message: "pin limit",
  },
  /* pin 不存在 / pin not exist */
  V2NIM_ERROR_CODE_PIN_NOT_EXIST: {
    code: 107320,
    message: "pin not exist",
  },
  /* 快捷评论数量超限 / quick comment limit */
  V2NIM_ERROR_CODE_QUICK_COMMENT_LIMIT: {
    code: 107321,
    message: "quick comment limit",
  },
  /* pin 已存在 / pin already exist */
  V2NIM_ERROR_CODE_PIN_ALREADY_EXIST: {
    code: 107322,
    message: "pin already exist",
  },
  /* 语音转文字功能未开通 / voice to text function disabled */
  V2NIM_ERROR_CODE_VOICE_TO_TEXT_FUNCTION_DISABLED: {
    code: 107333,
    message: "voice to text function disabled",
  },
  /* 云端搜索功能未开通 / cloud search function disabled */
  V2NIM_ERROR_CODE_CLOUD_SEARCH_FUNCTION_DISABLED: {
    code: 107334,
    message: "cloud search function disabled",
  },
  /* 单向删除功能未开通 / one-way delete function disabled */
  V2NIM_ERROR_CODE_ONE_WAY_DELETE_FUNCTION_DISABLED: {
    code: 107335,
    message: "one-way delete function disabled",
  },
  /* 定向消息不允许单向删除 / one-way deletion is not allowed for target messages */
  V2NIM_ERRPR_CODE_ONEWAY_DELETION_NOT_ALLOW_FOR_TARGET_MESSAGES: {
    code: 107338,
    message: "one-way deletion is not allowed for target messages",
  },
  /* 定向列表包含消息发送者 / The message sender cannot be included in the target list. */
  V2NIM_ERRPR_CODE_SENDER_CANNOT_INCLUDED_IN_TARGET_LIST: {
    code: 107339,
    message: "The message sender cannot be included in the target list",
  },
  /* 数字人消息不能是定向消息 / Robot can not send target message. */
  V2NIM_ERROR_CODE_ROBOT_CANNOT_SEND_TARGET_MESSAGE: {
    code: 107340,
    message: "Robot can not send target message",
  },
  /* 不支持PIN定向消息 / Pin target message is not allowed */
  V2NIM_ERROR_CODE_PIN_TARGET_MESSAGE_NOT_ALLOWED: {
    code: 107345,
    message: "Pin target message is not allowed",
  },
  /* 定向消息不支持回复 / Target message not allowed reply */
  V2NIM_ERROR_CODE_TARGET_MESSAGE_NOT_ALLOWED_REPLY: {
    code: 107346,
    message: "Target message not allowed reply",
  },
  /* 定向消息不支持快捷评论 / Target message not allowed quick comment */
  V2NIM_ERROR_CODE_TARGET_MESSAGE_NOT_ALLOWED_QUICK_COMMENT: {
    code: 107347,
    message: "Target message not allowed quick comment",
  },
  /* 不允许撤回发给自己的消息 / revoke message to self not allowed */
  V2NIM_ERROR_CODE_REVOKE_MESSAGE_TO_SELF_NOT_ALLOWED: {
    code: 107429,
    message: "revoke message to self not allowed",
  },
  /* 应用被禁言 / app chat banned */
  V2NIM_ERROR_CODE_APP_CHAT_BANNED: {
    code: 107410,
    message: "app chat banned",
  },
  /* 该app未开启快捷评论功能 / quick comment function disabled */
  V2NIM_ERROR_CODE_QUICK_COMMENT_FUNCTION_DISABLED: {
    code: 107326,
    message: "quick comment function disabled",
  },
  /* 该app未开启消息pin功能 / PIN function disabled */
  V2NIM_ERROR_CODE_PIN_FUNCTION_DISABLED: {
    code: 107327,
    message: "PIN function disabled",
  },
  /* 该app未开启群消息已读功能 / read receipt for team messages function disabled */
  V2NIM_ERROR_CODE_TEAM_READ_RECEIPT_FUNCTION_DISABLED: {
    code: 107324,
    message: "read receipt for team messages function disabled",
  },
  /* 该app未开启单聊消息已读功能 / read receipt for p2p messages function disabled */
  V2NIM_ERROR_CODE_P2P_READ_RECEIPT_FUNCTION_DISABLED: {
    code: 107325,
    message: "read receipt for p2p messages function disabled",
  },
  /* 消息被流控  rate limit for messaging reached */
  V2NIM_ERROR_CODE_RATE_LIMIT_FOR_MESSAGING_REACHED: {
    code: 107323,
    message: "rate limit for messaging reached",
  },
  /* 消息命中反垃圾 / message hit antispam */
  V2NIM_ERROR_CODE_MESSAGE_HIT_ANTISPAM: {
    code: 107451,
    message: "message hit antispam",
  },
  /* 消息不存在 / message not exist */
  V2NIM_ERROR_CODE_MESSAGE_NOT_EXIST: {
    code: 107404,
    message: "message not exist",
  },
  /* 消息过期不准撤回 / unsending message expired */
  V2NIM_ERROR_CODE_UNSENDING_MESSAGE_EXPIRED: {
    code: 107406,
    message: "unsending message expired",
  },
  /* 由于群成员过多导致标记已读失败，消息发送失败 / sending message failed for marking message read failed for too many team members */
  V2NIM_ERROR_CODE_TEAM_MARK_READ_FAILED: {
    code: 107302,
    message: "sending message failed for marking message read failed for too many team members",
  },
  /* 仅允许发送者或管理员撤回消息 / only sender or manager can revoke message */
  V2NIM_ERROR_CODE_SENDER_OR_MANAGER_PERMISSION_ONLY_REVOKE: {
    code: 107303,
    message: "only sender or manager can revoke message",
  },
  /* 不允许删除发给自己的消息 / delete self message not allowed */
  V2NIM_ERROR_CODE_DELETE_SELF_MESSAGE_NOT_ALLOWED: {
    code: 107328,
    message: "delete self message not allowed",
  },
  /* 不是机器人账号 / is not chatbot account */
  V2NIM_ERROR_CODE_NOT_CHATBOT_ACCOUNT: {
    code: 107329,
    message: "is not chatbot account",
  },
  /* 不允许发送方和接收方均无感知 / sender or receiver must sense message */
  V2NIM_ERROR_CODE_MESSAGE_SENSE_REQUIRED: {
    code: 107330,
    message: "sender or receiver must sense message",
  },
  /* 高优消息超过频控限制 / rate limit of high-priority messages exceeded */
  V2NIM_ERROR_CODE_HIGH_PRIORITY_MESSAGE_RATE_LIMIT: {
    code: 107304,
    message: "rate limit of high-priority messages exceeded",
  },
  /* ack消息必须是高优消息 / ack message should be high-priority */
  ACK_MESSAGE_BE_HIGH_PRIORITY: {
    code: 107305,
    message: "ack message should be high-priority",
  },
  /* 消息ID重复 / duplicate client message ID */
  V2NIM_ERROR_CODE_DUPLICATE_CLIENT_MESSAGE_ID: {
    code: 107306,
    message: "duplicate client message ID",
  },
  /* 无效的时间范围 / invalid time range */
  V2NIM_ERROR_CODE_INVALID_TIME_RANGE: {
    code: 107439,
    message: "invalid time range",
  },

  // ========= 群类型错误
  /* 非高级群 / not advanced team */
  V2NIM_ERROR_CODE_NOT_ADVANCED_TEAM: {
    code: 108302,
    message: "not advanced team",
  },
  /* 管理员超限 / team manager limit */
  V2NIM_ERROR_CODE_TEAM_MANAGER_LIMIT: {
    code: 108303,
    message: "team manager limit",
  },
  /* 加入群组超过上限 / joined team limit */
  V2NIM_ERROR_CODE_JOINED_TEAM_LIMIT: {
    code: 108305,
    message: "joined team limit",
  },
  /* 群普通成员禁言 / team normal member chat banned */
  V2NIM_ERROR_CODE_TEAM_NORMAL_MEMBER_CHAT_BANNED: {
    code: 108306,
    message: "team normal member chat banned",
  },
  /* 被邀请者非好友关系 / invited account not friend */
  V2NIM_ERROR_CODE_INVITED_ACCOUNT_NOT_FRIEND: {
    code: 108307,
    message: "invited account not friend",
  },
  /* 拒绝所有入群申请 / reject all team applications */
  V2NIM_ERROR_CODE_REJECT_ALL_TEAM_APPLICATIONS: {
    code: 108308,
    message: "reject all team applications",
  },
  /* 群定向消息功能未开启 / Targeting messages for group chat is disabled */
  V2NIM_ERROR_CODE_TARGETING_MESSAGE_FOR_TEAM_DISABLED: {
    code: 108318,
    message: "Targeting messages for group chat is disabled",
  },
  /* 超级群定向消息不支持反选 / Targeting messages for group chat is disabled */
  V2NIM_ERROR_CODE_INCLUSIVE_AS_FALSE_NOT_ALLOWED_FOR_SUPER_TEAM: {
    code: 108319,
    message: `Setting "inclusive" to false for super teams is not allowed`,
  },
  /* 超级群定向消不支持新成员可见 / Cannot make super team targeted messages visible to new members */
  V2NIM_ERROR_CODE_CANNOT_MAKE_SUPER_TEAM_MESSAGE_VISIBLE_TO_NEW_MEMBERS: {
    code: 108320,
    message: `Cannot make super team targeted messages visible to new members`,
  },
  /* 定向消息成员正选不支持新成员可见 / Cannot allow targeted messages inclusive to new members */
  V2NIM_ERROR_CODE_CANNOT_ALLOW_TARGETED_MESSAGES_INCLUSIVE_TO_NEW_MEMBERS: {
    code: 108321,
    message: `Cannot allow targeted messages inclusive to new members`,
  },

  /* 群不存在 / team not exist */
  V2NIM_ERROR_CODE_TEAM_NOT_EXIST: {
    code: 108404,
    message: "team not exist",
  },
  /* 群已处于禁言状态 / team already chat banned */
  V2NIM_ERROR_CODE_TEAM_ALREADY_CHAT_BANNED: {
    code: 108420,
    message: "team already chat banned",
  },
  /* 群全体禁言 / all team member chat banned */
  V2NIM_ERROR_CODE_ALL_TEAM_MEMBER_CHAT_BANNED: {
    code: 108423,
    message: "all team member chat banned",
  },
  /* 大容量超大群数量超限 / extended super team limit */
  V2NIM_ERROR_CODE_EXTENDED_SUPER_TEAM_LIMIT: {
    code: 108434,
    message: "extended super team limit",
  },
  /* 创建群组超过上限 / created team limit */
  V2NIM_ERROR_CODE_CREATED_TEAM_LIMIT: {
    code: 108435,
    message: "created team limit",
  },
  /* 邀请人数超过上限 / team invitation limit */
  V2NIM_ERROR_CODE_TEAM_INVITATION_LIMIT: {
    code: 108437,
    message: "team invitation limit",
  },
  /* 群组反垃圾 / team hit antispam */
  V2NIM_ERROR_CODE_TEAM_HIT_ANTISPAM: {
    code: 108451,
    message: "team hit antispam",
  },
  /* 未配置大容量超大群的数量 / extended super team limit not configured */
  V2NIM_ERROR_CODE_EXTENDED_SUPER_TEAM_LIMIT_NOT_CONFIGURED: {
    code: 108304,
    message: "extended super team limit not configured",
  },
  /* 超大群服务未开通 / super team service disabled */
  V2NIM_ERROR_CODE_SUPER_TEAM_SERVICE_DISABLED: {
    code: 108311,
    message: "super team service disabled",
  },
  /* 群消息已读记录未找到 / read receipt record for the team message not found */
  V2NIM_ERROR_CODE_TEAM_READ_RECEIPT_RECORD_NOT_FOUND: {
    code: 108301,
    message: "read receipt record for the team message not found",
  },
  /* 不能添加群主为管理员（被操作者不能是群主） / unable to assign owner manager */
  V2NIM_ERROR_CODE_NOT_MANAGER: {
    code: 108430,
    message: "unable to assign owner manager",
  },
  /* 获取在线人数功能未开启 / number of online users service disabled */
  V2NIM_ERROR_CODE_ONLINE_MEMBER_COUNT_DISABLED: {
    code: 108406,
    message: "number of online users service disabled",
  },
  /* 群不能转给当前群主（被操作者不能是群主） / unable to transfer the ownership to owner */
  V2NIM_ERROR_CODE_TRANSFER_DISABLED: {
    code: 108310,
    message: "unable to transfer the ownership to owner",
  },
  /* 不允许创建超出人的群 / unable to create team with more than %s people */
  V2NIM_ERROR_CODE_CREATE_TEAM_DISABLED: {
    code: 108309,
    message: "unable to create team with more than %s people",
  },
  /* 不允许创建2000+超大群 / extended super team creation failed，use open api to create the team */
  V2NIM_ERROR_CODE_EXTENDED_SUPER_TEAM_CREATE_FAILED: {
    code: 108313,
    message: "/ extended super team creation failed，use open api to create the team",
  },
  /* 群消息已读功能未开启 / read receipt for team messages function disabled */
  V2NIM_ERROR_CODE_TEAM_MESSAGE_READ_RECEIPT_DISABLED: {
    code: 108312,
    message: "read receipt for team messages function disabled",
  },
  /* 请求需要重试 / an error occurred, try again */
  V2NIM_ERROR_CODE_RETRY: {
    code: 108449,
    message: "an error occurred, try again",
  },

  // ========== 群成员类型错误
  /* 禁言列表包含非群成员 / list of chat banned users contains non team members */
  V2NIM_ERROR_CODE_CHAT_BAN_LIST_CONTAIN_NOT_TEAM_MEMBER: {
    code: 109301,
    message: "list of chat banned users contains non team members",
  },
  /* 禁言列表包含操作人 / list of chat banned users contains the operator */
  V2NIM_ERROR_CODE_CHAT_BAN_LIST_CONTAIN_OPERATOR: {
    code: 109303,
    message: "list of chat banned users contains the operator",
  },
  /* 禁言列表包含群主 / list of chat banned users contains the team owner */
  V2NIM_ERROR_CODE_CHAT_BAN_LIST_CONTAIN_TEAM_OWNER: {
    code: 109304,
    message: "list of chat banned users contains the team owner",
  },
  /* 不允许操作管理员 / operation on team manager not allowed */
  V2NIM_ERROR_CODE_OPERATION_ON_TEAM_MANAGER_NOT_ALLOWED: {
    code: 109305,
    message: "operation on team manager not allowed",
  },
  /* 没有群邀请权限 / no team invite permission */
  V2NIM_ERROR_CODE_NO_TEAM_INVITE_PERMISSION: {
    code: 109306,
    message: "no team invite permission",
  },
  /* 群主不允许退群 / team owner quit not allowed */
  V2NIM_ERROR_CODE_TEAM_OWNER_QUIT_NOT_ALLOWED: {
    code: 109307,
    message: "team owner quit not allowed",
  },
  /* 群被踢列表包含群主 / list of kicked user contains the team owner */
  V2NIM_ERROR_CODE_TEAM_OWNER_IN_KICK_LIST: {
    code: 109308,
    message: "list of kicked user contains the team owner",
  },
  /* 不允许邀请机器人账号进群 / invite robot account not allowed */
  V2NIM_ERROR_CODE_INVITE_ROBOT_ACCOUNT_NOT_ALLOWED: {
    code: 109309,
    message: "invite robot account not allowed",
  },
  /* 被踢的群成员列表中包含操作者 / kick operator not allowed */
  V2NIM_ERROR_CODE_KICK_OPERATOR_NOT_ALLOWED: {
    code: 109310, // TODO
    message: "kick operator not allowed",
  },
  /* 群成员已存在 / team member already exist */
  V2NIM_ERROR_CODE_TEAM_MEMBER_ALREADY_EXIST: {
    code: 109311,
    message: "team member already exist",
  },
  /* 群邀请或者申请记录不存在 / team invitation or application not exist */
  V2NIM_ERROR_CODE_TEAM_INVITATION_OR_APPLICATION_NOT_EXIST: {
    code: 109313,
    message: "team invitation or application not exist",
  },
  /* 不允许操作群主 / operation on team owner not allowed */
  V2NIM_ERROR_CODE_OPERATION_ON_TEAM_OWNER_NOT_ALLOWED: {
    code: 109314,
    message: "operation on team owner not allowed",
  },
  /* 强推列表包含非定向成员 / The forced push list includes non-targeted accounts */
  V2NIM_ERROR_CODE_FORCED_PUSH_LIST_INCLUDES_NON_TARGETED_ACCOUNTS: {
    code: 109318,
    message: "The forced push list includes non-targeted accounts",
  },

  /* 群成员不存在 / team member not exist */
  V2NIM_ERROR_CODE_TEAM_MEMBER_NOT_EXIST: {
    code: 109404,
    message: "team member not exist",
  },
  /* 群成员被禁言 / team member chat banned */
  V2NIM_ERROR_CODE_TEAM_MEMBER_CHAT_BANNED: {
    code: 109424,
    message: "team member chat banned",
  },
  /* 仅允许群主操作 / team owner operation permission required */
  V2NIM_ERROR_CODE_TEAM_OWNER_OPERATION_PERMISSION_REQUIRED: {
    code: 109427,
    message: "team owner operation permission required",
  },
  /* 仅允许群主或管理员操作 / team owner or manager operation permission required */
  V2NIM_ERROR_CODE_TEAM_OWNER_OR_MANAGER_OPERATION_PERMISSION_REQUIRED: {
    code: 109432,
    message: "team owner or manager operation permission required",
  },
  /* 并发操作群成员失败 / team member concurrent operation failed */
  V2NIM_ERROR_CODE_TEAM_MEMBER_CONCURRENT_OPERATION_FAILED: {
    code: 109449,
    message: "team member concurrent operation failed",
  },
  /* 群成员反垃圾 / team member hit antispam */
  V2NIM_ERROR_CODE_TEAM_MEMBER_HIT_ANTISPAM: {
    code: 109451,
    message: "team member hit antispam",
  },

  // =========== 会话类型错误
  /* 会话与账号不匹配 / conversation and account mismatch */
  V2NIM_ERROR_CODE_CONVERSATION_AND_ACCOUNT_MISMATCH: {
    code: 110302,
    message: "conversation and account mismatch",
  },
  /* 会话置顶数量超限 / conversation stick top limit */
  V2NIM_ERROR_CODE_CONVERSATION_STICK_TOP_LIMIT: {
    code: 110303,
    message: "conversation stick top limit",
  },
  /* 会话所属分组数量超限 / conversation belonged group limit */
  V2NIM_ERROR_CODE_CONVERSATION_BELONGED_GROUP_LIMIT: {
    code: 110304,
    message: "conversation belonged group limit",
  },
  V2NIM_ERROR_CODE_CONVERSATION_IS_NOT_STICK_TOP: {
    code: 110305,
    message: "conversation is not stick top",
  },
  V2NIM_ERROR_CODE_STICK_TOP_DISABLED: {
    code: 110306,
    message: "conversation stick top disabled",
  },
  /* 会话不存在 / conversation not exist */
  V2NIM_ERROR_CODE_CONVERSATION_NOT_EXIST: {
    code: 110404,
    message: "conversation not exist",
  },

  // =========== 广播消息

  // =========== 系统消息

  // =========== 聊天室
  /* 未获取到有效聊天室连接地址 / chatroom link unavailable */
  V2NIM_ERROR_CODE_CHATROOM_LINK_UNAVAILABLE: {
    code: 113304,
    message: "chatroom link unavailable",
  },
  /* IM 连接状态异常 / IM connection abnormal */
  V2NIM_ERROR_CODE_IM_CONNECTION_ABNORMAL: {
    code: 113305,
    message: "IM connection abnormal",
  },
  /* 聊天室不存在 / chatroom not exist */
  V2NIM_ERROR_CODE_CHATROOM_NOT_EXIST: {
    code: 113404,
    message: "chatroom not exist",
  },
  /* 聊天室已关闭 / chatroom closed */
  V2NIM_ERROR_CODE_CHATROOM_CLOSED: {
    code: 113406,
    message: "chatroom closed",
  },
  /* 聊天室重复操作 / chatroom repeated operation */
  V2NIM_ERROR_CODE_CHATROOM_REPEATED_OPERATION: {
    code: 113409,
    message: "chatroom repeated operation",
  },
  /* 聊天室未开通 / chatroom disabled */
  V2NIM_ERROR_CODE_CHATROOM_DISABLED: {
    code: 113410,
    message: "chatroom disabled",
  },
  /* 聊天室全体禁言 / all chatroom member chat banned */
  V2NIM_ERROR_CODE_ALL_CHATROOM_MEMBER_CHAT_BANNED: {
    code: 113423,
    message: "all chatroom member chat banned",
  },
  /* 聊天室反垃圾 / chatroom hit antispam */
  V2NIM_ERROR_CODE_CHATROOM_HIT_ANTISPAM: {
    code: 113451,
    message: "chatroom hit antispam",
  },

  // ============= 聊天室成员
  /* 匿名成员禁止操作 / anonymous member forbidden */
  V2NIM_ERROR_CODE_ANONYMOUS_MEMBER_FORBIDDEN: {
    code: 114303,
    message: "anonymous member forbidden",
  },
  /* 聊天室成员不存在 / chatroom member not exist */
  V2NIM_ERROR_CODE_CHATROOM_MEMBER_NOT_EXIST: {
    code: 114404,
    message: "chatroom member not exist",
  },
  /* 聊天室成员重复操作 / chatroom member repeated operation */
  V2NIM_ERROR_CODE_CHATROOM_MEMBER_REPEATED_OPERATION: {
    code: 114405,
    message: "chatroom member repeated operation",
  },
  /* 聊天室成员禁言 / chatroom member chat banned */
  V2NIM_ERROR_CODE_CHATROOM_MEMBER_CHAT_BANNED: {
    code: 114421,
    message: "chatroom member chat banned",
  },
  /* 账号在聊天室黑名单中 / account in chatroom block list */
  V2NIM_ERROR_CODE_ACCOUNT_IN_CHATROOM_BLOCK_LIST: {
    code: 114426,
    message: "account in chatroom block list",
  },
  /* 仅允许聊天室所有者操作 / chatroom owner operation permission required */
  V2NIM_ERROR_CODE_CHATROOM_OWNER_OPERATION_PERMISSION_REQUIRED: {
    code: 114427,
    message: "chatroom owner operation permission required",
  },
  /* 聊天室成员操作包含自己 / self in chatroom member operation list */
  V2NIM_ERROR_CODE_SELF_IN_CHATROOM_MEMBER_OPERATION_LIST: {
    code: 114429,
    message: "self in chatroom member operation list",
  },
  /* 仅允许聊天室所有者或管理员操作 / chatroom owner or manager operation permission required */
  V2NIM_ERROR_CODE_CHATROOM_OWNER_OR_MANAGER_OPERATION_PERMISSION_REQUIRED: {
    code: 114432,
    message: "chatroom owner or manager operation permission required",
  },
  /* 聊天室成员数量超限 / chatroom member limit */
  V2NIM_ERROR_CODE_CHATROOM_MEMBER_LIMIT: {
    code: 114437,
    message: "chatroom member limit",
  },
  /* 并发操作聊天室成员失败 / chatroom member concurrent operation failed */
  V2NIM_ERROR_CODE_CHATROOM_MEMBER_CONCURRENT_OPERATION_FAILED: {
    code: 114449,
    message: "chatroom member concurrent operation failed",
  },
  /* 聊天室成员反垃圾 / chatroom member hit antispam */
  V2NIM_ERROR_CODE_CHATROOM_MEMBER_HIT_ANTISPAM: {
    code: 114451,
    message: "chatroom member hit antispam",
  },

  // =========== 会话分组类型错误
  /* 会话分组不存在 / conversation group not exist */
  V2NIM_ERROR_CODE_CONVERSATION_GROUP_NOT_EXIST: {
    code: 116404,
    message: "conversation group not exist",
  },
  /* 会话分组超限 / conversation group limit */
  V2NIM_ERROR_CODE_CONVERSATION_GROUP_LIMIT: {
    code: 116435,
    message: "conversation group limit",
  },
  /* 会话分组中的会话数量超限 / conversations in group limit */
  V2NIM_ERROR_CODE_CONVERSATIONS_IN_GROUP_LIMIT: {
    code: 116437,
    message: "conversations in group limit",
  },

  // 其他
  /* 收藏数量超限 / collection limit */
  V2NIM_ERROR_CODE_COLLECTION_LIMIT: {
    code: 189301,
    message: "collection limit",
  },
  /* 收藏不存在 / collection not exist */
  V2NIM_ERROR_CODE_COLLECTION_NOT_EXIST: {
    code: 189302,
    message: "collection not exist",
  },
  /* 并发操作收藏失败 / collection concurrent operation failed */
  V2NIM_ERROR_CODE_COLLECTION_CONCURRENT_OPERATION_FAILED: {
    code: 189449,
    message: "collection concurrent operation failed",
  },

  // ========= 通用类型错误
  /* 内部错误 / internal error */
  V2NIM_ERROR_CODE_INTERNAL: {
    code: 190001,
    message: "internal error",
  },
  /* 非法状态 / illegal state */
  V2NIM_ERROR_CODE_ILLEGAL_STATE: {
    code: 190002,
    message: "illegal state",
  },

  // ========= 接口类型错误
  /* 使用姿势错误 / misuse */
  V2NIM_ERROR_CODE_MISUSE: {
    code: 191001,
    message: "misuse",
  },
  /* 操作取消 / operation cancelled */
  V2NIM_ERROR_CODE_CANCELLED: {
    code: 191002,
    message: "operation cancelled",
  },
  /* 回调失败 / callback failed */
  V2NIM_ERROR_CODE_CALLBACK_FAILED: {
    code: 191003,
    message: "callback failed",
  },
  /* 参数错误 / invalid parameter */
  V2NIM_ERROR_CODE_INVALID_PARAMETER: {
    code: 191004,
    message: "invalid parameter",
  },
  /* 超时 / timeout */
  V2NIM_ERROR_CODE_TIMEOUT: {
    code: 191005,
    message: "timeout",
  },
  /* 资源不存在 / resource not exist */
  V2NIM_ERROR_CODE_RESOURCE_NOT_EXIST: {
    code: 191006,
    message: "resource not exist",
  },
  /* 资源已存在 / resource already exist */
  V2NIM_ERROR_CODE_RESOURCE_ALREADY_EXIST: {
    code: 191007,
    message: "resource already exist",
  },

  // ========= 连接类型错误
  /* 连接错误 / connect failed */
  V2NIM_ERROR_CODE_CONNECT_FAILED: {
    code: 192001,
    message: "connect failed",
  },
  /* 连接超时 / connect timeout */
  V2NIM_ERROR_CODE_CONNECT_TIMEOUT: {
    code: 192002,
    message: "connect timeout",
  },
  /* 连接断开 / disconnect */
  V2NIM_ERROR_CODE_DISCONNECT: {
    code: 192003,
    message: "disconnect",
  },
  /* 协议超时 / protocol timeout */
  V2NIM_ERROR_CODE_PROTOCOL_TIMEOUT: {
    code: 192004,
    message: "protocol timeout",
  },
  /* 协议发送失败 / protocol send failed */
  V2NIM_ERROR_CODE_PROTOCOL_SEND_FAILED: {
    code: 192005,
    message: "protocol send failed",
  },
  /* 请求失败 / request failed */
  V2NIM_ERROR_CODE_REQUEST_FAILED: {
    code: 192006,
    message: "request failed",
  },

  // ============= 跳过数据库错误

  // =========== 文件类型错误
  /* 文件不存在 / file not found */
  V2NIM_ERROR_CODE_FILE_NOT_FOUND: {
    code: 194001,
    message: "file not found",
  },
  /* 文件创建失败 / file create failed */
  V2NIM_ERROR_CODE_FILE_CREATE_FAILED: {
    code: 194002,
    message: "file create failed",
  },
  /* 文件打开失败 / file open failed */
  V2NIM_ERROR_CODE_FILE_OPEN_FAILED: {
    code: 194003,
    message: "file open failed",
  },
  /* 文件写入失败 / file write failed */
  V2NIM_ERROR_CODE_FILE_WRITE_FAILED: {
    code: 194004,
    message: "file write failed",
  },
  /* 文件读取失败 / file read failed */
  V2NIM_ERROR_CODE_FILE_READ_FAILED: {
    code: 194005,
    message: "file read failed",
  },
  /* 文件上传失败 / file upload failed */
  V2NIM_ERROR_CODE_FILE_UPLOAD_FAILED: {
    code: 194006,
    message: "file upload failed",
  },
  /* 文件下载失败 / file download failed */
  V2NIM_ERROR_CODE_FILE_DOWNLOAD_FAILED: {
    code: 194007,
    message: "file download failed",
  },

  // ============ 反垃圾
  /* 客户端反垃圾 / client anti-spam */
  V2NIM_ERROR_CODE_CLIENT_ANTISPAM: {
    code: 195001,
    message: "client anti-spam",
  },
  /* 云端反垃圾 / server anti-spam */
  V2NIM_ERROR_CODE_SERVER_ANTISPAM: {
    code: 195002,
    message: "server anti-spam",
  },
};

// 错误码映射
// export const V2NIMErrorCode = mapValues(V2NIMErrorMap, 'code') as {
//   [key in keyof typeof V2NIMErrorMap]: number
// }
const keys = Object.keys(V2NIMErrorMap) as (keyof typeof V2NIMErrorMap)[];
export const V2NIMErrorCode = keys.reduce(
  function (total, key) {
    const value = V2NIMErrorMap[key];
    total[key] = value.code;
    return total;
  },
  {} as { [key in keyof typeof V2NIMErrorMap]: number }
);

export const V2NIMErrorDesc = keys.reduce(function (total, key) {
  const value = V2NIMErrorMap[key];
  total[value.code] = value.message;
  return total;
}, {} as any);

import { V2NIMDataSyncLevel, V2NIMDataSyncType, V2NIMDataSyncState } from "node-nim";
import { V2NIMConversationType, V2NIMLastMessageState } from "node-nim";
import {
  V2NIMFriendAddMode,
  // V2NIMFriendAddApplicationType,
  V2NIMFriendAddApplicationStatus,
  V2NIMFriendDeletionType,
  // V2NIMFriendVerifyType
} from "node-nim";
import {
  V2NIMLoginAuthType,
  V2NIMLoginStatus,
  V2NIMLoginClientType,
  V2NIMKickedOfflineReason,
  V2NIMLoginClientChange,
  V2NIMConnectStatus,
} from "node-nim";
import {
  V2NIMMessageType,
  V2NIMMessageNotificationType,
  V2NIMMessageAttachmentUploadState,
  V2NIMMessageSendingState,
  V2NIMQueryDirection,
  V2NIMMessageRevokeType,
  V2NIMMessagePinState,
  V2NIMMessageQuickCommentType,
  V2NIMClientAntispamOperateType,
  V2NIMSortOrder,
  // V2NIMSystemMessageType
} from "node-nim";
import { V2NIMTeamMessageMuteMode, V2NIMP2PMessageMuteMode } from "node-nim";
import {
  V2NIMTeamMemberRoleQueryType,
  V2NIMTeamType,
  V2NIMTeamJoinMode,
  V2NIMTeamAgreeMode,
  V2NIMTeamInviteMode,
  V2NIMTeamUpdateInfoMode,
  V2NIMTeamChatBannedMode,
  V2NIMTeamUpdateExtensionMode,
  V2NIMTeamJoinActionType,
  V2NIMTeamJoinActionStatus,
  // V2NIMTeamNotificationType,
  V2NIMTeamMemberRole,
  V2NIMSearchKeywordMathType,
  V2NIMSearchDirection,
  V2NIMSearchStrategy,
} from "node-nim";

export { V2NIMAIModelRoleType, V2NIMAIModelType } from "node-nim";
export { V2NIMSignallingChannelType, V2NIMSignallingEventType } from "node-nim";
export { V2NIMUserStatusType } from "node-nim";

export const V2NIMConst = {
  V2NIMDataSyncLevel,
  V2NIMDataSyncType,
  V2NIMDataSyncState,
  V2NIMConversationType,
  V2NIMLastMessageState,
  V2NIMFriendAddMode,
  // V2NIMFriendAddApplicationType,
  V2NIMFriendAddApplicationStatus,
  V2NIMFriendDeletionType,
  V2NIMLoginAuthType,
  V2NIMLoginStatus,
  V2NIMLoginClientType,
  V2NIMKickedOfflineReason,
  V2NIMLoginClientChange,
  V2NIMConnectStatus,
  V2NIMMessageType,
  V2NIMMessageNotificationType,
  V2NIMMessageAttachmentUploadState,
  V2NIMMessageSendingState,
  V2NIMQueryDirection,
  V2NIMMessageRevokeType,
  V2NIMMessagePinState,
  V2NIMMessageQuickCommentType,
  V2NIMClientAntispamOperateType,
  V2NIMSortOrder,
  // V2NIMSystemMessageType
  V2NIMTeamMessageMuteMode,
  V2NIMP2PMessageMuteMode,

  V2NIMTeamMemberRoleQueryType,
  V2NIMTeamType,
  V2NIMTeamJoinMode,
  V2NIMTeamAgreeMode,
  V2NIMTeamInviteMode,
  V2NIMTeamUpdateInfoMode,
  V2NIMTeamChatBannedMode,
  V2NIMTeamUpdateExtensionMode,
  V2NIMTeamJoinActionType,
  V2NIMTeamJoinActionStatus,
  // V2NIMTeamNotificationType,
  V2NIMTeamMemberRole,
  V2NIMSearchKeywordMathType,
  V2NIMSearchDirection,
  V2NIMSearchStrategy,
};

// 自定义的一些事件常量
export const events: { [key: string]: string } = {
  // 自己发出一条消息
  SEND_MSG: "sendMsg",
  // 发送消息失败
  SEND_MSG_FAILED: "sendMsgFailed",
  // 收到一条消息
  ON_MSG: "onMsg",
  // 加载更多
  ON_LOAD_MORE: "onLoadMore",
  // 首次进入聊天页并获取历史记录
  ON_CHAT_MOUNTED: "onChatMounted",
  // 重新编辑撤回消息
  ON_REEDIT_MSG: "onReEditMsg",
  // 页面触底
  ON_REACH_BOTTOM: "onReachBottom",
  // 页面触顶
  ON_REACH_TOP: "onReactTop",
  // 回复消息
  REPLY_MSG: "replyMsg",
  // input框聚焦
  ON_INPUT_FOCUS_CHANGE: "onInputFocusChange",
  // input框失焦
  ON_INPUT_BLUR: "onInputBlur",
  // 滚动到底部
  ON_SCROLL_BOTTOM: "onScrollBottom",
  // @群成员
  AIT_TEAM_MEMBER: "aitTeamMember",
  // 表情框弹起与收起变化
  EMOJI_AREA_CHANGE: "emojiAreaChange",
  // 获取历史消息
  GET_HISTORY_MSG: "getHistoryMsg",
  // 获取更多新消息（向下滚动加载）
  GET_NEXT_MSG: "getNextMsg",
  // 取消转发消息
  CANCEL_FORWARD_MSG: "cancelForwardMsg",
  // 确认转发消息
  CONFIRM_FORWARD_MSG: "confirmForwardMsg",
  // @消息  @群成员
  HANDLE_AIT_MEMBER: "handleAitMember",
  // 关闭@弹窗
  CLOSE_AIT_POPUP: "closeAitPopup",
  // 表情点击
  EMOJI_CLICK: "emojiClick",
  // 表情删除
  EMOJI_DELETE: "emojiDelete",
  // 表情发送
  EMOJI_SEND: "emojiSend",
  // 好友选择
  FRIEND_SELECT: "friendSelect",
  // 处理滚动穿透
  HANDLE_MOVE_THROUGH: "handleMoveThrough",
  // 关闭表情、语音面板
  CLOSE_PANEL: "closePanel",
  // 语音消息url改变
  AUDIO_URL_CHANGE: "audioUrlChange",
  // 关闭新消息提示tip
  CLOSE_NEW_MSG_TIP: "closeNewMsgTip",
  // 重新加载最新消息（用于从跳转状态返回）
  RELOAD_LATEST_MESSAGES: "reloadLatestMessages",
  // 头像点击
  AVATAR_CLICK: "avatarClick",
  // 重置加载更多消息状态
  RESET_LOADING_MORE_MESSAGES: "resetLoadingMoreMessages",
};

export const HISTORY_LIMIT = 15;

export const SEARCH_HISTORY_LIMIT = 50;

export const MSG_ID_FLAG = "message-item-";

export const AT_ALL_ACCOUNT = "ait_all";

export const ALLOW_AT = "yxAllowAt";

export const REPLY_MSG_TYPE_MAP: { [key: number]: string } = {
  [V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_IMAGE]: t("imgMsgText"),
  [V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_AUDIO]: t("audioMsgText"),
  [V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_VIDEO]: t("videoMsgText"),
  [V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_FILE]: t("fileMsgText"),
};

export const STORAGE_KEY = "__yx_im_options_pc_vue3";

export const callTypeMap = {
  audio: "1",
  video: "2",
};

export const g2StatusMap: any = {
  1: t("callDurationText"),
  2: t("callCancelText"),
  3: t("callRejectedText"),
  4: t("callTimeoutText"),
  5: t("callBusyText"),
};

export const msgRecallTime = 2 * 60 * 1000;

export const APP_KEY = "";

export const NEUIKIT_VERSION = "10.1.0-beta";

export const NESDK_VERSION = sdkpkg.version;
