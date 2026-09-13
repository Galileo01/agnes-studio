# Repository Guidelines

## Project

Agnes Studio is a React + assistant-ui + Tailwind + shadcn/ui playground for AgnesAI text, image, and video models. The frontend is deployed together with a Cloudflare Worker that proxies AgnesAI API requests.

## Development

- Use `pnpm` for dependency management.
- Keep text, image, and video mode logic separated for readability and maintenance.
- Do not store AgnesAI API keys in the Worker or repository. User-provided keys are sent as request headers and may only be remembered in the browser when the user enables that option.
- Keep generated output, local Workers state, and dependencies out of git: `dist`, `.wrangler`, and `node_modules` must remain ignored.

## Verification

Run these checks before committing functional changes:

```bash
pnpm typecheck
pnpm build
```

Run targeted tests when changing model metadata or logic covered by tests:

```bash
pnpm test
```

## Git and deployment

- Develop feature work on branches, then open a PR into `main`.
- `main` is the production branch.
- GitHub Actions runs CI on PRs and deploys to Cloudflare after changes land on `main`.
- Cloudflare credentials must be configured as GitHub Actions Secrets, not committed files.
