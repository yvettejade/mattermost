#!/usr/bin/env python3
"""Generate a Mattermost bulk-import JSONL that seeds the `demo` team with
realistic threaded conversations authored by the sampledata users.

Idempotency:
  Every imported post (root + reply) is tagged with `props.demo_seed = "v1"`.
  prepare-demo.sh strips previously-seeded posts before re-importing so this
  script can be re-run safely.

Usage:
  python3 seed-demo.py                 # writes /tmp/demo-seed.jsonl
  SEED_OUT=/path/file.jsonl python3 seed-demo.py
"""

import json
import os
import sys
import time
from typing import List, Tuple

TEAM = "demo"
OUT = os.environ.get("SEED_OUT", "/tmp/demo-seed.jsonl")
SEED_MARKER = {"demo_seed": "v1"}

NOW_MS = int(time.time() * 1000)
MIN_MS = 60 * 1000
HOUR_MS = 60 * MIN_MS
DAY_MS = 24 * HOUR_MS

# History fills the two weeks before "today". Today stays a ~3h window so the
# demo-prep threads still read as a single afternoon.
HISTORY_SPAN_MS = 14 * DAY_MS
TODAY_SPAN_MS = 3 * HOUR_MS

Thread = Tuple[str, str, str, List[Tuple[str, str]]]

# Channels created by this seed. town-square, off-topic, and demo-channel
# already exist on the demo team and are not redeclared here.
CHANNELS: List[Tuple[str, str, str]] = [
    ('proj-search', 'Search', 'Post search: lexical ranker first, embeddings behind a flag.'),
    ('proj-mobile', 'Mobile', 'iOS and Android push, badges, and deep links.'),
    ('proj-auth', 'Auth', 'Auth proxy cutover and session behavior.'),
    ('engineering', 'Engineering', 'Cross-team eng: perf, reviews, on-call, local dev.'),
    ('design-review', 'Design Review', 'Mocks and UX review before tickets are cut.'),
]

def thread(channel: str, author: str, message: str, replies: List[Tuple[str, str]]) -> Thread:
    return (channel, author, message, replies)


