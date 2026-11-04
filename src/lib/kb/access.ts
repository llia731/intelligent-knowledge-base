export const ACCESS_ROLES = ["普通用户", "内容审核员", "知识库管理员", "开发者", "系统管理员"] as const;

export type AccessRole = (typeof ACCESS_ROLES)[number];

export const ALL_PERMS = [
  "首页",
  "知识上传",
  "智能检索",
  "AI问答",
  "知识管理",
  "权限设置",
  "审计日志",
  "总览仪表盘",
  "用户管理",
  "角色权限",
  "知识库配置",
  "内容审核",
  "系统日志",
  "API密钥",
  "受限知识",
] as const;

export type Perm = (typeof ALL_PERMS)[number];

export const DEFAULT_GRANTS: Record<AccessRole, Perm[]> = {
  普通用户: ["首页", "知识上传", "智能检索", "AI问答", "知识管理", "审计日志"],
  内容审核员: ["首页", "智能检索", "AI问答", "内容审核", "审计日志", "系统日志", "受限知识"],
  知识库管理员: [
    "首页",
    "知识上传",
    "智能检索",
    "AI问答",
    "知识管理",
    "权限设置",
    "审计日志",
    "总览仪表盘",
    "知识库配置",
    "内容审核",
    "受限知识",
  ],
  开发者: ["首页", "智能检索", "AI问答", "API密钥", "总览仪表盘"],
  系统管理员: [...ALL_PERMS],
};

export function expandQuery(query: string, mode: string) {
  if (mode !== "同义词扩展") return query;
  const extra: string[] = [];
  const dict: Record<string, string[]> = {
    年假: ["年休假", "带薪休假"],
    报销: ["发票", "差旅"],
    转正: ["试用期", "述职"],
    报修: ["工单", "故障"],
    会议室: ["预定", "签到"],
  };
  for (const [key, values] of Object.entries(dict)) {
    if (query.includes(key)) extra.push(...values);
  }
  return extra.length ? `${query} ${extra.join(" ")}` : query;
}
