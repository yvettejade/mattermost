// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import GrokAgentModal from './grok_agent_modal';

jest.mock('mattermost-redux/client', () => ({
    Client4: {
        getGrokAgentStatus: jest.fn(),
        queryGrokAgent: jest.fn(),
    },
}));

describe('components/grok_agent_modal', () => {
    const onExited = jest.fn();

    const initialState = {
        entities: {
            users: {
                currentUserId: 'user1',
                profiles: {
                    user1: {id: 'user1', username: 'testuser'},
                },
            },
            teams: {
                currentTeamId: 'team1',
                teams: {
                    team1: {id: 'team1', name: 'test-team', display_name: 'Test Team'},
                },
            },
            channels: {
                currentChannelId: 'channel1',
                channels: {
                    channel1: {
                        id: 'channel1',
                        name: 'town-square',
                        display_name: 'Town Square',
                        team_id: 'team1',
                        type: 'O',
                    },
                },
                myMembers: {
                    channel1: {channel_id: 'channel1', user_id: 'user1'},
                },
            },
        },
        views: {
            rhs: {
                selectedPostId: '',
            },
        },
    };

    beforeEach(() => {
        jest.mocked(Client4.getGrokAgentStatus).mockResolvedValue({
            available: true,
            provider: 'workspace',
            model: 'grok-3',
            github_repo: 'yvettejade/mattermost',
            jira_project_key: 'YJIRA',
            jira_base_url: 'https://fe-anysphere-demo.atlassian.net',
        });
        jest.mocked(Client4.queryGrokAgent).mockResolvedValue({
            intent: 'summarize',
            reply: 'Catch-up for Town Square',
            provider: 'workspace',
            sources: ['Mattermost channel Town Square'],
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should render the chat modal with quick actions', async () => {
        renderWithContext(
            <GrokAgentModal onExited={onExited}/>,
            initialState,
        );

        expect(screen.getByTestId('grok-agent-modal')).toBeInTheDocument();
        expect(screen.getByText('Grok')).toBeInTheDocument();
        expect(screen.getByTestId('grok-agent-action-summarize')).toBeInTheDocument();
        expect(screen.getByTestId('grok-agent-action-draft')).toBeInTheDocument();
        expect(screen.getByTestId('grok-agent-input')).toBeInTheDocument();

        await waitFor(() => {
            expect(Client4.getGrokAgentStatus).toHaveBeenCalled();
        });
    });

    test('should query the Grok agent from a quick action and show the reply', async () => {
        renderWithContext(
            <GrokAgentModal onExited={onExited}/>,
            initialState,
        );

        await userEvent.click(screen.getByTestId('grok-agent-action-summarize'));

        await waitFor(() => {
            expect(Client4.queryGrokAgent).toHaveBeenCalledWith({
                channel_id: 'channel1',
                root_id: undefined,
                message: 'catch up',
                intent: 'summarize',
            });
        });

        expect(await screen.findByText('Catch-up for Town Square')).toBeInTheDocument();
        expect(screen.getByText('catch up')).toBeInTheDocument();
    });

    test('should send a typed question', async () => {
        jest.mocked(Client4.queryGrokAgent).mockResolvedValue({
            intent: 'ask',
            reply: 'The header work is still open.',
            provider: 'grok',
            sources: ['Mattermost channel Town Square'],
        });

        renderWithContext(
            <GrokAgentModal onExited={onExited}/>,
            initialState,
        );

        await userEvent.type(screen.getByTestId('grok-agent-input'), 'what is left on the header?');
        await userEvent.click(screen.getByTestId('grok-agent-send'));

        await waitFor(() => {
            expect(Client4.queryGrokAgent).toHaveBeenCalledWith({
                channel_id: 'channel1',
                root_id: undefined,
                message: 'what is left on the header?',
                intent: undefined,
            });
        });

        expect(await screen.findByText('The header work is still open.')).toBeInTheDocument();
    });
});
