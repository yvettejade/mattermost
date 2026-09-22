// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TestHelper} from 'utils/test_helper';

import {canEditChannelHeader} from './can_edit_channel_header';

describe('canEditChannelHeader', () => {
    const publicChannel = TestHelper.getChannelMock({type: 'O', delete_at: 0});
    const privateChannel = TestHelper.getChannelMock({type: 'P', delete_at: 0});
    const dmChannel = TestHelper.getChannelMock({type: 'D', delete_at: 0});
    const gmChannel = TestHelper.getChannelMock({type: 'G', delete_at: 0});

    test('returns false when channel is missing', () => {
        expect(canEditChannelHeader({canManageProperties: true})).toBe(false);
    });

    test('returns false for archived channels', () => {
        const archived = TestHelper.getChannelMock({type: 'O', delete_at: 1});
        expect(canEditChannelHeader({channel: archived, canManageProperties: true})).toBe(false);
    });

    test('returns false for bot DM channels', () => {
        const bot = TestHelper.getUserMock({is_bot: true});
        expect(canEditChannelHeader({channel: dmChannel, dmUser: bot, canManageProperties: true})).toBe(false);
    });

    test('returns true for DM and GM channels regardless of manage-properties permission', () => {
        expect(canEditChannelHeader({channel: dmChannel, canManageProperties: false})).toBe(true);
        expect(canEditChannelHeader({channel: gmChannel, canManageProperties: false})).toBe(true);
    });

    test('returns true for public and private channels when the user can manage properties', () => {
        expect(canEditChannelHeader({channel: publicChannel, canManageProperties: true})).toBe(true);
        expect(canEditChannelHeader({channel: privateChannel, canManageProperties: true})).toBe(true);
    });

    test('returns false for public and private channels without manage-properties permission', () => {
        expect(canEditChannelHeader({channel: publicChannel, canManageProperties: false})).toBe(false);
        expect(canEditChannelHeader({channel: privateChannel, canManageProperties: false})).toBe(false);
    });
});
