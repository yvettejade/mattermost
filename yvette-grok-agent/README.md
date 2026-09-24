# Yvette Grok Agent

Mattermost server plugin that provides a Slackbot-class workspace agent for [YJIRA-26](https://fe-anysphere-demo.atlassian.net/browse/YJIRA-26).

This is a plugin (`yvette-grok-agent/`), not a core `server/` / `webapp/` fork. It uses a different plugin id from the core Agents Bridge / `mattermost-ai` so both can be enabled.

## Surfaces

- Bot account `yvette-grok` (created with `EnsureBot` on activate)
- `@yvette-grok` mentions and DMs with the bot
- Slash command `/yvette` (RHS is deferred)

## Actions

| Command | Behavior |
| --- | --- |
| `/yvette …` | Q&A grounded in the current channel or thread |
| `/yvette summarize` | Recap the current thread or channel |
| `/yvette catch up` | What you missed |
| `/yvette summarize meeting` | Recap-style summary of recent posts in an 8-hour meeting window (Mattermost posts, not Calls transcripts) |
| `/yvette draft …` | Draft a markdown document and upload it to the channel |
| `/yvette canvas …` | Post structured markdown the team can paste into a canvas |
| `/yvette schedule …` | Open an interactive dialog, then post an in-channel meeting proposal |
| `/yvette github` / `/yvette jira` | Surface the configured repo or YJIRA project |
| `/yvette route …` | Handoff post (and optional webhook) |
| `/yvette search …` | Optional team search, permissioned to the requesting user |

History is the current channel or thread: at most 50 posts from the last 7 days, filtered to posts the requester can read. Replies cite permalinks.

## Secrets

The Grok Chat key is read only from the `YvetteGrokAPI` environment variable (never logged or committed). Optional GitHub and Jira tokens are plugin settings held by the bot — no per-user OAuth in this MVP.

Grok Chat Completions: `https://api.x.ai/v1/chat/completions` (model `grok-3`). If the key is missing or the HTTP call fails, the agent returns a history-only fallback.

## Install

```
make test
make dist
```

Upload `dist/com.mattermost.yvette-grok-agent.tar.gz` in System Console → Plugins, or unpack it under `plugins/`. Set `YvetteGrokAPI` on the Mattermost process, then enable the plugin.
