// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TestHelper} from 'utils/test_helper';

import {canManageChannelHeader} from './can_manage_channel_header';

describe('canManageChannelHeader', () => {
    test('allows public and private channels when the user can manage properties', () => {
        expect(canManageChannelHeader(TestHelper.getChannelMock({type: 'O', delete_at: 0}), true)).toBe(true);
        expect(canManageChannelHeader(TestHelper.getChannelMock({type: 'P', delete_at: 0}), true)).toBe(true);
    });

    test('hides add and edit without manage-properties permission', () => {
        expect(canManageChannelHeader(TestHelper.getChannelMock({type: 'O', delete_at: 0}), false)).toBe(false);
    });

    test('hides add and edit for DM and GM channels', () => {
        expect(canManageChannelHeader(TestHelper.getChannelMock({type: 'D', delete_at: 0}), true)).toBe(false);
        expect(canManageChannelHeader(TestHelper.getChannelMock({type: 'G', delete_at: 0}), true)).toBe(false);
    });

    test('hides add and edit for archived channels', () => {
        expect(canManageChannelHeader(TestHelper.getChannelMock({type: 'O', delete_at: 1234}), true)).toBe(false);
    });
});
