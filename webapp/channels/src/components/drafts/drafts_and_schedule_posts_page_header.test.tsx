// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {MemoryRouter, Route, Switch} from 'react-router-dom';

import type {DeepPartial} from '@mattermost/types/utilities';

import MessageTemplates from 'components/message_templates';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import DraftsAndSchedulePostsPageHeader from './drafts_and_schedule_posts_page_header';

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

function renderDraftsPage() {
    return renderWithContext(
        <MemoryRouter initialEntries={['/team1/drafts']}>
            <Switch>
                <Route path='/:team/drafts'>
                    <DraftsAndSchedulePostsPageHeader>
                        <div>{'Reports table'}</div>
                    </DraftsAndSchedulePostsPageHeader>
                </Route>
                <Route path='/:team/templates'>
                    <MessageTemplates/>
                </Route>
            </Switch>
        </MemoryRouter>,
        baseState,
    );
}

describe('components/drafts/DraftsAndSchedulePostsPageHeader', () => {
    test('renders the Templates control next to the drafts heading', () => {
        renderDraftsPage();

        expect(screen.getByRole('heading', {name: 'Drafts'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Templates'})).toBeInTheDocument();
        expect(screen.getByText('Reports table')).toBeInTheDocument();
    });

    test('navigates to the templates list when Templates is clicked', async () => {
        renderDraftsPage();

        await userEvent.click(screen.getByRole('button', {name: 'Templates'}));

        expect(screen.getByRole('heading', {name: 'Templates'})).toBeVisible();
        expect(screen.getByRole('table', {name: 'Message templates'})).toBeVisible();
        expect(screen.getByText('Daily standup')).toBeVisible();
        expect(screen.queryByText('Reports table')).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', {name: 'Drafts'})).not.toBeInTheDocument();
    });
});