# Oldest -> newest. Project work from the last two weeks. Yvette is new, so
# she does not appear in this block.
HISTORY: List[Thread] = [
    thread(
        'town-square', 'kimberly.george',
        'Q3 goals doc is up. Three bets: search that people trust, mobile notifications that match desktop, and the auth proxy cutover with zero forced logouts. Comments in the doc by Friday.',
        [
            ('keith.ryan', "Search is the one I'd sequence first. The other two depend on people actually finding the threads we're changing."),
            ('diana.wagner', "I'll attach the UX notes for empty search and the notification preview to that doc today."),
            ('robert.ward', 'Auth is on the infra calendar already. Happy to keep it as a bet and not a surprise.'),
            ('karen.austin', "Can we add a non-goal? 'Rewrite the sidebar' keeps sneaking into planning and it isn't one of the three."),
            ('kimberly.george', 'Added. Sidebar virt can proceed as an engineering quality project, not a Q3 bet.'),
        ],
    ),
    thread(
        'off-topic', 'lois.harper',
        'Lunch poll for Thursday, since the usual place is closed for a private event. Options in thread, react to vote.',
        [
            ('joe.cruz', 'The ramen shop on 4th. I will campaign for this shamelessly.'),
            ('gerald.gomez', 'Counter-offer: the salad place, because I have a 2pm and ramen is a nap.'),
            ('ashley.berry', 'Ramen. We can walk the long way back.'),
            ('samuel.palmer', "I'm remote Thursday but I support ramen on principle."),
            ('lois.harper', "Ramen wins. I'll book the big table for 12:15."),
        ],
    ),
    thread(
        'off-topic', 'craig.reed',
        "Someone left a very healthy pothos on the 4th floor ledge and it is not mine. If it's unclaimed by Monday I'm adopting it and naming it Backpressure.",
        [
            ('diana.wagner', "That's mine, I brought it in for the design critique and forgot it. Please do not name my plant Backpressure."),
            ('craig.reed', 'Too late, the team has heard the name.'),
            ('bobby.watson', 'Backpressure is a better name than half the services we run.'),
            ('diana.wagner', "I'm picking it up today. The name is not coming with it."),
        ],
    ),
    thread(
        'proj-search', 'bobby.watson',
        'Kicking off the search rewrite. Proposal: stop treating Postgres `ILIKE` as the ranker. Phase 1 is a real lexical score (term frequency, recency decay, channel boost). Phase 2 is embeddings behind a config flag, default off. Doc is in the project folder — disagree in this thread before I cut tickets.',
        [
            ('keith.ryan', 'Agree on the split. Phase 2 in the same release is how this slips into next quarter.'),
            ('samuel.palmer', "Recency decay needs a ceiling. A message from yesterday shouldn't bury the canonical 'how do I' post from March."),
            ('bobby.watson', "Good constraint. I'll pin a 'channel boost + pinned-post boost' that can outrank recency. Writing it into the doc."),
            ('craig.reed', 'Where does the index live? In-process bleve got us into a memory hole on the big team last year.'),
            ('bobby.watson', 'External index, same box in dev, separate process in prod. Not inside the mattermost process.'),
            ('kimberly.george', 'Product constraint: `from:`, `in:`, and `before:` keep working on day one. People have those memorized.'),
        ],
    ),
    thread(
        'proj-search', 'keith.ryan',
        'Query syntax audit. I ran the support macros we document against a scratch parser. These have to keep working in phase 1: `from:`, `in:`, `before:`, `after:`, `on:`, and exact phrase quotes. Hashtags can stay as plain terms.',
        [
            ('bobby.watson', 'Quotes are the annoying one. The current path lowercases before matching, so "API" and "api" are the same. I\'d keep that.'),
            ('keith.ryan', "Keep it. Changing case sensitivity would look like a bug to everyone who doesn't care about search theory."),
            ('ashley.berry', "The search box help text lists a couple of operators we don't actually implement (`on:` is flaky on single-digit days). Can we fix the help text in the same PR as the parser?"),
            ('keith.ryan', "Yes. I'll own the parser and the help copy together so they can't drift."),
            ('samuel.palmer', 'Please add a test fixture of 30 real queries from the support channel. I can pull them and strip names.'),
        ],
    ),
    thread(
        'proj-search', 'samuel.palmer',
        "Index lag SLO proposal: a post is searchable within 2s p95 after create, 5s p99. Measured from `posts.createat` to a successful query, not from 'job started'. Deletes have the same budget.",
        [
            ('bobby.watson', "2s p95 is comfortable if we index off the post store hook and not a 10s poll. I'd rather fail the write visibly than poll."),
            ('craig.reed', "Don't fail the user-facing post save if the index is down. Save the post, queue the index update, alert on lag. Search being stale is better than send being broken."),
            ('samuel.palmer', "Agreed, I worded that badly. The SLO is on lag, and the failure mode is 'post exists, search is late', with a metric."),
            ('robert.ward', "I'll want that lag on the existing dashboard, not a new one. We already ignore one search dashboard."),
            ('bobby.watson', "Hook + queue it is. I'll write the failure mode into the design so nobody 'helpfully' puts the index call in the request path."),
        ],
    ),
    thread(
        'proj-search', 'craig.reed',
        "Backfill estimate for phase 1. On a copy of the demo data it's nothing. On a prod-sized fixture (48M posts) the naive walk is ~9 hours single-threaded. Batches of 500 by channel, 4 workers, looks like ~3 hours. Want a go/no-go before I write the job.",
        [
            ('bobby.watson', "Go. 3 hours is a maintenance window we can actually schedule. 9 hours is how we end up 'just leaving the job running'."),
            ('keith.ryan', "Does the job tolerate the server restarting under it? Last backfill I touched resumed from zero and we didn't notice for an hour."),
            ('craig.reed', "Checkpoint is the channel id + last post id, stored in the job data. Restart continues. I'll add a test that kills the worker mid-batch."),
            ('lori.carter', "Please post in town-square before the prod run, even if it's overnight. People panic when search results shuffle."),
            ('craig.reed', "Will do. And results shouldn't shuffle until we flip the read path. Backfill only fills the new index."),
        ],
    ),
    thread(
        'proj-search', 'ashley.berry',
        "Search result snippets are cutting mid-word and sometimes mid-emoji. I traced it to a byte slice in the highlight helper, not the CSS. Fix is 'cut on a rune boundary, prefer whitespace, never split a grapheme'. Small, but it's the thing people screenshot when they say search feels broken.",
        [
            ('diana.wagner', 'Thank you. The mid-emoji cut is what made the last round of mocks look unfinished.'),
            ('joe.cruz', "I can review. There's a similar rune bug in the thread preview we fixed in the sidebar — happy to point at the test."),
            ('ashley.berry', "Please do. I'd rather steal that test shape than invent a new one."),
            ('samuel.palmer', "While you're in there: the snippet should include the matched term even when it's at the end of a long post. Right now we always take the first 80 runes."),
            ('ashley.berry', "That's a product change, not just a bug. @kimberly.george are we allowed to center the snippet on the match?"),
            ('kimberly.george', 'Yes. Center on the first match. First-80-runes was an accident of the prototype.'),
        ],
    ),
    thread(
        'proj-search', 'kimberly.george',
        "Success metric for phase 1, so we don't declare victory on latency. Primary: search result click-through within 30s of the query. Guardrail: zero increase in 'no results' for queries that return results today. We'll read both weekly until the flag is default-on.",
        [
            ('bobby.watson', "Click-through I can log. 'Queries that return results today' needs a shadow read — run old and new, compare hit sets, don't show the new one yet."),
            ('kimberly.george', "Shadow read is exactly what I wanted and didn't know the name for. Thank you."),
            ('keith.ryan', 'Shadow read on every query will double search load. Sample 10%?'),
            ('bobby.watson', "10% is enough to catch a regression, not enough to hide one in a single channel. I'll do 100% on the demo team and 10% everywhere else."),
            ('karen.austin', 'Put the weekly numbers in the product weekly pre-read, not a separate meeting.'),
        ],
    ),
    thread(
        'proj-search', 'samuel.palmer',
        "Embeddings debate, round 2. I prototyped a sidecar that embeds the last 200 posts in a channel and reranks the lexical top-50. Quality on 'what did we decide about snacks' style queries is obviously better. Cost is a GPU or a very patient CPU, and the index is another thing to back up.",
        [
            ('bobby.watson', "This is why it's phase 2. The prototype is convincing and also not something we should block the lexical fix on."),
            ('craig.reed', "Operational objection: I'm not running a model server next to the post index until we know who gets paged when it OOMs."),
            ('kimberly.george', "Product objection is softer. The queries it wins are real. I just don't want the launch story to be 'search is different now' twice in one quarter."),
            ('keith.ryan', 'Flag default off, no UI to opt in except an admin config. If someone turns it on they own the pager.'),
            ('samuel.palmer', "I'll write the phase 2 doc as a spike with those constraints, and stop poking the phase 1 PRs with it."),
            ('diana.wagner', "If it stays admin-only, don't design a toggle into the search box. I've already been asked for one. The answer is no."),
        ],
    ),
    thread(
        'proj-search', 'bobby.watson',
        "Decision, so it isn't trapped in a doc comment: phase 1 is the lexical ranker, external index, hook-and-queue, syntax compatibility, snippet centered on the match, shadow read before we flip. Embeddings are a spike, flag off, no search-box toggle. Tickets going up today.",
        [
            ('keith.ryan', "Locked. I'll take the parser ticket."),
            ('ashley.berry', "I'll take snippets."),
            ('craig.reed', 'Backfill job is mine.'),
            ('samuel.palmer', 'Spike doc by Thursday. I will not attach it to the phase 1 epic.'),
            ('kimberly.george', "I'll write the one-paragraph launch note once shadow read has a week of data. Not before."),
        ],
    ),
    thread(
        'proj-mobile', 'lois.harper',
        "iOS badge bug, reproduced on a device and not just the simulator. Read a channel on web, badge on the phone stays at the old count until the app is foregrounded twice. Server says the membership `last_viewed_at` is updated. The phone is ignoring the websocket event when the app is backgrounded, which is expected, and then not catching up on the first resume, which isn't.",
        [
            ('joe.cruz', 'First resume uses a cached channel member from the previous session. Second resume refetches. I can confirm that in the logs from the QA build.'),
            ('lois.harper', "So the fix is 'refetch memberships on the first resume', not another push."),
            ('joe.cruz', "Yes. A push would paper over it and we'd have two sources of truth again."),
            ('gerald.gomez', "Android does refetch on resume and does not have this bug. Don't 'share' the fix downward."),
            ('robert.ward', 'If the refetch fails (offline subway), keep the stale badge rather than zeroing it. Zero is a worse lie.'),
        ],
    ),
    thread(
        'proj-mobile', 'joe.cruz',
        "Android notification collapse. One busy thread this morning generated 40 pushes. The OS stacks them, but each one still buzzes, and the QA phone on the desk has become a morale issue. Proposal: one notification per thread per 2 minutes, updated in place, plus a 'N new replies' body.",
        [
            ('lois.harper', "iOS can update in place with the same collapse id. I'll match the 2 minute window so the platforms don't diverge."),
            ('kimberly.george', "2 minutes feels long if you're actively in a conversation on the phone. Is the window 'while the thread is quiet' or 'always'?"),
            ('joe.cruz', 'Always, for v1. A smart window is a research project. The bug is the 40 buzzes.'),
            ('diana.wagner', "Body copy: '4 new replies' is better than repeating the latest message four times. I'll send strings today."),
            ('gerald.gomez', "Please don't collapse mentions of me into a generic '4 new replies' with no names. Mentions should still say who."),
            ('joe.cruz', 'Deal. Mention notifications stay specific. Ordinary replies collapse.'),
        ],
    ),
    thread(
        'proj-mobile', 'gerald.gomez',
        "QA build is eating battery on Android. Background sync is waking every 4 minutes even when the websocket is healthy. Looks like a retry loop from a 401 that we treat as 'try again soon' instead of 'stop until the next foreground'.",
        [
            ('robert.ward', '401 on the push proxy or on the API?'),
            ('gerald.gomez', 'API. Session expired, app kept the push token, sync loop never backs off past 4 minutes.'),
            ('joe.cruz', "That's the same loop that will fight the collapse work if we don't cap it. I'll put a hard stop on 401: no more background sync until foreground login."),
            ('lois.harper', "iOS has a cousin of this with a silent push. I'll check before we call the Android fix done."),
            ('gerald.gomez', 'I have a before/after battery screenshot once the cap lands. The current graph is embarrassing.'),
        ],
    ),
    thread(
        'proj-mobile', 'robert.ward',
        'Push proxy returned 401s for 11 minutes this morning after the token rotation. Messages were not lost — the devices caught up on reconnect — but we paged and the page was noisy. Rotation needs to overlap the old and new token for an hour, not cut at the minute the new one is written.',
        [
            ('craig.reed', "The rotation job deletes the old token in the same transaction as the insert. Easy to split. I'll add the overlap."),
            ('robert.ward', 'Please also stop paging on a 401 rate under 1% during a rotation window. We knew we were rotating.'),
            ('samuel.palmer', "A 'rotation in progress' flag the alerter understands is cleaner than a threshold. Thresholds get tuned until they never fire."),
            ('robert.ward', "Flag it is. I'll own the alerter side if Craig owns the job."),
            ('craig.reed', 'Mine.'),
        ],
    ),
    thread(
        'proj-mobile', 'diana.wagner',
        'Notification preview copy. Security asked us to stop putting the message body on the lock screen by default. Current default is sender + first line. Proposed default: sender + channel, body only if the user opts in. This will look like a regression to anyone who likes the preview.',
        [
            ('kimberly.george', 'Ship the stricter default. The opt-in can be in notification settings, not a modal on upgrade.'),
            ('lois.harper', "Upgrade path: existing users keep their current preview. New installs get the strict default. Don't change it under people."),
            ('diana.wagner', "That's the version I should have proposed. Existing behavior stays, new installs are strict."),
            ('karen.austin', "Write that down where support can find it. We'll get tickets either way, and 'we changed it' vs 'new installs only' are different replies."),
            ('diana.wagner', 'Support note goes in the same PR as the setting.'),
        ],
    ),
    thread(
        'proj-mobile', 'ashley.berry',
        "Deep link from a push opened the right channel in the wrong team. Repro: user is in two teams, push is for `demo`, app was last sitting in `ad-1`. We route on channel id and assume the current team. Channel ids aren't globally unique in the way the client pretends.",
        [
            ('joe.cruz', "The push payload has team id. We're dropping it on the client. I'll stop dropping it."),
            ('ashley.berry', "I'll fix the router to switch teams before opening the channel. There's a flash of the old team today; I'll try to skip that frame."),
            ('lois.harper', "iOS has the same drop. Don't fix Android only."),
            ('joe.cruz', 'Both. One payload parser, both apps.'),
            ('bobby.watson', "Add a test where the channel name exists in both teams. That's the case that looks 'fine' and is wrong."),
        ],
    ),
    thread(
        'proj-mobile', 'lois.harper',
        'Status, end of week. Badge refetch on first resume is in review. Notification collapse is specced (mentions stay specific, everything else collapses on a 2 minute window). 401 retry cap is in. Deep link team switch is in progress. Preview default is a decision, not code, yet.',
        [
            ('kimberly.george', "That's a real week. Preview default can slip to next week without hurting the Q3 bet."),
            ('joe.cruz', "I'll land collapse before I touch preview. Don't want both in one review."),
            ('gerald.gomez', "Battery graph is already better on the QA build with the 401 cap. I'll post it when the badge fix is on the same build."),
            ('robert.ward', "Token overlap ships tonight with the rotation job. Unrelated to the client work, just don't want it lost in this status."),
        ],
    ),
    thread(
        'proj-auth', 'robert.ward',
        "Auth proxy design, short version. Envoy in front, same public URL, Mattermost stops terminating SAML itself. The app still issues its own session cookie after the proxy asserts the user. We are not switching the app to 'trust a header and skip sessions'.",
        [
            ('keith.ryan', 'Good. Header-trust is how you get a very short incident report.'),
            ('craig.reed', 'Health checks have to hit Mattermost directly, not through the proxy, or a proxy deploy looks like an app outage.'),
            ('robert.ward', 'Already split. App health stays on the internal port.'),
            ('lori.carter', 'What does the user see if the proxy is up and the IdP is down?'),
            ('robert.ward', "A real error page, not a redirect loop. I'll put the copy in front of Diana before we call it done."),
        ],
    ),
    thread(
        'proj-auth', 'keith.ryan',
        'Session behavior during cutover. Requirement: nobody is logged out just because we flipped the proxy. Existing session cookies stay valid. New logins go through the proxy. Revocation (password change, explicit logout, admin revoke) keeps working through the app, not the proxy.',
        [
            ('robert.ward', "That's the plan. The proxy doesn't see the session cookie at all after login. It only handles the SAML handshake."),
            ('bobby.watson', 'Then the risk is the handshake, not the session table. Good. The session table is not where I want a migration.'),
            ('samuel.palmer', 'What about sessions that were mid-SAML when we flip?'),
            ('keith.ryan', "Those fail and retry. It's a few people, not the whole company. Document it as expected."),
            ('karen.austin', "I'll put one sentence in the maintenance notice: 'you may need to sign in again if you were signing in during the window. Everyone else stays signed in.'"),
        ],
    ),
    thread(
        'proj-auth', 'lori.carter',
        "SAML group mapping. Today we map one IdP group to team admin and ignore the rest. The new IdP sends nested groups. If we naively sync, half of engineering becomes team admin because they're in `eng`, which is nested under the admin group on the IdP side. I have the graph.",
        [
            ('keith.ryan', 'Sync only explicit groups we list, never nested. Nesting is an IdP convenience, not our permission model.'),
            ('lori.carter', "Agree. I'll make the allow-list the only input. Nested membership won't count unless the child group is itself listed."),
            ('robert.ward', 'Please log when we ignore a nested group, at info, once per sync. Silent ignore is how this comes back.'),
            ('kimberly.george', "Team admin should stay a manual grant for now. Don't auto-promote from any group in this cutover."),
            ('lori.carter', "Even better. This cutover preserves membership. It does not invent new admins. I'll delete the auto-promote path rather than fix it."),
        ],
    ),
    thread(
        'proj-auth', 'craig.reed',
        "Rollout proposal: one week of shadow mode. Proxy handles a copy of the handshake, logs success/failure, does not issue cookies. Then a cutover in the Tuesday 9pm window. Rollback is 'point DNS back', which we've timed at under 2 minutes.",
        [
            ('robert.ward', "Shadow mode has to use real IdP responses or we're testing a toy. Use production IdP, discard the result."),
            ('craig.reed', "Yes. That's why it's a week and not an hour. I want a Monday morning login spike in the logs before we trust Tuesday night."),
            ('samuel.palmer', "Add a counter for clock skew. SAML failures that are actually NTP look identical to 'proxy is broken'."),
            ('craig.reed', "I'll add it. If skew is non-zero during shadow week we slip the cutover. No heroics."),
            ('sysadmin', "I'll draft the maintenance post once the window is real. Not before shadow week says we're boring."),
        ],
    ),
    thread(
        'proj-auth', 'karen.austin',
        "Guest accounts and the new IdP. Guests are not in the IdP. They're local emails. The proxy design assumes every login is SAML. If we flip that on globally, guests get a dead end.",
        [
            ('robert.ward', 'Guests stay on the local login form. The proxy only sits on the SAML path. Two doors, same app.'),
            ('keith.ryan', 'The login page has to offer both without looking like a bug. Right now SAML hides the form.'),
            ('diana.wagner', "I'll mock the two-door page. Constraint: guests shouldn't see a SAML button that fails."),
            ('karen.austin', "And SAML users shouldn't be told to use a password they don't have. The page should branch on the email domain before showing a password field."),
            ('lori.carter', "Domain list is already in config. I'll expose it to the login page if it isn't already."),
        ],
    ),
    thread(
        'proj-auth', 'samuel.palmer',
        "Cookie bug on the proxy path. `SameSite=Strict` on the session cookie drops it when the IdP redirects back, so the login 'succeeds' and the next request is anonymous. `Lax` survives the top-level redirect and is what we already use on the non-proxy path. Don't let the proxy template 'harden' this.",
        [
            ('keith.ryan', 'Confirmed. Strict is wrong for a SAML redirect. Lax is the setting. Secure and HttpOnly stay.'),
            ('robert.ward', "I'll pin it in the proxy example config with a comment that says why, because someone will 'fix' it."),
            ('craig.reed', 'Add a test that follows the redirect and asserts the cookie is still present. This is exactly the kind of thing a unit test of the cookie helper will not catch.'),
            ('samuel.palmer', "I'll write that test against the dev IdP. It takes 20 seconds and would have saved the afternoon."),
        ],
    ),
    thread(
        'proj-auth', 'robert.ward',
        "Cutover checklist, living in this thread so it isn't a doc nobody opens:\n  * Shadow week clean (no skew, handshake success over 99%)\n  * Guest login still local\n  * Existing sessions not revoked\n  * Rollback is DNS, timed\n  * Maintenance note says who has to sign in again (almost nobody)\n  * Diana's error page, not the Envoy default\n\nIf any line is open, we don't flip.",
        [
            ('sysadmin', "I'll own the maintenance note and the during-window updates in town-square."),
            ('diana.wagner', "Error page copy is in review. It's three sentences and a retry button. No illustration."),
            ('craig.reed', "DNS rollback is timed at 90 seconds in the staging account. I'll re-time it the day before."),
            ('keith.ryan', "Session non-revocation is tested. I'll re-run it the morning of, not the week before."),
            ('karen.austin', 'Support will be on the channel during the window. Ping me, not the whole support queue.'),
        ],
    ),
    thread(
        'engineering', 'ashley.berry',
        "Sidebar virtualization prototype is up on a branch. 400 channels, the scroll jank is gone, and channel switch is no longer rebuilding the whole list. It's a quality project, not a Q3 bet — Kim was clear — but the branch is ready for eyes. Look at `webapp/channels` sidebar, not the redux shape. I didn't change the data.",
        [
            ('joe.cruz', "Reviewed the scroll math. The overscan is generous, which is why it feels smooth, and it's why a channel at the bottom mounts late. Fine for v1."),
            ('craig.reed', 'Does drag-to-reorder still work? Last time we virtualized a list, drag became a ghost.'),
            ('ashley.berry', "Reorder works for the mounted rows and that's all the rows you can grab. I tested it. Still, please try to break it."),
            ('bobby.watson', "Server payload is unchanged, good. Don't 'optimize' this by having the server page the channel list. We tried. The unreads are wrong."),
            ('samuel.palmer', "I'll run it against the sample team with the ridiculous channel count."),
        ],
    ),
    thread(
        'engineering', 'bobby.watson',
        "Slow query worth fixing while we're in the post store. `posts` by `channelid, createat` is fine until the channel is huge and the offset is large. Threaded views ask for a page in the middle and the planner scans. I want a seek (`createat < $cursor`) instead of `OFFSET` on that one path. Not a general pagination rewrite.",
        [
            ('keith.ryan', 'Agree on the narrow fix. A general rewrite is how this PR lives for a month.'),
            ('craig.reed', "There's an index that almost supports this and then doesn't, because the query also filters `deleteat = 0`. Check the partial index before adding a new one."),
            ('bobby.watson', "The partial index is the right one and the query isn't using it because of the offset. Seek should. I'll paste the plan in the PR."),
            ('ashley.berry', "Client already talks in cursors for infinite scroll in a couple of places and offsets in others. Tell me which endpoint you're changing so I don't 'fix' the client in the wrong direction."),
            ('bobby.watson', 'Only the channel-posts page used by the center pane. Thread replies stay as they are.'),
        ],
    ),
    thread(
        'engineering', 'craig.reed',
        "Playwright flake: `demo_dialog` fails about 1 in 8 runs by clicking Save before the dialog has finished its field refresh. The retry hides it. The race is real. I'd rather mark it as a known wait and fix the wait than keep retrying a pass that isn't a pass.",
        [
            ('joe.cruz', "The refresh is a round trip we don't expose as a loading state. The test is racing a spinner that isn't in the DOM."),
            ('ashley.berry', "Put a `data-loading` on the dialog footer. The test can wait on that. Don't `waitForTimeout`."),
            ('craig.reed', "That's the fix I wanted permission for. A test-only sleep would just move the flake."),
            ('gerald.gomez', "Please do the same audit on `demo_dialog_field_refresh` while you're there. The name suggests it has the same shape."),
            ('craig.reed', "It's the same helper. One fix should cover both. I'll confirm before I say it does."),
        ],
    ),
    thread(
        'engineering', 'keith.ryan',
        "Review latency. I pulled a week of PR ages. Median time to first review is fine (under a day). The tail is not: 6 PRs sat more than 2 days, all of them 'small' backend changes that touched a store method. They weren't hard. They were in a review queue of one.",
        [
            ('bobby.watson', "That queue is me, a lot of the time. I'll stop being the only person who reviews store PRs. Keith, Craig, if you're willing to be on that rotation I'll actually ask you."),
            ('keith.ryan', "Willing. The rule I'd add: if a PR has had no review in one business day, the author pings a named second person, not 'the channel'."),
            ('craig.reed', "In. And authors should say what kind of review they want in the first line. 'Does this query plan look right' is a faster review than 'please read 400 lines'."),
            ('samuel.palmer', "I'll put the one-day ping in the PR template as a comment the author deletes when they've done it. Nagging text in a template works better than a policy doc."),
            ('lori.carter', "If this is a rotation, it needs a name and a backup when someone's out. Otherwise it's vibes."),
        ],
    ),
    thread(
        'engineering', 'lori.carter',
        "On-call handoff template, draft. Trying to replace the 'you're up' message that contains nothing:\n  * What's paging right now, or 'nothing'\n  * Changes shipped in the last 24h that touch the request path\n  * Known bad dashboards (so the next person doesn't debug a lie)\n  * Who to wake for auth, search, and mobile push\n\nToo long?",
        [
            ('robert.ward', 'Not too long. The version we have is too short, which is why handoff is a phone call.'),
            ('samuel.palmer', "Add 'what I almost paged and decided not to'. That's the context that evaporates."),
            ('lori.carter', 'Adding it. Four bullets was a wish.'),
            ('gerald.gomez', "Put it as a saved post in this channel so the outgoing primary fills it in, rather than a doc they won't open at 5pm."),
            ('bobby.watson', "And the search owner line is me this month. If the index lag page fires, that's a real page, not a drill."),
        ],
    ),
    thread(
        'engineering', 'robert.ward',
        "Postmortem from the noisy-neighbor 503 two weeks ago is published. Root cause wasn't us: a batch job on the shared cluster saturated the node we were scheduled onto. What was us: we didn't notice until a customer did, and the autoscaler only reacted once latency was already bad. Actions are a node anti-affinity for that job's owner, and an alert on CPU steal, not just on our own latency.",
        [
            ('keith.ryan', 'CPU steal is the right alert. Our latency alert is a consequence, and it pages the wrong person first.'),
            ('craig.reed', "Anti-affinity is requested. Their team hasn't committed to a date. I'll keep that action open rather than mark it done."),
            ('karen.austin', "The customer-facing note is good. It's short and it doesn't blame 'the platform' by name, which would have been a whole other thread."),
            ('samuel.palmer', "Can we add the steal alert to the handoff template's 'known dashboards' once it exists? New alerts are invisible for a week otherwise."),
            ('robert.ward', "Yes. I'll reply on Lori's template when the alert is actually live, not before."),
        ],
    ),
    thread(
        'engineering', 'gerald.gomez',
        "`make run` on a 16GB laptop is now swapping. Webpack plus the Go server plus Postgres is fine; the extra is the dev client rebuild holding a second copy of the bundle in memory. I watched it. Not an emergency, but two people on this team are on 16GB and they're having a worse week than the code deserves.",
        [
            ('joe.cruz', "There's a webpack cache setting we turned on for CI speed that doesn't belong in local dev. I'll gate it."),
            ('ashley.berry', "Also: the source map is the full one. `eval-cheap-module-source-map` is enough locally and it's a very different memory number."),
            ('gerald.gomez', "I'll test both on the sad laptop before we pick. I don't want a faster build that makes breakpoints useless."),
            ('craig.reed', "Postgres on the same machine is not the culprit. I checked. Don't 'fix' this by moving Postgres to Docker, that's a different project and a worse one."),
            ('bobby.watson', 'Agreed. Leave the database where the scripts expect it.'),
        ],
    ),
    thread(
        'engineering', 'samuel.palmer',
        "Websocket reconnect storm on the sample team, reproducible. Kill the server for 10 seconds, bring it back, and every connected tab reconnects within the same second and refetches the channel. Fine at 5 clients. At the sample-data size it looks like an outage that continues after the outage. Proposal: jitter the reconnect, and don't refetch the whole channel if we already have the latest post id.",
        [
            ('bobby.watson', 'The refetch is the expensive part. Jitter without the conditional refetch just spreads the same load over 20 seconds.'),
            ('ashley.berry', "The client knows the newest post id. The reconnect path ignores it and calls the initial load. I'll stop ignoring it."),
            ('robert.ward', "Please still refetch if the gap is large. 'We missed 3 posts' and 'we missed a day' shouldn't be the same code path."),
            ('samuel.palmer', "Threshold: if the missed count is under 50, fetch the gap. Otherwise do the full load. Number is a guess; I'll make it a constant with the guess written next to it."),
            ('keith.ryan', "Write the guess as a comment that says it's a guess. A bare `50` becomes lore."),
        ],
    ),
    thread(
        'design-review', 'diana.wagner',
        "Shared-channel invite mock is up. The current flow asks the inviting user to explain what a shared channel is, which they can't. The mock moves that explanation into the dialog and leaves the inviter with one job: pick a team and a channel. Feedback on the dialog, not on the illustration. There isn't one.",
        [
            ('kimberly.george', 'The one-job version is right. The paragraph under the title is still too long. Two sentences.'),
            ('ashley.berry', "The channel picker shows private channels the inviter can't actually share. If we can't share them, don't show them."),
            ('diana.wagner', "They were showing as disabled, which reads as 'you did something wrong'. I'll hide them."),
            ('karen.austin', "Add the failure state where the other team declines. Right now the mock ends at 'invite sent', and that's not where the support tickets end."),
            ('diana.wagner', "Decline state added to the same file. It's a system post in the channel, not an email."),
        ],
    ),
    thread(
        'design-review', 'kimberly.george',
        "Guest experience audit, from a session this morning. A new guest lands in one channel and sees: an empty channel (fine), a sidebar full of channels they can't open (not fine), and a search box that returns nothing with no explanation (bad). We knew the empty states were weak. Seeing them in a row is worse.",
        [
            ('diana.wagner', "Sidebar: guests should see the channels they're in, and a single 'you're a guest' row, not the locked list of the whole team."),
            ('ashley.berry', "The locked list is the component showing every public channel and then failing the click. I can filter it. I'd like the copy from you before I invent 'you're a guest'."),
            ('diana.wagner', 'Copy by tomorrow. Short, not cute.'),
            ('lois.harper', "Mobile guest has the same sidebar. I'll take the same filter once the web one is real, so we don't design it twice."),
            ('karen.austin', "Search returning nothing is the ticket I get. 'No results in the channels you can see' is the sentence. Please use that and not 'no results'."),
        ],
    ),
    thread(
        'design-review', 'ashley.berry',
        "Thread pane width on a 13 inch laptop. At the default, the pane covers the message you're trying to reply about. I can make it narrower by default or remember a per-user width. Remembering is more work and it's the one people will ask for the day after we ship a narrower default.",
        [
            ('diana.wagner', 'Remember the width. A narrower default makes the existing complaint worse for people with big monitors.'),
            ('joe.cruz', 'The resize handle is already there and we throw away the result on reload. Persisting it is the whole fix.'),
            ('kimberly.george', 'Persist per user, not per channel. Per channel is a setting nobody can find.'),
            ('ashley.berry', "Per user it is. I'll store it with the other pane prefs."),
            ('gerald.gomez', "Please persist after drag ends, not during. Saving on every mousemove is a bug we've already written once."),
        ],
    ),
    thread(
        'design-review', 'karen.austin',
        "Empty search illustration. I'm going to be the person who says we don't need one. The useful part of an empty search is 'what to try next', and an illustration of a magnifying glass doesn't say that. Proposed: the no-results text, then two example queries that would work in this team.",
        [
            ('diana.wagner', "Agreed, and I'm the person who would have drawn the magnifying glass. Examples are better."),
            ('bobby.watson', "Examples have to be queries that return results, or we've built a button that demonstrates the failure. I can supply two that are stable."),
            ('kimberly.george', "Don't make them cute. `from:bobby.watson in:proj-search` is a better example than a joke."),
            ('karen.austin', "That's the example. I'll use real operators so the empty state teaches the syntax Keith is trying to keep stable."),
            ('ashley.berry', "I'll wire the examples as chips that run the search, not as static text. Otherwise people screenshot them and type them wrong."),
        ],
    ),
    thread(
        'design-review', 'lois.harper',
        'Mobile tab bar. We have four tabs and five opinions. Current: Home, Mentions, Saved, You. The request on the table is to add Calls. Adding a fifth tab means one of the existing four becomes a submenu, and Saved is the one people will volunteer to hide because they forget it exists until they need it.',
        [
            ('diana.wagner', "Don't add a fifth tab. Calls can live inside a channel, which is where a call is. A tab implies calls are global."),
            ('kimberly.george', "Agree. A calls tab becomes a graveyard of old calls. That's a worse empty state than the one we just complained about."),
            ('joe.cruz', "Then the work is making the in-channel call button obvious, not a new tab. It's already there and it's the same color as the header."),
            ('lois.harper', "I'll write the ticket as 'make the in-channel call control visible', and close the tab request with that reasoning so it doesn't come back as a new idea next month."),
            ('gerald.gomez', 'Thank you. I did not want to implement a fifth tab and find out in review.'),
        ],
    ),
    thread(
        'design-review', 'diana.wagner',
        "Early look at a 'summarize this thread' control, since it keeps coming up in planning. I put it in the thread header, next to the existing follow control, not in the composer. The result is a panel under the header, not a new post in the thread. A post would look like someone said the summary.",
        [
            ('kimberly.george', "Header is the right place. And the panel-not-a-post decision is the one I don't want relitigated in a demo."),
            ('ashley.berry', "The header is already crowded on a laptop. I'll check it against the thread-pane width work before anyone mocks it as infinite horizontal space."),
            ('bobby.watson', "If the panel isn't a post, it isn't searchable, and it isn't in the audit log. Fine for a prototype. Not fine if we later pretend it's a record."),
            ('diana.wagner', "Prototype only. I'll label the mock that way so it doesn't get built as a compliance feature by accident."),
            ('joe.cruz', "Loading state: generic shimmer, not a fake message bubble. A bubble-shaped skeleton reads as a message that hasn't arrived."),
        ],
    ),
    thread(
        'engineering', 'bobby.watson',
        "Schema migration for v2.4 is ready for the dry run. Three months of this, and the part I'm least romantic about is the foreign key Keith caught in review. The dry run is against a prod-sized copy, not the demo database. Demo is too small to teach us anything.",
        [
            ('keith.ryan', "The FK was going to lock the posts table under a write load. Catching it in review was cheaper than catching it at 2am. That's the whole argument for the store review rotation."),
            ('craig.reed', "Rollout tooling is ready: 5%, then 25, then 100, with a halt if error rate moves. I'll run the dry run with Bobby watching the lock view."),
            ('diana.wagner', 'UI polish for the release is in. Joe and I are done unless the dry run produces a visible failure.'),
            ('kimberly.george', "If the dry run is clean, we ship this week. If it isn't, we slip and we say so in town-square the same day. No quiet slips."),
        ],
    ),
    thread(
        'town-square', 'craig.reed',
        'v2.4 dry run is clean. No lock pileup, halt thresholds never tripped, and the gradual ramp did what we built it for. Shipping is a go from the rollout side. Product can call the day.',
        [
            ('kimberly.george', 'Tomorrow morning. I want the note and the changelog in the same hour as the ramp, not the night before.'),
            ('bobby.watson', "I'll be online for the ramp. Not because I expect to roll back. Because the person who wrote the migration should be the person watching it."),
            ('karen.austin', "Support has the changelog. The only question I expect is 'did my theme reset'. The answer is no."),
            ('robert.ward', "Infra is quiet. Don't bundle anything else into that window."),
        ],
    ),
    thread(
        'off-topic', 'gerald.gomez',
        'Crossword club is a thing now, apparently, because three of us were doing the same one in the kitchen. Fridays, 4:30, the table by the window. No skill requirement. Ashley is not allowed to fill in the sports clues unassisted.',
        [
            ('ashley.berry', 'That was one clue and it was a team name. I stand by it.'),
            ('lois.harper', "I'm in. I will be wrong with confidence."),
            ('samuel.palmer', "Remote folks can join in the thread. I'll post the across clues I refuse to look up."),
            ('diana.wagner', "I'll bring Backpressure the plant, since it has been formally named against my will and should meet people."),
        ],
    ),
    thread(
        'town-square', 'sysadmin',
        "There is no office move. The rumor is from a facilities survey about desk counts, which is a survey, not a lease. If someone tells you we're moving in October, they are repeating a guess. I'll post again if that ever changes. It is not changing this quarter.",
        [
            ('lori.carter', 'Thank you. I had already heard three different buildings.'),
            ('joe.cruz', "The survey is still worth filling out. They asked about monitor arms, which is the only facilities question I've ever cared about."),
            ('karen.austin', "I'll reply to the support-internal thread with this so it stops mutating."),
            ('sysadmin', "Please do. I'm not taking a third lap."),
        ],
    ),
    thread(
        'proj-search', 'bobby.watson',
        "Phase 1 shadow read has been on for the demo team since Monday. Click-through is up against the old ranker on the queries Kim listed, and the 'lost results' guardrail is flat. I'm not calling it done. I'm calling it ready for a wider 10% once Craig's backfill has run on the prod-sized copy.",
        [
            ('craig.reed', 'Backfill on the copy finished in 2h 40m. Checkpoint resume works; I killed it on purpose halfway. Prod backfill is scheduled, not started.'),
            ('kimberly.george', 'Wider 10% can wait until after the v2.4 ramp. One change to search results in a release week is enough.'),
            ('keith.ryan', 'Parser tests are in, including the 30 support queries Samuel cleaned. Two of them were impossible (`on:` with no date) and now return a visible error instead of zero results.'),
            ('ashley.berry', 'Snippets center on the match in the shadow UI. I want a day of people actually clicking them before we call that done too.'),
            ('samuel.palmer', 'Embeddings spike doc is up and not attached to this epic. As promised.'),
        ],
    ),
    thread(
        'proj-mobile', 'joe.cruz',
        "Collapse and the badge refetch landed on the same QA build. Gerald's battery graph is in the thread. Deep link now switches team before opening the channel; Ashley found one more case where the channel name exists on both teams, and the test Bobby asked for is the one that caught it.",
        [
            ('gerald.gomez', "Battery graph: the 4 minute retry is gone. Overnight drain is back to 'phone', not 'hand warmer'."),
            ('lois.harper', "iOS badge matches web after one resume on the device I have. I'll try a second device before I call it closed."),
            ('diana.wagner', "Preview-default copy is written and not scheduled. Kim said it can slip. It's slipping."),
            ('robert.ward', "Push token overlap is in production as of last night. No 401 page during this morning's rotation."),
            ('kimberly.george', 'This is the Q3 mobile bet, visibly moving. Nice week.'),
        ],
    ),
    thread(
        'proj-auth', 'craig.reed',
        "Shadow week so far: handshake success 99.4%, clock skew zero, one failure class that was a mis-issued test user and not the proxy. I'm still not bored of it, which means we are not done. Two more weekdays, including Monday's login spike, before I'll say the Tuesday window is real.",
        [
            ('robert.ward', "Stay unbored. Monday's spike is the test. Tuesday's window is a calendar hold until then."),
            ('sysadmin', "I have the maintenance draft and I'm not posting it. Say the word after Monday."),
            ('karen.austin', "Guest login verified on the shadow config: local form, no SAML redirect. I'll recheck Monday too."),
            ('samuel.palmer', 'SameSite test is in CI against the dev IdP. It failed on purpose when I flipped the cookie to Strict, which is the result I wanted.'),
            ('diana.wagner', 'Error page is merged. Retry goes back to the login door, not to a stale SAML URL.'),
        ],
    ),
    thread(
        'engineering', 'lori.carter',
        "Handoff template has been used for three nights. It's better. The line people skip is 'what I almost paged'. I'm going to leave it in and keep being annoying about it, because the one time it was filled in it saved the next person 40 minutes.",
        [
            ('robert.ward', "The steal alert is live as of this afternoon. Adding it to 'known dashboards': it fires on the node, and it is not a false alarm if you see it. The latency alert is the one that lies by being late."),
            ('samuel.palmer', 'Search owner for pages is still Bobby this month. Index lag has not paged. The dashboard is the one in the existing folder, not a new link.'),
            ('bobby.watson', "If it pages, the failure mode is a stale index, not a dropped post. Don't roll back a deploy for it. Wake me."),
            ('keith.ryan', "Store review rotation starts Monday. The PR template nag is in. We'll see if the tail moves."),
        ],
    ),
    thread(
        'off-topic', 'karen.austin',
        "Recommendation, non-work: the used bookstore on Valencia has a 'you can sit and read' corner that isn't a cafe and doesn't want you to buy a coffee. I got through half a novel on Saturday and nobody sighed at me. Taking recommendations for the other half.",
        [
            ('diana.wagner', "If you liked that corner you'll like the one at the library branch on 18th more. Worse chairs, better light."),
            ('craig.reed', 'I will not recommend a book in public. I will DM you something slightly embarrassing and correct.'),
            ('lois.harper', 'The Valencia place also has a poetry shelf that is not ironic. Rare.'),
            ('joe.cruz', "Going Sunday. I'll report whether the chairs are a trap."),
        ],
    ),
    thread(
        'town-square', 'kimberly.george',
        "Kudos, in public on purpose. The v2.4 migration dry run was the least dramatic release prep we've had, and that is the compliment. Bobby, Keith, Craig, Diana, Joe: the work showed up as 'nothing went wrong', which is the kind of work that's easy to skip thanking.",
        [
            ('bobby.watson', "The FK catch was Keith. I'll take the rest of the thank-you and pass that part over."),
            ('keith.ryan', "Accepted. Now everyone please go review a store PR that isn't mine."),
            ('craig.reed', "The ramp tooling finally earned its keep. That's all I wanted from it."),
            ('diana.wagner', 'And the UI polish was a last-week push, not a three-month one. Joe carried it.'),
            ('joe.cruz', 'Carried it across the finish line. The design was already done.'),
        ],
    ),
]

