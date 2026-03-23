import type { ActionKey, GateMode, Representative } from "./schema";

const defaultActionGate: Record<ActionKey, GateMode> = {
  answer_faq: "allow",
  collect_lead: "allow",
  collect_quote_request: "allow",
  collect_scheduling_request: "allow",
  deliver_material: "allow",
  request_handoff: "allow",
  charge_stars: "allow",
  issue_refund: "ask_first",
  offer_discount: "ask_first",
  send_sensitive_material: "ask_first",
  modify_owner_calendar: "deny",
  run_local_command: "deny",
  access_private_memory: "deny",
  access_private_files: "deny",
  send_outbound_campaign: "deny",
};

export const demoRepresentative: Representative = {
  id: "rep_lin_founder",
  slug: "lin-founder-rep",
  ownerName: "Lin",
  name: "Lin 的 Telegram 对外代表",
  tagline: "用公开知识回答问题、筛选合作线索、收集需求，并在需要时转真人。",
  tone: "清晰、直接、礼貌，优先给出下一步，而不是泛泛闲聊。",
  languages: ["zh-CN", "en"],
  skills: [
    "faq_reply",
    "lead_qualify",
    "intake_collect",
    "quote_request_collect",
    "material_delivery",
    "scheduling_request",
    "human_handoff",
    "paid_unlock",
  ],
  knowledgePack: {
    identitySummary:
      "Lin 是一位专注 AI automation 和业务流程设计的创始人，主要帮助小团队把重复 inbound 和服务型流程结构化。",
    faq: [
      {
        id: "faq_who",
        title: "你们是做什么的？",
        kind: "faq",
        summary: "提供 AI automation 设计、代表型 agent 体验设计和落地咨询。",
      },
      {
        id: "faq_fit",
        title: "什么类型的客户最适合？",
        kind: "faq",
        summary: "有稳定 inbound、需要标准化接待、又不想暴露私有系统的团队最适合。",
      },
      {
        id: "faq_boundary",
        title: "代表能做什么，不能做什么？",
        kind: "faq",
        summary: "能回答 FAQ、收集线索和需求、发资料、触发付费与转人工；不能访问私有文件、账号或本地环境。",
      },
    ],
    materials: [
      {
        id: "material_intro",
        title: "一页式服务介绍",
        kind: "deck",
        summary: "概述服务对象、交付形式与合作方式。",
        url: "https://example.com/intro",
      },
      {
        id: "material_cases",
        title: "案例与场景列表",
        kind: "case_study",
        summary: "展示 inbound handling、资格筛选和对外代表场景。",
        url: "https://example.com/cases",
      },
    ],
    policies: [
      {
        id: "policy_scope",
        title: "服务边界",
        kind: "policy",
        summary: "不直接承诺高价值报价，不代替主人登录账户，也不修改真实日历。",
      },
      {
        id: "policy_handoff",
        title: "转人工规则",
        kind: "policy",
        summary: "复杂合作、退款、折扣、敏感材料和加急请求会进入人工评估。",
      },
    ],
  },
  contract: {
    freeReplyLimit: 4,
    freeScope: ["faq", "materials", "unknown"],
    paywalledIntents: ["pricing", "collaboration", "scheduling"],
    handoffWindowHours: 24,
  },
  pricing: [
    {
      tier: "free",
      name: "Free",
      stars: 0,
      summary: "首次接触、基础问答、少量资料领取。",
      includedReplies: 4,
      includesPriorityHandoff: false,
    },
    {
      tier: "pass",
      name: "Pass",
      stars: 180,
      summary: "继续追问、完成需求采集、拿到更明确的下一步。",
      includedReplies: 12,
      includesPriorityHandoff: false,
    },
    {
      tier: "deep_help",
      name: "Deep Help",
      stars: 680,
      summary: "更长上下文、更深需求梳理、可附带优先人工评估。",
      includedReplies: 36,
      includesPriorityHandoff: true,
    },
    {
      tier: "sponsor",
      name: "Sponsor",
      stars: 1200,
      summary: "为代表的公共额度池充值，帮助更多人先免费得到答复。",
      includedReplies: 0,
      includesPriorityHandoff: false,
    },
  ],
  handoffPrompt:
    "请留下你的身份、需求摘要、预算区间、目标时间，以及为什么需要真人接手。我会先整理成收件项再转给主人。",
  actionGate: defaultActionGate,
};
