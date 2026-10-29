// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TestHelper} from 'utils/test_helper';

import {canManageChannelHeader} from './can_manage_channel_header';

describe('canManageChannelHeader', () => {
    test.each(['O', 'P'] as const)('follows the properties permission in a %s channel', (type) => {
        const channel = TestHelper.getChannelMock({type, delete_at: 0});

        expect(canManageChannelHeader(channel, true)).toBe(true);
        expect(canManageChannelHeader(channel, false)).toBe(false);
    });

    test.each(['D', 'G'] as const)('denies a %s channel even with the permission', (type) => {
        expect(canManageChannelHeader(TestHelper.getChannelMock({type, delete_at: 0}), true)).toBe(false);
    });

    test('denies an archived channel even with the permission', () => {
        expect(canManageChannelHeader(TestHelper.getChannelMock({type: 'O', delete_at: 1234}), true)).toBe(false);
    });

    test('denies a missing channel', () => {
        expect(canManageChannelHeader(undefined, true)).toBe(false);
    });
});