# Ordered oldest -> newest inside the "today" window. Newer threads end up
# at the bottom of the channel scrollback. The final few threads cluster
# around the demo-prep narrative + @yvette mentions.
THREADS: List[Thread] = [
    thread(
        'off-topic', 'lori.carter',
        'Anyone else trying out the new coffee place on 3rd? I went yesterday — the espresso is actually really good but the wait at 9am is brutal.',
        [
            ('samuel.palmer', "Went last week. Agree on the espresso. Try the cortado, it's the move."),
            ('ashley.berry', 'Wait is fine if you order ahead in their app. I tested it twice this week, total ~4 min from order to pickup.'),
            ('lori.carter', "Oh that's a game-changer. Pulling it up now."),
            ('gerald.gomez', "What's wrong with the office machine 🥲"),
            ('samuel.palmer', "@gerald.gomez genuinely curious if you're being sarcastic"),
            ('gerald.gomez', '100% sarcastic. The office machine is a war crime.'),
        ],
    ),
    thread(
        'off-topic', 'craig.reed',
        "Music thread — drop one album you've had on repeat this month. Any genre. I'll start: 'A Light for Attracting Attention' by The Smile. Slow burn, very good headphones-on-a-walk record.",
        [
            ('bobby.watson', "'Multitude' by Stromae. Even if you don't speak French it's just an incredible production record."),
            ('diana.wagner', 'Going to be predictable here: the new Big Thief live album. I know, I know.'),
            ('craig.reed', 'Not predictable, just correct.'),
            ('samuel.palmer', "I've been deep in old Talk Talk — 'Spirit of Eden' is criminally underplayed."),
            ('joe.cruz', "'For Ever' by Jungle. Pure summer-evening energy."),
            ('lois.harper', "Boygenius — 'the record'. Still hasn't left my rotation since it dropped."),
        ],
    ),
    thread(
        'town-square', 'robert.ward',
        "Quick PSA: we hit a transient 503 spike between 14:02–14:09 UTC. Root cause was a noisy neighbor in the shared cluster, not us. No customer impact reported but I'm watching the dashboards. Will write up in the SRE channel.",
        [
            ('ashley.berry', 'Thanks for the heads up. Did the autoscaler kick in correctly?'),
            ('robert.ward', 'Yes — scale-out triggered at 14:04, fully recovered by 14:09. Mean latency stayed under SLA the whole time.'),
            ('lori.carter', 'Should we open a ticket with the platform team about the noisy neighbor?'),
            ('robert.ward', "Already filed. They're tracking it on their side. I'll link the ticket in the postmortem."),
        ],
    ),
    thread(
        'town-square', 'diana.wagner',
        'We officially shipped v2.4 to GA this morning :tada: Huge thanks to everyone who helped land the migration work — it was a long road. Special shout-outs in thread.',
        [
            ('diana.wagner', '@bobby.watson for owning the schema migration end-to-end. Three months of careful work.'),
            ('diana.wagner', '@craig.reed for the rollout tooling — the gradual ramp saved us from a real incident on day 1.'),
            ('diana.wagner', '@joe.cruz and @kimberly.george for the UI polish in the final week. The before/after is night and day.'),
            ('bobby.watson', 'Thanks Diana. Honestly the migration was 90% the schema review process from @keith.ryan — caught the foreign-key issue that would have torpedoed us.'),
            ('keith.ryan', 'Team effort. Happy to see it land.'),
            ('ashley.berry', 'Congrats all! Looking forward to building on this foundation.'),
        ],
    ),
    thread(
        'demo-channel', 'joe.cruz',
        "Heads up: webpack is throwing a deprecation warning about `mixed-decls` in `_sidebar-right.scss`. Not blocking but it's noisy in the dev console. Worth a follow-up ticket?",
        [
            ('samuel.palmer', "Yeah it's a Sass 2.x thing. The fix is wrapping the declaration in `& {}`. I can take a pass after the demo."),
            ('kimberly.george', "There are like 11 more of those repeated warnings hidden behind 'repetitive deprecation warnings omitted'. Whole batch is the same pattern."),
            ('joe.cruz', 'Cool, opening a ticket. Linear or here?'),
            ('samuel.palmer', 'Linear please. Tag me on it.'),
        ],
    ),
    thread(
        'off-topic', 'kimberly.george',
        "Weekend recs! I'm finally taking Saturday fully off. Open to anything: hike, museum, movie, board game cafe, whatever. What did people do recently that they actually liked?",
        [
            ('karen.austin', "Saw 'Past Lives' at the Roxie last weekend. Quiet but very good. Worth a Saturday afternoon."),
            ('joe.cruz', 'If the weather holds: the Marin Headlands trail loop. ~2 hours, big views, not too gnarly.'),
            ('ashley.berry', 'Board game cafe rec: Mox on Mission. They have a way better selection than the bigger chain places.'),
            ('kimberly.george', 'Roxie + headlands hike is the plan now. Thank you 🙏'),
            ('karen.austin', 'Report back!'),
        ],
    ),
    thread(
        'town-square', 'sysadmin',
        ':mega: Reminder: all-hands tomorrow at 10am PT. Agenda is in the shared doc. Please drop questions in this thread ahead of time so we can batch them.',
        [
            ('gerald.gomez', "Will the recording be posted same-day? Some of us in EMEA can't make the live slot."),
            ('sysadmin', "Yes — same-day, in the #all-hands-recordings channel. We're also publishing the deck as a doc afterward."),
            ('karen.austin', 'Any update on the Q3 hiring freeze guidance?'),
            ('sysadmin', "Touching on it briefly. The TL;DR: critical roles only, formal request process via your director. We'll publish the policy doc right after the meeting."),
            ('robert.ward', 'Will we cover the on-call rotation changes? There were a few unanswered questions from the last review.'),
            ('sysadmin', "Yes, that's on the agenda. Bringing in the SRE lead for the last 10 min."),
            ('lois.harper', 'Can we get a 5-min Q&A at the end about the new perf review template? Lots of confusion on the team.'),
            ('sysadmin', 'Adding it. Thanks for flagging.'),
        ],
    ),
    thread(
        'demo-channel', 'yvette',
        'Hey team — I just filed a batch of Linear tickets for the Cursor demo. Six feature ideas in YVE-5 through YVE-10. Wanted to get a read on which one to lead with for the live build.',
        [
            ('ashley.berry', 'Skimmed them — YVE-7 (Unread Thread Summary) is the cleanest IMO. Visible, scoped, and the agent has to navigate real component layers.'),
            ('craig.reed', '+1 on Unread Summary. AI Command Palette (YVE-6) feels flashier but the surface area is bigger. Riskier for a live demo.'),
            ('diana.wagner', "I'd vote Unread Summary too. Bonus: you can fall back to Action Items (YVE-8) if there's time — they share a lot of the thread-pane plumbing."),
            ('keith.ryan', 'What about Reaction Heatmap (YVE-9)? Lower stakes, lots of visible payoff.'),
            ('ashley.berry', "Heatmap is fun but doesn't show the 'find files / navigate codebase' part as well. The summary button forces the agent to actually understand the data model."),
            ('yvette', "OK — leading with YVE-7. I'll keep YVE-9 as a backup if we have headroom. Anyone want to take a stab at the design while I prep the prompt?"),
            ('diana.wagner', "I'll mock something quick in Figma. Give me ~30 min."),
        ],
    ),
    thread(
        'demo-channel', 'bobby.watson',
        'Quick question before we kick this off: are we doing the demo against this `demo` team or one of the sample teams? The threading in ad-1 has more posts but this one has the people watching the demo in it.',
        [
            ('yvette', "Let's stay in `demo`. I just seeded users + threads here so the audience sees themselves in the member list. Feels less canned."),
            ('bobby.watson', "Perfect, that's what I'd want too."),
            ('lori.carter', "Should we pin a 'demo script' post to town-square so the audience can follow along?"),
            ('yvette', "Good idea. I'll write one up and pin it before the dry-run."),
        ],
    ),
    thread(
        'demo-channel', 'ashley.berry',
        '@yvette quick question — do you want the Unread Thread Summary button to live in the thread *header* or down in the reply composer? Mocking it both ways and they pull in slightly different components.',
        [
            ('diana.wagner', "Header is more discoverable IMO. Composer feels like you have to be 'in the conversation' before you realize it exists."),
            ('ashley.berry', "Yeah that's where I landed too. Just wanted a second opinion before I commit."),
            ('craig.reed', "Header. Also matches the pattern of the existing 'mark as unread' control."),
            ('ashley.berry', '@yvette your call ultimately though — happy to go either way.'),
        ],
    ),
    thread(
        'demo-channel', 'diana.wagner',
        'Figma mock for the summary panel: https://figma.com/file/abc123/Cursor-Demo — feedback welcome. @yvette I left a couple of comments on the loading state, would love your eyes when you get a sec.',
        [
            ('yvette', 'Looking now.'),
            ('diana.wagner', "Specifically — should the skeleton match the message bubble shape or be a generic 3-line shimmer? I went generic but I'm second-guessing."),
            ('joe.cruz', "Generic shimmer is probably right. Bubble-shaped skeleton tends to read as 'real message that's still loading' which is misleading."),
            ('diana.wagner', 'Good point. Sticking with generic.'),
        ],
    ),
    thread(
        'town-square', 'kimberly.george',
        'Product weekly is moving from Tuesday 11am to Wednesday 2pm starting next week (calendar invites going out today). @yvette flagging in case you wanted to start joining — happy to add you.',
        [
            ('yvette', "Yes please — I'd like to attend at least the first couple while I'm ramping."),
            ('kimberly.george', "Added you, you'll see it on your calendar in a few minutes."),
            ('karen.austin', 'Are we still doing the async pre-read? The 30 min in-meeting context dump last week was rough.'),
            ('kimberly.george', "Yes — async pre-read is staying. Will be stricter about 'come having read it' from here on."),
            ('yvette', 'Where does the pre-read live, in case I want to skim past ones?'),
            ('kimberly.george', "Shared drive → Product → Weekly Notes. I'll DM you the link."),
        ],
    ),
    thread(
        'town-square', 'robert.ward',
        "Heads up everyone: planned maintenance window tomorrow 9-10pm PT. Brief Mattermost downtime (~5 min) while we cut over to the new auth proxy. @yvette — sharing this with you in particular since the demo is the same week, want to make sure it doesn't land mid-rehearsal.",
        [
            ('yvette', "Thanks for the flag — that's well outside the dry-run window, we're good."),
            ('robert.ward', "Cool. I'll post here when we start and when we're back."),
            ('lori.carter', 'Will the SSO redirect change as part of this?'),
            ('robert.ward', 'URL is the same. Just the backend handler is new. Should be a no-op from a user perspective.'),
        ],
    ),
    thread(
        'demo-channel', 'bobby.watson',
        "Dry-run prep checklist (let me know what's missing):\n  * Browser refreshed, cache cleared\n  * `make run` healthy, postgres + redis up\n  * Linear board open in second tab (YVE-5 through YVE-10)\n  * Figma open with the summary mock\n  * Recording app armed\n\n@yvette anything else you want pre-staged?",
        [
            ('yvette', 'Add: have the Cursor agent panel open and pre-pointed at server/channels. Saves the 5-second navigate at the start.'),
            ('bobby.watson', 'Done.'),
            ('samuel.palmer', "Also worth: have a 'dummy' channel with a few unread messages ready so the summary button has something to summarize on first click."),
            ('bobby.watson', 'Smart. Will pin a fresh test thread right before we start.'),
            ('yvette', 'Perfect.'),
        ],
    ),
    thread(
        'town-square', 'sysadmin',
        ':wave: Welcome @yvette to the team! Folks, drop your intros + a fun fact in this thread.',
        [
            ('ashley.berry', "Welcome! I'm Ashley — work mostly on the frontend, currently obsessed with thread infinite-scroll perf. Fun fact: I'm learning Mandarin (very slowly)."),
            ('bobby.watson', 'Welcome @yvette! Bobby here, backend / data. Fun fact: I make hot sauce at home, will bring some in.'),
            ('diana.wagner', 'Welcome :) — Diana on design. Fun fact: I have a cat named Latency.'),
            ('craig.reed', "Latency is a top-tier cat name and I won't be topping it. Welcome @yvette!"),
            ('kimberly.george', 'Welcome! Kim from product. Fun fact: ran the LA marathon in March, will probably not do it again.'),
            ('yvette', 'Thanks all 💚 fun fact: I once accidentally pushed `rm -rf /` … to a Hello World test repo. The fear has not left me.'),
            ('samuel.palmer', "That's a great fun fact actually. Welcome!"),
        ],
    ),
]

