# 仓库协作指南

## 项目说明

Agnes Studio 是一个基于 React、assistant-ui、Tailwind CSS、shadcn/ui 和 Cloudflare Workers 的 AgnesAI 多模态体验平台。前端和 Cloudflare Worker 一起部署，Worker 负责代理 AgnesAI API 请求。

## 开发约定

- 使用 `pnpm` 管理依赖。
- 文本、图像、视频三种模式的逻辑需要保持分离，便于阅读和维护。
- 不要把 AgnesAI API Key 存到 Worker、源码、配置文件或仓库里。用户提供的 Key 只通过请求头发送；只有用户主动选择“在此设备记住 Key”时，才允许保存在浏览器 localStorage。
- 生成产物、本地 Workers 状态和依赖目录不要进入 git：`dist`、`.wrangler`、`node_modules` 必须保持忽略。

## 验证命令

功能性改动提交前至少运行：

```bash
pnpm typecheck
pnpm build
```

修改模型元数据或已有测试覆盖的逻辑时，运行：

```bash
pnpm test
```

## Git 与部署

- 功能开发使用需求分支，通过 PR 合并到 `main`。
- `main` 是生产分支。
- PR 阶段由 GitHub Actions 运行 CI。
- 合并到 `main` 后，由 GitHub Actions 部署到 Cloudflare。
- Cloudflare 凭证必须配置为 GitHub Actions Secrets，不能提交到仓库。
- 未经用户明确要求，不要执行 commit、push、merge、rebase、tag、release 或部署操作。
