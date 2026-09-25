// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import GrokAgentButton from 'components/sidebar/grok_agent_button';

import {renderWithContext, screen} from 'tests/react_testing_utils';

describe('components/sidebar/grok_agent_button', () => {
    const state = {
        entities: {
            teams: {
                currentTeamId: 'team_id',
                teams: {
                    team_id: {id: 'team_id', delete_at: 0},
                },
                myMembers: {
                    team_id: {team_id: 'team_id', roles: 'team_role'},
                },
            },
            users: {
                currentUserId: 'user_id',
                profiles: {
                    user_id: {
                        id: 'user_id',
                        roles: 'system_user',
                    },
                },
            },
        },
    };

    test('should render the Grok sidebar control above Invite Members', () => {
        const {container} = renderWithContext(
            <GrokAgentButton/>,
            state,
        );

        expect(screen.getByRole('button', {name: 'Grok'})).toBeInTheDocument();
        expect(container.querySelector('#grokAgentButton')).toBeInTheDocument();
        expect(screen.getByTestId('grokAgentLhsButton')).toBeInTheDocument();
    });

    test('should return nothing without a current team', () => {
        const {container} = renderWithContext(
            <GrokAgentButton/>,
            {
                ...state,
                entities: {
                    ...state.entities,
                    teams: {
                        ...state.entities.teams,
                        currentTeamId: '',
                    },
                },
            },
        );

        expect(container.querySelector('#grokAgentButton')).toBeNull();
    });
});
