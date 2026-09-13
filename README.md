# Agnes Studio

一个基于 React、assistant-ui、Tailwind CSS、shadcn/ui 与 Cloudflare Workers 的 AgnesAI 多模态体验平台。支持文本对话、图像生成与编辑、异步视频生成，并使用访问者自己的 AgnesAI API Key。

临时在线预览：<https://agnes-studio.childlike-newt.workers.dev>。该地址由 Wrangler 临时预览账户提供，正式交付时应登录目标 Cloudflare 账户重新部署。

## 本地开发

```bash
pnpm install
pnpm dev
```

访问 Vite 输出的本地地址。API 请求通过本地 Cloudflare Worker 转发到 `https://apihub.agnes-ai.com`。

## 验证

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm preview
```

## 部署到 Cloudflare

先完成 Cloudflare 登录，再执行：

```bash
pnpm exec wrangler login
pnpm deploy
```

Worker 不保存 API Key。用户主动启用“在此设备记住 Key”时，Key 会保存在该站点的浏览器 `localStorage` 中，可在连接弹窗内清除。

价格与模型可用性会变化，发布前应重新核对 [AgnesAI 官方价格](https://agnes-ai.com/en/docs/pricing) 和 [模型文档](https://agnes-ai.com/zh-Hans/docs/overview)。
