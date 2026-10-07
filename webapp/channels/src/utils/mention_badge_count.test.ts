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

    test('uses MENTION_BADGE_CAP as default cap parameter (EC-8, UT-1)', () => {
        expect(formatMentionBadgeCount(99)).toBe('99');
        expect(formatMentionBadgeCount(100)).toBe('99+');
    });

    test('boundary values 98, 99, 100 (EC-1, ST-3)', () => {
        expect(formatMentionBadgeCount(98)).toBe('98');
        expect(formatMentionBadgeCount(99)).toBe('99');
        expect(formatMentionBadgeCount(100)).toBe('99+');
    });

    test('returns cap+ suffix above cap, not bare cap (EC-8)', () => {
        expect(formatMentionBadgeCount(150)).toBe('99+');
        expect(formatMentionBadgeCount(150)).not.toBe('99');
    });

    test('respects explicit cap override', () => {
        expect(formatMentionBadgeCount(10, 9)).toBe('9+');
        expect(formatMentionBadgeCount(9, 9)).toBe('9');
    });
});
