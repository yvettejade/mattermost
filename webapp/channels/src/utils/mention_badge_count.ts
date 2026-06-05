// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/** Documented display cap for sidebar unread mention badges. */
export const MENTION_BADGE_CAP = 99;

/**
 * Formats unread mention counts shown in sidebar badges (channel list, Threads link).
 * Values above the cap should display as "99+" per product spec.
 */
export function formatMentionBadgeCount(
    count: number,
    cap: number = 50,
): string {
    if (count <= cap) {
        return String(count);
    }

    return String(cap);
}
