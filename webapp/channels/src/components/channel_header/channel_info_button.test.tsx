// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {RHSStates} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ChannelInfoButton from './channel_info_button';

describe('components/channel_header/ChannelInfoButton', () => {
    const channel = TestHelper.getChannelMock({id: 'channel_id', team_id: 'team_id'});

    test('renders the button with the channel-info-rhs-btn id and is inactive by default', () => {
        renderWithContext(<ChannelInfoButton channel={channel}/>);

        const button = screen.getByRole('button', {name: 'Channel info'});
        expect(button).toHaveAttribute('id', 'channel-info-rhs-btn');
        expect(button).not.toHaveClass('channel-header__icon--active');
    });

    test('opens the channel info pane on the first click and closes it on the second', async () => {
        const {store} = renderWithContext(<ChannelInfoButton channel={channel}/>);

        await userEvent.click(screen.getByRole('button', {name: 'Channel info'}));

        expect(store.getState().views.rhs.rhsState).toBe(RHSStates.CHANNEL_INFO);
        expect(store.getState().views.rhs.selectedChannelId).toBe('channel_id');
        expect(store.getState().views.rhs.isSidebarOpen).toBe(true);

        const activeButton = screen.getByRole('button', {name: 'Close channel info'});
        expect(activeButton).toHaveClass('channel-header__icon--active');

        await userEvent.click(activeButton);

        expect(store.getState().views.rhs.rhsState).toBeNull();
        expect(store.getState().views.rhs.isSidebarOpen).toBe(false);
        expect(screen.getByRole('button', {name: 'Channel info'})).not.toHaveClass('channel-header__icon--active');
    });

    test('is not active while another RHS view is open and switches back to channel info on click', async () => {
        const {store} = renderWithContext(
            <ChannelInfoButton channel={channel}/>,
            {views: {rhs: {rhsState: RHSStates.PIN, isSidebarOpen: true}}},
        );

        const button = screen.getByRole('button', {name: 'Channel info'});
        expect(button).not.toHaveClass('channel-header__icon--active');

        await userEvent.click(button);

        expect(store.getState().views.rhs.rhsState).toBe(RHSStates.CHANNEL_INFO);
    });
});
