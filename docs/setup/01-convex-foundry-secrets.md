# 01 - Convex And Foundry Secrets

## Goal

Connect the local app to Convex and give Convex the server-side model credentials it will need for embeddings and answer generation.

## What To Learn

There are two different places for configuration:

- Local app config lives in `.env.local`. This is for the Next.js app on your machine.
- Convex server config lives in Convex environment variables. This is where API keys should go when Convex functions call Microsoft Foundry or Azure OpenAI.

Do not put model API keys in `NEXT_PUBLIC_*` variables. Anything named `NEXT_PUBLIC_*` can be exposed to the browser.

## Convex MCP

Convex has a built-in MCP server in the Convex CLI. Once it is configured in Codex, an agent can use Convex tools for project inspection and environment-variable actions.

For this project, the reliable first path is still the Convex CLI:

```bash
npx convex dev
```

That command logs you in, links this repo to your Convex project, and writes the local Convex connection values.

After Convex is linked, you can add the Convex MCP server to Codex:

```bash
codex mcp add convex-nura -- npx convex mcp start --project-dir "$PWD" --disable-tools envGet
```

The `envGet` tool is disabled on purpose. The agent can still help set or list environment-variable names, but it should not be able to retrieve secret values.

## Safe Local Setup Commands

Run this first:

```bash
npx convex dev
```

Then make sure the local secrets file is private on your machine:

```bash
touch .env.local
chmod 600 .env.local
```

Convex usually writes these automatically:

```bash
grep -E '^(CONVEX_DEPLOYMENT|NEXT_PUBLIC_CONVEX_URL)=' .env.local
```

If the values are missing, rerun:

```bash
npx convex dev
```

## Foundry Values You Need

From Microsoft Foundry or Azure OpenAI, collect:

- Endpoint, for example `https://YOUR-RESOURCE.openai.azure.com`
- API key
- API surface marker: `v1`
- Embedding deployment name for `text-embedding-3-small`
- Chat deployment name for `gpt-5.4-mini`

The deployment name is whatever you named the deployment in Foundry. It may be the same as the model name, but it does not have to be.

The model version shown in the Foundry deployment table is different from the API version. For example, `2026-03-17` for `gpt-5.4-mini` and `1` for `text-embedding-3-small` are model versions. Our OpenAI-compatible API surface is `v1`.

## Put Foundry Secrets In Convex

Use interactive entry for secret values so the values do not appear in shell history:

```bash
npx convex env set AZURE_OPENAI_ENDPOINT
npx convex env set AZURE_OPENAI_API_KEY
npx convex env set AZURE_OPENAI_API_VERSION
npx convex env set AZURE_OPENAI_EMBEDDING_DEPLOYMENT
npx convex env set AZURE_OPENAI_CHAT_DEPLOYMENT
```

Check only the variable names, not the values:

```bash
npx convex env list --names-only
```

For the current dev deployment, the non-secret values are:

```text
AZURE_OPENAI_ENDPOINT=https://nura-rag-resource.services.ai.azure.com/openai/v1/
AZURE_OPENAI_API_VERSION=v1
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-5.4-mini
```

The remaining value for you to set manually is:

```bash
npx convex env set AZURE_OPENAI_API_KEY
```

## Optional Direct OpenAI Fallback

Only add this if we later decide to support direct OpenAI calls as a fallback:

```bash
npx convex env set OPENAI_API_KEY
```

## Codex Safety Guardrails

This repo has three layers of protection:

- `.gitignore` ignores `.env` and `.env.*`, including `.env.local`.
- `AGENTS.md` tells Codex not to read local secret files.
- `.codex/config.toml` defines a project permission profile that denies reads of common `.env` secret files in future trusted Codex sessions.

The project config applies after Codex reloads the project and trusts the project-local `.codex` config.
