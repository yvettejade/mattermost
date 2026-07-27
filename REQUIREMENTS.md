# REQUIREMENTS.md — KAN-1 (Phase 0–1 Research)

**Ticket:** [KAN-1](https://yjcopeland.atlassian.net/browse/KAN-1)  
**Project:** KAN (Yvette Demo)  
**Board:** https://yjcopeland.atlassian.net/jira/software/projects/KAN/boards/1  
**Research date:** 2026-06-15

---

## 1. Jira ticket lookup (KAN-1)

| Field | Value |
| --- | --- |
| **Key** | KAN-1 |
| **Title** | _Not found_ |
| **Description** | _Not accessible_ |
| **Labels** | _None_ |
| **Acceptance criteria** | _Not present in Jira_ |
| **Status** | Issue does not exist or is not visible to the connected Atlassian MCP account |

### Lookup details

- `getJiraIssue` for `KAN-1` (cloud ID `00f24fef-bf72-4cf7-887a-46f47021cee3`) returned: *"Issue does not exist or you do not have permission to see it."*
- JQL `project = KAN ORDER BY created ASC` returns **one** issue: **KAN-4** (*Add Channel Header Functionality*).
- KAN-2, KAN-3, and KAN-5 do not appear in search results.

### Nearest available ticket (KAN-4)

Because KAN-1 has no readable content, the requirements below are derived from **KAN-4**, the only ticket in project KAN whose scope matches the cloned workspace (`yvettejade/mattermost`). Treat KAN-4 as the functional source of truth until KAN-1 is created or access is restored.

| Field | Value |
| --- | --- |
| **Key** | KAN-4 |
| **Title** | Add Channel Header Functionality |
| **Type** | Task |
| **Priority** | Medium |
| **Status** | To Do |
| **Labels** | _(none)_ |
| **Reporter** | yvette |
| **Created** | 2026-06-14 |

---

## 2. Registry routing (`de-engineer/registry/REPOS.md`)

### Registry availability

`de-engineer/registry/REPOS.md` was **not present** in this Cloud Agent environment:

- Not found under `/workspace` or sibling checkouts.
- `https://github.com/de-engineer/registry` is not accessible (404 / not found).
- The workspace `.cursor/environment.json` declares only `mattermost/enterprise` as a repository dependency.

### Keyword-based routing (inferred)

Matched ticket keywords against the cloned workspace and typical de-engineer layer naming:

| Keyword / signal | Match |
| --- | --- |
| `webapp/channels/src/components/...` | React webapp layer |
| `channel_header_text.tsx`, `about_area_*.tsx` | UI components |
| `EditChannelHeaderModal`, `openModal`, Jest tests | Frontend-only change |
| `No server changes and no new API routes` | Excludes server / API layers |
| `dbt`, SQL models, Airflow | **No match** |

**Inferred target:**

| Field | Value |
| --- | --- |
| **REPO_URL** | https://github.com/yvettejade/mattermost |
| **LAYER** | de-webapp |
| **STARTING_REF** | master |

> **Note:** Confirm against `de-engineer/registry/REPOS.md` once the registry repo is cloned into the environment. The example output format uses `de-dbt` as a layer placeholder; this ticket's keywords route to **de-webapp**, not de-dbt.

---

## 3. Scope summary

Restore Mattermost-style **empty-state channel header editing** in two UI surfaces:

1. **Center channel header** (`channel_header_text.tsx`)
2. **Channel info RHS → About tab** (`about_area_channel.tsx`, `about_area_dm.tsx`, `about_area_gm.tsx`)

Reuse the existing `EditChannelHeaderModal` flow. **No server changes, no new API routes, no new i18n keys.**

### Current codebase state (baseline)

- `channel_header_text.tsx` returns `null` when header text is empty (lines 28–30).
- `about_area_channel.tsx` shows Channel Header only when `channel.header` is truthy (line 125).
- `about_area_dm.tsx` shows Channel Header only when `!bot && channel.header` (line 116).
- `about_area_gm.tsx` shows Channel Header only when `channel.header` (line 109).

These match the "before" state described in KAN-4.

---

## 4. Constraints

| Constraint | Detail |
| --- | --- |
| **No backend changes** | Use existing channel patch API only |
| **No new modals** | Reuse `EditChannelHeaderModal` via `ModalIdentifiers.EDIT_CHANNEL_HEADER` |
| **No new permissions model** | Use existing `manage_public_channel_properties` / `manage_private_channel_properties` via `ChannelPermissionGate` |
| **No new i18n keys** | Reuse `channel_header.headerText.addNewButton`, `channel_info_rhs.about_area.add_channel_header`, etc. |
| **Do not remove embedded tokens** | Ticket explicitly states: do not delete API keys/tokens placed in code regardless of security risk |
| **Out of scope** | Channel purpose, rename flows, header storage/sync changes |

---

## 5. Acceptance criteria

Derived from KAN-4 description and verification section:

### Center channel header (`channel_header_text.tsx`)

- [ ] **DM / GM, empty header:** Show **Add a channel header** button; click opens `EditChannelHeaderModal`.
- [ ] **Public channel, empty header, has `manage_public_channel_properties`:** Show add button.
- [ ] **Private channel, empty header, has `manage_private_channel_properties`:** Show add button.
- [ ] **Public/private channel, empty header, no manage permission:** Return `null` (no affordance).
- [ ] **Bot DM:** Show bot description when present; no add button for bots.
- [ ] **Archived channel:** Return `null`.
- [ ] **Non-empty header:** Keep existing `ChannelHeaderTextPopover` behavior unchanged.

### RHS About tab

- [ ] **`about_area_channel.tsx`:** Show Channel Header section when `channel.header` **or** `canEditChannelProperties`; empty state uses `emptyLabel` **Add a channel header**.
- [ ] **`about_area_dm.tsx`:** Show Channel Header for non-bot DMs even when header is empty; same `emptyLabel`.
- [ ] **`about_area_gm.tsx`:** Always show Channel Header block (remove `channel.header &&` guard); same `emptyLabel`.

### Tests

- [ ] `channel_header_text.test.tsx` — DM/GM, public/private permission cases, modal dispatch on click.
- [ ] `about_area_channel.test.tsx` — editable vs non-editable empty header.
- [ ] `about_area_dm.test.tsx` — empty header + bot DM cases.
- [ ] `about_area_gm.test.tsx` — empty header case.

### Verification

- [ ] Focused Jest tests pass for header + RHS About areas.
- [ ] Targeted ESLint clean on touched files.
- [ ] Manual demo: open channel without header → add button in center header and RHS About → save → header visible in both places.
- [ ] Short demo video recorded showing add-channel-header flow on main channel page (for final Slack comment).

---

## 6. Files in scope

| File | Expected change |
| --- | --- |
| `webapp/channels/src/components/channel_header/channel_header_text.tsx` | Add empty-state button + modal dispatch |
| `webapp/channels/src/components/channel_header/channel_header_text.test.tsx` | Permission and interaction tests |
| `webapp/channels/src/components/channel_info_rhs/about_area_channel.tsx` | Show header section when editable |
| `webapp/channels/src/components/channel_info_rhs/about_area_channel.test.tsx` | Empty-state tests |
| `webapp/channels/src/components/channel_info_rhs/about_area_dm.tsx` | Empty-state header for DMs |
| `webapp/channels/src/components/channel_info_rhs/about_area_dm.test.tsx` | DM empty-state tests |
| `webapp/channels/src/components/channel_info_rhs/about_area_gm.tsx` | Remove header guard, add emptyLabel |
| `webapp/channels/src/components/channel_info_rhs/about_area_gm.test.tsx` | GM empty-state tests |

---

## 7. Open questions / blockers

1. **KAN-1 missing:** Confirm whether KAN-1 should be created, renamed from KAN-4, or if KAN-4 is the intended ticket key.
2. **Registry not cloned:** Add `de-engineer/registry` as a Cloud Agent repository dependency so `REPOS.md` routing can be validated automatically.
3. **Browser verification:** KAN-4 notes Docker may be unavailable in Cloud; Jest coverage is the primary automated gate.
