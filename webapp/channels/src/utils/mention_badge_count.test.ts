// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {MENTION_BADGE_CAP, formatMentionBadgeCount} from './mention_badge_count';

describe('formatMentionBadgeCount', () => {
    test('returns small counts unchanged', () => {
        expect(formatMentionBadgeCount(3)).toBe('3');
    });

    test('documents mention badge cap constant', () => {
        expect(MENTION_BADGE_CAP).toBe(99);
    });
});
