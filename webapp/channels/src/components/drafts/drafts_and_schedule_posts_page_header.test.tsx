// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';
import {ONLINE_URL_SUFFIX} from 'utils/constants';
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

    test('renders Everyday money on the drafts header', () => {
        renderWithContext(
            <DraftsAndSchedulePostsPageHeader>
                <div>{'drafts table'}</div>
            </DraftsAndSchedulePostsPageHeader>,
            initialState,
        );

        expect(screen.getByRole('button', {name: 'Everyday money'})).toBeVisible();
        expect(screen.getByText('drafts table')).toBeVisible();
    });

    test('Everyday money navigates to the online accounts overview', async () => {
        renderWithContext(
            <DraftsAndSchedulePostsPageHeader>
                <div>{'drafts table'}</div>
            </DraftsAndSchedulePostsPageHeader>,
            initialState,
        );

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', {name: 'Everyday money'}));

        expect(getHistory().push).toHaveBeenCalledWith(`/team1/${ONLINE_URL_SUFFIX}`);
    });
});
