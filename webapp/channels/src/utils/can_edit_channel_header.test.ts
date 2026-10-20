// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Permissions from 'mattermost-redux/constants/permissions';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';

import type {GlobalState} from 'types/store';

import {canEditChannelHeader} from './channel_utils';
import Constants from './constants';
import {TestHelper} from './test_helper';

jest.mock('mattermost-redux/selectors/entities/roles', () => ({
    ...jest.requireActual('mattermost-redux/selectors/entities/roles') as typeof import('mattermost-redux/selectors/entities/roles'),
    haveIChannelPermission: jest.fn(),
}));

const mockedHaveIChannelPermission = haveIChannelPermission as jest.Mock;

describe('canEditChannelHeader', () => {
    const state = {} as GlobalState;

    beforeEach(() => {
        mockedHaveIChannelPermission.mockReset();
        mockedHaveIChannelPermission.mockReturnValue(true);
    });

    test('public channels require manage_public_channel_properties', () => {
        const channel = TestHelper.getChannelMock({type: Constants.OPEN_CHANNEL});

        expect(canEditChannelHeader(state, channel)).toBe(true);
        expect(mockedHaveIChannelPermission).toHaveBeenCalledWith(
            state,
            channel.team_id,
            channel.id,
            Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES,
        );

        mockedHaveIChannelPermission.mockReturnValue(false);
        expect(canEditChannelHeader(state, channel)).toBe(false);
    });

    test('private channels require manage_private_channel_properties', () => {
        const channel = TestHelper.getChannelMock({type: Constants.PRIVATE_CHANNEL});

        expect(canEditChannelHeader(state, channel)).toBe(true);
        expect(mockedHaveIChannelPermission).toHaveBeenCalledWith(
            state,
            channel.team_id,
            channel.id,
            Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES,
        );
    });

    test('DM and group channels are editable for members', () => {
        expect(canEditChannelHeader(state, TestHelper.getChannelMock({type: Constants.DM_CHANNEL}))).toBe(true);
        expect(canEditChannelHeader(state, TestHelper.getChannelMock({type: Constants.GM_CHANNEL}))).toBe(true);
        expect(mockedHaveIChannelPermission).not.toHaveBeenCalled();
    });

    test('archived channels are not editable', () => {
        const channel = TestHelper.getChannelMock({delete_at: 1234});

        expect(canEditChannelHeader(state, channel)).toBe(false);
        expect(mockedHaveIChannelPermission).not.toHaveBeenCalled();
    });
});
