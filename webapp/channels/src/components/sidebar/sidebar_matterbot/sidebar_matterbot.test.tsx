// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {showAssistant} from 'actions/views/rhs';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import SidebarMatterBot from './sidebar_matterbot';

jest.mock('actions/views/rhs', () => ({
    showAssistant: jest.fn(() => ({type: 'MOCK_SHOW_ASSISTANT'})),
}));

describe('SidebarMatterBot', () => {
    test('renders MatterBot label and robot icon', () => {
        renderWithContext(<SidebarMatterBot/>, {
            entities: {
                channels: {
                    currentChannelId: 'channel-1',
                },
            },
        });

        expect(screen.getByRole('button', {name: 'MatterBot'})).toBeInTheDocument();
        expect(document.querySelector('.icon-robot-happy')).toBeInTheDocument();
    });

    test('click opens assistant for the current channel', async () => {
        renderWithContext(<SidebarMatterBot/>, {
            entities: {
                channels: {
                    currentChannelId: 'channel-1',
                },
            },
        });

        await userEvent.click(screen.getByRole('button', {name: 'MatterBot'}));
        expect(showAssistant).toHaveBeenCalledWith('channel-1');
    });
});
