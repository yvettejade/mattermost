// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Route} from 'react-router-dom';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import ChannelHeaderButton from './channel_header_button';

jest.mock('components/global_header/hooks/use_is_in_channel_view', () => ({
    useIsInChannelView: jest.fn(),
}));

const {useIsInChannelView} = jest.requireMock('components/global_header/hooks/use_is_in_channel_view');

describe('components/global_header/ChannelHeaderButton', () => {
    const channel = TestHelper.getChannelMock({
        id: 'channel_id',
        name: 'town-square',
        display_name: 'Town Square',
        header: 'Welcome to the town square',
    });

    const baseState = {
        entities: {
            channels: {
                currentChannelId: channel.id,
                channels: {
                    [channel.id]: channel,
                },
            },
            users: {
                currentUserId: 'user_id',
                profiles: {
                    user_id: TestHelper.getUserMock({id: 'user_id'}),
                },
            },
        },
    } as unknown as GlobalState;

    beforeEach(() => {
        useIsInChannelView.mockReturnValue(true);
    });

    test('does not render outside channel view', () => {
        useIsInChannelView.mockReturnValue(false);

        const {container} = renderWithContext(
            <Route path='/'>
                <ChannelHeaderButton/>
            </Route>,
            baseState,
        );

        expect(container).toBeEmptyDOMElement();
    });

    test('opens modal with channel header content', async () => {
        renderWithContext(
            <Route path='/'>
                <ChannelHeaderButton/>
            </Route>,
            baseState,
        );

        await userEvent.click(screen.getByRole('button', {name: 'View channel header'}));

        expect(screen.getByTestId('channelHeaderContentModal')).toBeInTheDocument();
        expect(screen.getByText('Welcome to the town square')).toBeInTheDocument();
        expect(screen.getByText('Channel header for Town Square')).toBeInTheDocument();
    });

    test('shows empty state when channel has no header', async () => {
        const emptyHeaderChannel = {...channel, header: ''};
        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                channels: {
                    currentChannelId: emptyHeaderChannel.id,
                    channels: {
                        [emptyHeaderChannel.id]: emptyHeaderChannel,
                    },
                },
            },
        } as unknown as GlobalState;

        renderWithContext(
            <Route path='/'>
                <ChannelHeaderButton/>
            </Route>,
            state,
        );

        await userEvent.click(screen.getByRole('button', {name: 'View channel header'}));

        expect(screen.getByTestId('channelHeaderContentModalEmpty')).toHaveTextContent('This channel does not have a header.');
    });
});