SAMPLE_USERS = {
    "yvette",
    "ashley.berry", "bobby.watson", "craig.reed", "diana.wagner",
    "gerald.gomez", "joe.cruz", "karen.austin", "keith.ryan",
    "kimberly.george", "lois.harper", "lori.carter", "robert.ward",
    "samuel.palmer", "sysadmin", "guest", "user-1",
}

EXISTING_CHANNELS = {"town-square", "off-topic", "demo-channel"}


def _reply_offset_ms(index: int) -> int:
    return (index + 1) * (90 * 1000 + index * 17 * 1000)


def _check() -> None:
    bad_users = set()
    bad_channels = set()
    known_channels = EXISTING_CHANNELS | {name for name, _, _ in CHANNELS}
    for channel, author, _, replies in (*HISTORY, *THREADS):
        if author not in SAMPLE_USERS:
            bad_users.add(author)
        if channel not in known_channels:
            bad_channels.add(channel)
        for user, _ in replies:
            if user not in SAMPLE_USERS:
                bad_users.add(user)
    if bad_users or bad_channels:
        if bad_users:
            print(f"Unknown usernames referenced: {sorted(bad_users)}", file=sys.stderr)
        if bad_channels:
            print(f"Unknown channels referenced: {sorted(bad_channels)}", file=sys.stderr)
        sys.exit(1)


