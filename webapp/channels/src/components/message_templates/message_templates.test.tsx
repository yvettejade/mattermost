// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {MemoryRouter, Route} from 'react-router-dom';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import MessageTemplates from './message_templates';

const team = TestHelper.getTeamMock({id: 'team1', name: 'team1'});

const baseState: DeepPartial<GlobalState> = {
    entities: {
        teams: {
            currentTeamId: 'team1',
            teams: {
                team1: team,
            },
        },
        users: {
            currentUserId: 'user1',
            profiles: {
                user1: TestHelper.getUserMock({id: 'user1'}),
            },
        },
    },
};

describe('components/message_templates/MessageTemplates', () => {
    beforeEach(() => {
        jest.mocked(getHistory().push).mockClear();
    });

    test('renders the templates list', () => {
        renderWithContext(
            <MessageTemplates/>,
            baseState,
        );

        expect(screen.getByRole('heading', {name: 'Templates'})).toBeVisible();
        expect(screen.getByRole('table', {name: 'Message templates'})).toBeVisible();
        expect(screen.getByText('Daily standup')).toBeVisible();
        expect(screen.getByText('Incident update')).toBeVisible();
        expect(screen.getByText('Weekly status')).toBeVisible();
    });

    test('returns to drafts from the templates list', async () => {
        renderWithContext(
            <MemoryRouter initialEntries={['/team1/templates']}>
                <Route path='/:team/templates'>
                    <MessageTemplates/>
                </Route>
            </MemoryRouter>,
            baseState,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Back to drafts'}));

        expect(getHistory().push).toHaveBeenCalledWith('/team1/drafts');
    });
});
