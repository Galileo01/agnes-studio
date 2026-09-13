export type ModelKind = "text" | "image" | "video";
export type PriceStatus = "free" | "limited-free" | "paid" | "unknown";

export interface ModelDefinition {
  id: string;
  name: string;
  kind: ModelKind;
  priceStatus: PriceStatus;
  description: string;
  tags: string[];
  docsUrl: string;
  priceNote: string;
}

export const PRICING_VERIFIED_AT = "2026-09-13";
export const PRICING_URL = "https://agnes-ai.com/en/docs/pricing";
export const PLATFORM_URL = "https://platform.agnes-ai.com/";
export const DOCS_URL = "https://agnes-ai.com/zh-Hans/docs/overview";
export const REPO_URL = "https://github.com/AgnesAI-Labs/AgnesAI-Models";

export const models: ModelDefinition[] = [
  { id: "agnes-3.0-flash", name: "Agnes 3.0 Flash", kind: "text", priceStatus: "free", description: "新一代 Agent 与编程模型，强调工具编排和稳定交付。", tags: ["512K 上下文", "推理", "看图"], docsUrl: "https://agnes-ai.com/zh-Hans/docs/agnes-30-flash", priceNote: "输入与输出 Token 当前均为 $0" },
  { id: "agnes-2.5-flash", name: "Agnes 2.5 Flash", kind: "text", priceStatus: "free", description: "适合编码、推理、多轮对话和通用 Agent 工作流。", tags: ["512K 上下文", "流式", "工具调用"], docsUrl: "https://agnes-ai.com/zh-Hans/docs/agnes-25-flash", priceNote: "输入与输出 Token 当前均为 $0" },
  { id: "agnes-2.5-pro", name: "Agnes 2.5 Pro", kind: "text", priceStatus: "paid", description: "面向高级编码、科学推理和长上下文分析的商业模型。", tags: ["1M 上下文", "高级推理", "看图"], docsUrl: "https://agnes-ai.com/zh-Hans/docs/agnes-25-pro", priceNote: "按输入、缓存和输出 Token 计费" },
  { id: "agnes-2.5-pro-beta", name: "Agnes 2.5 Pro Beta", kind: "text", priceStatus: "paid", description: "2.5 Pro 的 Beta 版本，使用独立 Beta 定价。", tags: ["推理", "编码", "Beta"], docsUrl: "https://agnes-ai.com/zh-Hans/docs/agnes-25-pro-beta", priceNote: "按 Beta 价格计费" },
  { id: "agnes-2.0-flash", name: "Agnes 2.0 Flash", kind: "text", priceStatus: "unknown", description: "兼容已有接入的上一代文本与视觉语言模型。", tags: ["256K 上下文", "流式", "看图"], docsUrl: "https://agnes-ai.com/en/docs/agnes-20-flash", priceNote: "请以账户控制台为准" },
  { id: "agnes-1.5-flash", name: "Agnes 1.5 Flash", kind: "text", priceStatus: "unknown", description: "低延迟文本生成与简单多模态任务。", tags: ["低延迟", "256K 上下文"], docsUrl: "https://agnes-ai.com/en/docs/agnes-15-flash", priceNote: "请以账户控制台为准" },
  { id: "agnes-image-2.5-flash", name: "Agnes Image 2.5 Flash", kind: "image", priceStatus: "free", description: "最新图像模型，支持生成、编辑和多图组合。", tags: ["1K–4K", "图生图", "多图组合"], docsUrl: "https://agnes-ai.com/en/docs/agnes-image-25-flash", priceNote: "所有分辨率与参考图片当前免费" },
  { id: "agnes-image-2.1-flash", name: "Agnes Image 2.1 Flash", kind: "image", priceStatus: "free", description: "擅长信息密集、复杂构图和细节丰富的视觉场景。", tags: ["1K–4K", "图像编辑", "多图组合"], docsUrl: "https://agnes-ai.com/en/docs/agnes-image-21-flash", priceNote: "所有分辨率与参考图片当前免费" },
  { id: "agnes-image-2.0-flash", name: "Agnes Image 2.0 Flash", kind: "image", priceStatus: "free", description: "快速图像生成与编辑模型。", tags: ["文生图", "图生图", "快速"], docsUrl: "https://agnes-ai.com/en/docs/agnes-image-20-flash", priceNote: "所有分辨率与参考图片当前免费" },
  { id: "agnes-video-2.5-flash", name: "Agnes Video 2.5 Flash", kind: "video", priceStatus: "limited-free", description: "快速视频生成，支持文本、关键帧及图片或音频参考。", tags: ["720P", "4–12 秒", "音画参考"], docsUrl: "https://agnes-ai.com/en/docs/agnes-video-25-flash", priceNote: "限时 $0 / 秒" },
  { id: "agnes-video-v2.0", name: "Agnes Video V2.0", kind: "video", priceStatus: "free", description: "支持文生视频、图生视频和关键帧动画。", tags: ["异步任务", "帧数控制", "图生视频"], docsUrl: "https://agnes-ai.com/en/docs/agnes-video-v20", priceNote: "当前 $0 / 秒" },
  { id: "agnes-video-2.5", name: "Agnes Video 2.5", kind: "video", priceStatus: "paid", description: "高质量多模态视频模型，支持图片、音频和视频参考。", tags: ["720P–2K", "4–12 秒", "多模态参考"], docsUrl: "https://agnes-ai.com/en/docs/agnes-video-25", priceNote: "按清晰度和总时长计费" },
];

const priceOrder: Record<PriceStatus, number> = { free: 0, "limited-free": 1, paid: 2, unknown: 3 };

export function getModels(kind: ModelKind) {
  return models.filter((model) => model.kind === kind).sort((a, b) => priceOrder[a.priceStatus] - priceOrder[b.priceStatus]);
}

export function getModel(id: string) {
  return models.find((model) => model.id === id);
}

export function isPaid(model: ModelDefinition) {
  return model.priceStatus === "paid";
}
