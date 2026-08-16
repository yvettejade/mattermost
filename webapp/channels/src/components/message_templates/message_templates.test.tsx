// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {MemoryRouter, Route, Switch} from 'react-router-dom';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
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
    test('renders the templates list', () => {
        renderWithContext(
            <MemoryRouter initialEntries={['/team1/templates']}>
                <MessageTemplates/>
            </MemoryRouter>,
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
                <Switch>
                    <Route path='/:team/templates'>
                        <MessageTemplates/>
                    </Route>
                    <Route path='/:team/drafts'>
                        <div>{'Drafts list'}</div>
                    </Route>
                </Switch>
            </MemoryRouter>,
            baseState,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Back to drafts'}));

        expect(screen.getByText('Drafts list')).toBeVisible();
        expect(screen.queryByRole('heading', {name: 'Templates'})).not.toBeInTheDocument();
    });
});
