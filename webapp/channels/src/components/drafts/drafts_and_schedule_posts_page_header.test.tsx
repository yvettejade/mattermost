// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';
import {DRAFT_URL_SUFFIX, TEMPLATES_URL_SUFFIX} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import DraftsAndSchedulePostsPageHeader from './drafts_and_schedule_posts_page_header';

describe('components/drafts/drafts_and_schedule_posts_page_header', () => {
    const initialState = {
        entities: {
            teams: {
                currentTeamId: 'team1',
                teams: {
                    team1: TestHelper.getTeamMock({id: 'team1', name: 'team1'}),
                },
            },
        },
    };

    beforeEach(() => {
        (getHistory().push as jest.Mock).mockClear();
    });

    test('renders Templates next to New draft', () => {
        renderWithContext(
            <DraftsAndSchedulePostsPageHeader>
                <div>{'drafts table'}</div>
            </DraftsAndSchedulePostsPageHeader>,
            initialState,
        );

        expect(screen.getByRole('button', {name: 'Templates'})).toBeVisible();
        expect(screen.getByRole('button', {name: 'New draft'})).toBeVisible();
        expect(screen.getByText('drafts table')).toBeVisible();
    });

    test('Templates navigates to the templates list', async () => {
        renderWithContext(
            <DraftsAndSchedulePostsPageHeader>
                <div>{'drafts table'}</div>
            </DraftsAndSchedulePostsPageHeader>,
            initialState,
        );

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', {name: 'Templates'}));

        expect(getHistory().push).toHaveBeenCalledWith(`/team1/${TEMPLATES_URL_SUFFIX}`);
    });

    test('New draft stays on the drafts list', async () => {
        renderWithContext(
            <DraftsAndSchedulePostsPageHeader>
                <div>{'drafts table'}</div>
            </DraftsAndSchedulePostsPageHeader>,
            initialState,
        );

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', {name: 'New draft'}));

        expect(getHistory().push).toHaveBeenCalledWith(`/team1/${DRAFT_URL_SUFFIX}`);
        expect(getHistory().push).not.toHaveBeenCalledWith(`/team1/${TEMPLATES_URL_SUFFIX}`);
    });
});
