# Yvette Grok Agent

In-Mattermost AI agent (Slackbot-like) backed by Grok Chat. This is a **sibling demo plugin** — plugin id `com.yvette.grok-agent` — and does **not** replace official `mattermost-ai` / Agents Bridge.

**YJIRA-28 AC-2:** **Ask Grok** sits in the left sidebar immediately above Invite Members (expanded Direct Messages category) and opens a chat modal. Path A surfaces stay: `@yvette-grok`, bot DMs, and `/yvette`.

## Install

1. Build the bundle from this directory (standalone; does not `make` the full server):

   ```bash
   cd yvette-grok-agent
   make dist
   ```

   Output: `dist/com.yvette.grok-agent-0.2.0.tar.gz` (includes `webapp/dist/main.js`).

2. In Mattermost System Console → Plugins → Plugin Management → Upload Plugin, upload the tar.gz.
3. Open the plugin settings, set **Yvette Grok API key** (`YvetteGrokAPI`), then Enable Plugin.

This plugin registers `LeftSidebarAboveInviteMembers`. That slot is a **minimal core webapp Pluggable** (not in stock Mattermost). The matching patch lives in this repo:

- `webapp/channels/src/plugins/registry.ts` — `registerLeftSidebarAboveInviteMembersComponent`
- `webapp/channels/src/types/store/plugins.ts` + plugins reducer
- `webapp/channels/src/components/sidebar/sidebar_category/sidebar_category.tsx` — `<Pluggable pluggableName='LeftSidebarAboveInviteMembers'/>` immediately before Invite Members

Without that core patch, the modal still loads via `registerRootComponent`, but the LHS button will not appear.

Minimum Mattermost server: 6.0.0. Plugin toolchain matches `server/.go-version` (Go 1.26.3).

## Chat modal

- Expand **Direct Messages** → **Ask Grok** is directly above Invite Members (still visible if the user cannot invite).
- Collapse DMs → both Ask Grok and Invite Members hide.
- Click opens a root modal. `POST /plugins/com.yvette.grok-agent/api/v1/chat` reuses the Path A intent/history/Grok pipeline. Requires `Mattermost-User-Id` and channel membership (same B1 discipline as `/dialog`).

## Secrets

Plugin-held only (no per-user OAuth). Empty settings fall back to process environment. **Never commit secrets** or log their values.

| Setting | Env aliases | Purpose |
|---|---|---|
| `YvetteGrokAPI` (secret) | `YvetteGrokAPI`, `YVETTE_GROK_API` | xAI Bearer token for `POST {GrokBaseURL}/chat/completions` |
| `GrokModel` | — | Default `grok-4` |
| `GrokBaseURL` | — | Default `https://api.x.ai/v1` |
| `GitHubToken` (secret) | `GitHubToken`, `GITHUB_TOKEN` | Read `yvettejade/mattermost` issues/PRs/contents |
| `GitHubOwner` / `GitHubRepo` | — | Defaults `yvettejade` / `mattermost` |
| `JiraBaseURL` | `JiraBaseURL`, `JIRA_BASE_URL` | Default `https://fe-anysphere-demo.atlassian.net` |
| `JiraEmail` | `JiraEmail`, `JIRA_EMAIL` | Basic auth user |
| `JiraAPIToken` (secret) | `JiraAPIToken`, `JIRA_API_TOKEN` | Basic auth token |
| `JiraProjectKey` | — | Default `YJIRA` |
| `HistoryWindowDays` | — | Default `7` |
| `HistoryMaxPosts` | — | Default `50` (hard cap 100) |
| `AgentWebhooks` | — | JSON map of agent name → webhook URL |

`YvetteGrokAPI` is required for Q&A, summarize, draft, and canvas generation. Schedule, help, GitHub/Jira cards, and route handoff posts work without it.

## Slash cheatsheet

```
/yvette help
/yvette ask <question>
/yvette summarize [thread|channel|meeting] [duration]
/yvette draft <title>
/yvette canvas <title>
/yvette schedule
/yvette jira <YJIRA-n>
/yvette github <pr|issue|#n|path>
/yvette route <agent> <brief>
```

Natural language via `@yvette-grok …` or a DM uses the same intents (summarize / catch me up / draft / canvas / schedule / route / YJIRA key / GitHub PR).

## MVP action semantics

| Action | Behavior |
|---|---|
| Q&A | Grounded in current channel/thread (≤50 posts, ≤7 days) + optional team search; cites permalinks |
| Summarize | Thread, channel, missed (`last_viewed_at`), or meeting time-window of **Mattermost posts** (not Calls transcripts) |
| Draft | Grok markdown → `UploadFile` + in-channel post |
| Canvas | Structured markdown artifact (alias of draft; titled `Canvas: …`) |
| Schedule | Interactive dialog → **in-channel meeting proposal** (no calendar write) |
| Route | Handoff post + optional HTTP POST to `AgentWebhooks` |
| GitHub / YJIRA | Read-only when referenced |

History never includes other users' DMs or this bot's own `sent_by_plugin` posts.

## KV

Dialog/session crumbs use plugin KV. Keys are never prefixed `mmi_` (reserved by `pluginapi`).

## Tests

```bash
cd yvette-grok-agent
make test
```
