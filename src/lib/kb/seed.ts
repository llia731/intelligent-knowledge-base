import type { ApiKey, AuditEntry, DemoUser, KbDoc, ReviewItem } from "./types";
import { chunkText } from "./chunk";

const now = "2026-11-01T09:30:00.000Z";

function doc(
  id: string,
  title: string,
  collection: string,
  sensitivity: KbDoc["sensitivity"],
  content: string,
): KbDoc {
  return {
    id,
    title,
    collection,
    content,
    status: "indexed",
    sensitivity,
    owner: "知识运营",
    updatedAt: now,
    chunks: chunkText(content, 280, 40),
    shareNote: "",
  };
}

export const SEED_DOCS: KbDoc[] = [
  doc(
    "doc_leave",
    "年假政策说明",
    "入职指引合集",
    "internal",
    `公司员工年假标准如下。
入职满 1 年、不满 10 年的，全年年休假 5 天。
满 10 年、不满 20 年的，全年年休假 10 天。
满 20 年的，全年年休假 15 天。
试用期员工不享受年假。转正后按入职日起算，当年可休天数按在职日历天数折算，不足 1 天的部分不累计。
员工申请年假需提前 3 个工作日在工作台提交，直属上级审批后生效。
未休年假可累计至次年，上限为 5 天，超出部分视同放弃，不折现。
法定节假日不计入年假。`,
  ),
  doc(
    "doc_expense",
    "如何申请报销",
    "财务报销百问百答",
    "internal",
    `费用报销入口：工作台 → 财务 → 报销单。
差旅必须事前审批，未审批的机票和酒店不予报销。
发票抬头统一为「智识科技有限公司」，税号见财务公告栏，抬头不一致的票据退回。
餐饮招待人均不超过 150 元，需注明参与人与事由。
单据齐全后 5 个工作日内打入工资卡。
电子发票与纸质发票不可重复提交。遗失发票需部门负责人签字说明，单笔超过 500 元须补充支付记录。`,
  ),
  doc(
    "doc_probation",
    "试用期转正需要准备什么",
    "入职指引合集",
    "public",
    `标准试用期为 6 个月，校招特殊岗位可在录用函中约定为 3 个月。
转正前 10 个工作日提交述职，材料包括：试用期目标完成情况、导师评价、必修培训记录。
审批链路为直属上级、部门负责人、HR 三方。任一方驳回需在 5 个工作日内补充材料。
转正通过后次月起按转正薪资计发，年假从入职日折算，不从转正日重新计算。
未通过的，HR 会在反馈中说明改进项或结束日期。`,
  ),
  doc(
    "doc_it",
    "IT 设备报修流程",
    "产品帮助中心",
    "public",
    `报修入口有两个：内线 8001，或工单系统 it.zhishi.local。
提交时填写资产编号、故障现象和是否影响办公。
无法开机、整机无网络属于紧急单，工作时间内 2 小时响应。
一般软件故障先远程处理，远程无法解决再预约现场。
硬件更换必须核对资产编号，私自拆机不在保修范围。
配件到货后由 IT 上门更换，旧件收回资产库。`,
  ),
  doc(
    "doc_room",
    "会议室怎么预定",
    "产品帮助中心",
    "public",
    `会议室在企业微信工作台中预定，路径：工作台 → 行政 → 会议室。
单次预定最长 2 小时。开始后 15 分钟无人签到，系统自动释放。
容纳 8 人及以上的会议室需要行政审批，审批通常 1 个工作日内完成。
投影与视频会议设备故障，按 IT 设备报修流程提单，不要在会议室预约里备注代替报修。`,
  ),
  doc(
    "doc_secret",
    "知识密级与召回规则",
    "制度库",
    "restricted",
    `知识分三级：公开、内部、受限。
公开知识全员可检索、可问答。
内部知识面向在职员工，不通过外部 API 密钥返回。
受限知识仅管理员角色可召回。普通员工提问时，受限切片不得进入回答上下文。
上传文档会自动检测身份证号、银行卡号和「机密」「薪资明细」等敏感词。
命中后文档进入人工复核，复核通过前不可被问答引用。
回答必须标注来源标题。无法在已授权切片中找到依据时，应明确说明知识库没有足够依据，禁止编造数字。`,
  ),
];

export const SEED_USERS: DemoUser[] = [
  {
    id: "u1",
    name: "李建国",
    email: "li.jianguo@company.com",
    dept: "平台运营部",
    roleLabel: "系统管理员",
    enabled: true,
    lastLogin: "2026-09-15 09:41",
  },
  {
    id: "u2",
    name: "王雅婷",
    email: "wang.yating@company.com",
    dept: "产品部",
    roleLabel: "知识库管理员",
    enabled: true,
    lastLogin: "2026-09-15 08:56",
  },
  {
    id: "u3",
    name: "陈志强",
    email: "chen.zhiqiang@company.com",
    dept: "内容安全部",
    roleLabel: "内容审核员",
    enabled: true,
    lastLogin: "2026-09-14 18:12",
  },
  {
    id: "u4",
    name: "刘敏",
    email: "liu.min@company.com",
    dept: "客服中心",
    roleLabel: "普通用户",
    enabled: false,
    lastLogin: "—",
  },
  {
    id: "u5",
    name: "赵晓东",
    email: "zhao.xiaodong@company.com",
    dept: "技术研发部",
    roleLabel: "API 开发者",
    enabled: false,
    lastLogin: "2026-09-13 14:30",
  },
];

export const SEED_REVIEWS: ReviewItem[] = [
  {
    id: "rv1",
    title: "薪酬带宽说明草稿",
    reason: "命中敏感词「薪资明细」，等待人工复核",
    status: "open",
    createdAt: "2026-11-03T02:10:00.000Z",
  },
];

export const SEED_LOGS: AuditEntry[] = [
  {
    id: "log1",
    actor: "王雅婷",
    action: "索引文档",
    target: "年假政策说明",
    result: "成功",
    createdAt: "2026-11-01T09:30:00.000Z",
  },
  {
    id: "log2",
    actor: "陈志强",
    action: "拦截上传",
    target: "薪酬带宽说明草稿",
    result: "进入复核",
    createdAt: "2026-11-03T02:10:00.000Z",
  },
];

export const SEED_KEYS: ApiKey[] = [
  {
    id: "key1",
    name: "官网搜索组件",
    scopes: ["读取"],
    createdAt: "2026-09-12",
    calls: 12840,
    secretPreview: "zsk_live_····8f2a",
  },
  {
    id: "key2",
    name: "企业微信机器人",
    scopes: ["读取"],
    createdAt: "2026-10-02",
    calls: 4302,
    secretPreview: "zsk_live_····11c0",
  },
];

export const COLLECTIONS = [
  "入职指引合集",
  "财务报销百问百答",
  "产品帮助中心",
  "制度库",
];
