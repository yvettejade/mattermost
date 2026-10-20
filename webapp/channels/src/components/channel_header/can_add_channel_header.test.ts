// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TestHelper} from 'utils/test_helper';

import {canAddChannelHeader} from './can_add_channel_header';

describe('canAddChannelHeader', () => {
    test('allows public and private channels when the user can manage properties', () => {
        expect(canAddChannelHeader(TestHelper.getChannelMock({type: 'O', delete_at: 0}), true)).toBe(true);
        expect(canAddChannelHeader(TestHelper.getChannelMock({type: 'P', delete_at: 0}), true)).toBe(true);
    });

    test('hides the action without manage-properties permission', () => {
        expect(canAddChannelHeader(TestHelper.getChannelMock({type: 'O', delete_at: 0}), false)).toBe(false);
    });

    test('hides the action for DM and GM channels', () => {
        expect(canAddChannelHeader(TestHelper.getChannelMock({type: 'D', delete_at: 0}), true)).toBe(false);
        expect(canAddChannelHeader(TestHelper.getChannelMock({type: 'G', delete_at: 0}), true)).toBe(false);
    });

    test('hides the action for archived channels', () => {
        expect(canAddChannelHeader(TestHelper.getChannelMock({type: 'O', delete_at: 1234}), true)).toBe(false);
    });
});
