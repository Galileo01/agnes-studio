# Agnes Studio

一个基于 React、assistant-ui、Tailwind CSS、shadcn/ui 与 Cloudflare Workers 的 AgnesAI 多模态体验平台。支持文本对话、图像生成与异步视频生成，并使用访问者自己的 AgnesAI API Key。

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

本地正式部署需要先完成 Cloudflare 登录，或在环境里提供 Cloudflare API Token：

```bash
pnpm exec wrangler login
pnpm deploy
```

`pnpm deploy` 会先运行生产构建，再执行 `wrangler deploy`。部署配置来自 `wrangler.jsonc`：`/api/*` 请求先走 Worker，其他路径走前端 SPA 静态资源。

## GitHub Actions

仓库包含两条流水线：

- `.github/workflows/ci.yml`：PR 阶段运行 `pnpm typecheck` 和 `pnpm build`。
- `.github/workflows/deploy.yml`：合并到 `main` 或手动触发时部署到 Cloudflare。

Cloudflare 凭证应配置在 GitHub 仓库或 `production` 环境的 Secrets 中：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

`CLOUDFLARE_API_TOKEN` 是敏感凭证，应放在 GitHub Secrets，不应放在普通 Variables 或提交到仓库。

## 安全说明

Worker 不保存 AgnesAI API Key。用户主动启用“在此设备记住 Key”时，Key 会保存在该站点的浏览器 `localStorage` 中，可在连接弹窗内清除。

价格与模型可用性会变化，发布前应重新核对 [AgnesAI 官方价格](https://agnes-ai.com/en/docs/pricing) 和 [模型文档](https://agnes-ai.com/zh-Hans/docs/overview)。
