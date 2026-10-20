// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';

import {canEditChannelHeader} from 'utils/channel_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

jest.mock('mattermost-redux/selectors/entities/roles', () => ({
    ...jest.requireActual('mattermost-redux/selectors/entities/roles'),
    haveIChannelPermission: jest.fn(),
}));

const mockedHaveIChannelPermission = haveIChannelPermission as jest.MockedFunction<typeof haveIChannelPermission>;

describe('canEditChannelHeader', () => {
    const state = {} as GlobalState;
    const publicChannel = TestHelper.getChannelMock({type: 'O', delete_at: 0});
    const privateChannel = TestHelper.getChannelMock({type: 'P', delete_at: 0});
    const dmChannel = TestHelper.getChannelMock({type: 'D', delete_at: 0});
    const gmChannel = TestHelper.getChannelMock({type: 'G', delete_at: 0});

    beforeEach(() => {
        mockedHaveIChannelPermission.mockReset();
    });

    test('returns false for archived channels', () => {
        const archived = TestHelper.getChannelMock({type: 'O', delete_at: 1});
        mockedHaveIChannelPermission.mockReturnValue(true);
        expect(canEditChannelHeader(state, archived)).toBe(false);
        expect(mockedHaveIChannelPermission).not.toHaveBeenCalled();
    });

    test('returns true for DM and GM channels without a manage-properties check', () => {
        expect(canEditChannelHeader(state, dmChannel)).toBe(true);
        expect(canEditChannelHeader(state, gmChannel)).toBe(true);
        expect(mockedHaveIChannelPermission).not.toHaveBeenCalled();
    });

    test('returns true for public and private channels when the user can manage properties', () => {
        mockedHaveIChannelPermission.mockReturnValue(true);
        expect(canEditChannelHeader(state, publicChannel)).toBe(true);
        expect(canEditChannelHeader(state, privateChannel)).toBe(true);
        expect(mockedHaveIChannelPermission).toHaveBeenCalled();
    });

    test('returns false for public and private channels without manage-properties permission', () => {
        mockedHaveIChannelPermission.mockReturnValue(false);
        expect(canEditChannelHeader(state, publicChannel)).toBe(false);
        expect(canEditChannelHeader(state, privateChannel)).toBe(false);
    });
});
