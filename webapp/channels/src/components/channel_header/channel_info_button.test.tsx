// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {RHSStates} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import ChannelInfoButton from './channel_info_button';

describe('components/channel_header/ChannelInfoButton', () => {
    const channel = TestHelper.getChannelMock({id: 'channel_id', team_id: 'team_id'});

    function makeState(isSidebarOpen: boolean, rhsState: string | null, selectedChannelId = '') {
        return {
            entities: {
                channels: {
                    currentChannelId: channel.id,
                    channels: {[channel.id]: channel},
                },
                teams: {currentTeamId: 'team_id'},
            },
            views: {
                rhs: {
                    isSidebarOpen,
                    rhsState,
                    selectedChannelId,
                },
            },
        } as unknown as DeepPartial<GlobalState>;
    }

    test('should render an inactive button that opens channel info when the RHS is closed', async () => {
        const {store} = renderWithContext(
            <ChannelInfoButton channel={channel}/>,
            makeState(false, null),
        );

        const button = screen.getByRole('button', {name: 'Open channel info'});
        expect(button).toHaveAttribute('id', 'channel-info-rhs-btn');
        expect(button).not.toHaveClass('channel-header__icon--active-inverted');

        await userEvent.click(button);

        const rhs = store.getState().views.rhs;
        expect(rhs.isSidebarOpen).toBe(true);
        expect(rhs.rhsState).toBe(RHSStates.CHANNEL_INFO);
        expect(rhs.selectedChannelId).toBe(channel.id);
    });

    test('should be active on the channel info view and close the RHS when clicked', async () => {
        const {store} = renderWithContext(
            <ChannelInfoButton channel={channel}/>,
            makeState(true, RHSStates.CHANNEL_INFO, channel.id),
        );

        const button = screen.getByRole('button', {name: 'Close channel info'});
        expect(button).toHaveClass('channel-header__icon--active-inverted');

        await userEvent.click(button);

        const rhs = store.getState().views.rhs;
        expect(rhs.isSidebarOpen).toBe(false);
        expect(rhs.rhsState).toBeNull();
    });

    test('should toggle the pane open and then closed', async () => {
        const {store} = renderWithContext(
            <ChannelInfoButton channel={channel}/>,
            makeState(false, null),
        );

        await userEvent.click(screen.getByRole('button', {name: 'Open channel info'}));
        expect(store.getState().views.rhs.rhsState).toBe(RHSStates.CHANNEL_INFO);

        await userEvent.click(screen.getByRole('button', {name: 'Close channel info'}));
        expect(store.getState().views.rhs.isSidebarOpen).toBe(false);
        expect(screen.getByRole('button', {name: 'Open channel info'})).toBeInTheDocument();
    });

    test.each([
        RHSStates.PIN,
        RHSStates.CHANNEL_MEMBERS,
        RHSStates.CHANNEL_FILES,
    ])('should not be active on the %s view and should switch to channel info when clicked', async (rhsState) => {
        const {store} = renderWithContext(
            <ChannelInfoButton channel={channel}/>,
            makeState(true, rhsState, channel.id),
        );

        const button = screen.getByRole('button', {name: 'Open channel info'});
        expect(button).not.toHaveClass('channel-header__icon--active-inverted');

        await userEvent.click(button);

        const rhs = store.getState().views.rhs;
        expect(rhs.isSidebarOpen).toBe(true);
        expect(rhs.rhsState).toBe(RHSStates.CHANNEL_INFO);
    });
});
