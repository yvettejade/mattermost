// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';

import AssistantLink from './assistant_link';

describe('components/assistant_link/AssistantLink', () => {
    const state = {
        entities: {
            teams: {
                currentTeamId: 'team1',
                teams: {team1: {id: 'team1', name: 'team1'}},
            },
            users: {
                currentUserId: 'user1',
                profiles: {user1: {id: 'user1'}},
            },
        },
    };

    test('renders nothing without a current team', () => {
        const {container} = renderWithContext(<AssistantLink/>, {entities: {teams: {currentTeamId: ''}}});
        expect(container).toBeEmptyDOMElement();
    });

    test('opens the assistant modal when clicked', async () => {
        const {store} = renderWithContext(<AssistantLink/>, state);

        const button = screen.getByRole('button', {name: 'Ask Assistant'});
        expect(button).toHaveAttribute('aria-expanded', 'false');

        await userEvent.click(button);

        expect(store.getState().views.modals.modalState[ModalIdentifiers.ASSISTANT_MODAL].open).toBe(true);
        expect(button).toHaveAttribute('aria-expanded', 'true');
    });
});
