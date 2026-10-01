// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import AssistantRhs, {clearAssistantTranscripts} from './assistant_rhs';

describe('AssistantRhs', () => {
    const channel = TestHelper.getChannelMock({
        id: 'channel_id',
        display_name: 'Town Square',
        team_id: 'team_id',
    });

    beforeEach(() => {
        clearAssistantTranscripts();
        jest.restoreAllMocks();
    });

    test('sends the channel message to the assistant and shows the reply', async () => {
        const ask = jest.spyOn(Client4, 'askAssistant').mockResolvedValue({reply: 'Deploy is Friday.'});
        const onClose = jest.fn();

        renderWithContext(
            <AssistantRhs
                channel={channel}
                onClose={onClose}
            />,
            {
                entities: {
                    teams: {
                        currentTeamId: 'team_id',
                        teams: {
                            team_id: TestHelper.getTeamMock({id: 'team_id'}),
                        },
                    },
                },
            },
        );

        expect(screen.getByRole('region', {name: 'Assistant'})).toBeInTheDocument();
        await userEvent.type(screen.getByLabelText('Ask about this channel'), 'summarize this channel');
        await userEvent.click(screen.getByRole('button', {name: 'Send'}));

        await waitFor(() => {
            expect(ask).toHaveBeenCalledWith('channel_id', 'summarize this channel', '', 'team_id');
        });
        expect(await screen.findByText('Deploy is Friday.')).toBeInTheDocument();
        expect(screen.getByText('summarize this channel')).toBeInTheDocument();
    });

    test('shows the request error in the chat', async () => {
        jest.spyOn(Client4, 'askAssistant').mockRejectedValue(new Error('Assistant is not configured.'));

        renderWithContext(
            <AssistantRhs
                channel={channel}
                onClose={jest.fn()}
            />,
        );

        await userEvent.type(screen.getByLabelText('Ask about this channel'), 'catch me up');
        await userEvent.click(screen.getByRole('button', {name: 'Send'}));

        expect(await screen.findByText('Assistant is not configured.')).toBeInTheDocument();
    });
});