def _append_threads(lines: List[str], threads: List[Thread], start_ms: int, end_ms: int) -> None:
    count = len(threads)
    if count == 0:
        return
    span = max(end_ms - start_ms, 1)
    step = span // count
    for i, (channel, author, message, replies) in enumerate(threads):
        thread_start = start_ms + i * step
        reply_objs = []
        for j, (ruser, rmsg) in enumerate(replies):
            reply_objs.append({
                "user": ruser,
                "message": rmsg,
                "create_at": thread_start + _reply_offset_ms(j),
                "props": dict(SEED_MARKER),
            })

        post = {
            "team": TEAM,
            "channel": channel,
            "user": author,
            "message": message,
            "create_at": thread_start,
            "props": dict(SEED_MARKER),
            "replies": reply_objs,
        }
        lines.append(json.dumps({"type": "post", "post": post}, ensure_ascii=False))


def main() -> None:
    _check()

    tail_ms = max(
        (_reply_offset_ms(len(replies) - 1) for *_, replies in (*HISTORY, *THREADS) if replies),
        default=0,
    )
    tail_ms += 2 * MIN_MS

    today_end = NOW_MS - tail_ms
    today_start = today_end - TODAY_SPAN_MS
    history_end = today_start - 30 * MIN_MS
    history_start = history_end - HISTORY_SPAN_MS

    lines: List[str] = [json.dumps({"type": "version", "version": 1})]
    for name, display_name, purpose in CHANNELS:
        lines.append(json.dumps({
            "type": "channel",
            "channel": {
                "team": TEAM,
                "name": name,
                "display_name": display_name,
                "type": "O",
                "purpose": purpose,
            },
        }))

    _append_threads(lines, HISTORY, history_start, history_end)
    _append_threads(lines, THREADS, today_start, today_end)

    with open(OUT, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines) + "\n")

    all_threads = HISTORY + THREADS
    total_replies = sum(len(item[3]) for item in all_threads)
    print(
        f"Wrote {len(CHANNELS)} channels, {len(all_threads)} threads "
        f"({len(HISTORY)} history + {len(THREADS)} today, {total_replies} replies) to {OUT}"
    )


if __name__ == "__main__":
    main()
