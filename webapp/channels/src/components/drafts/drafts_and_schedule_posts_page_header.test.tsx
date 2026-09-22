// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';
import {HOME_LOANS_URL_SUFFIX} from 'utils/constants';
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

    test('renders Home loans on the drafts header', () => {
        renderWithContext(
            <DraftsAndSchedulePostsPageHeader>
                <div>{'drafts table'}</div>
            </DraftsAndSchedulePostsPageHeader>,
            initialState,
        );

        expect(screen.getByRole('button', {name: 'Home loans'})).toBeVisible();
        expect(screen.getByText('drafts table')).toBeVisible();
    });

    test('Home loans navigates to featured specials', async () => {
        renderWithContext(
            <DraftsAndSchedulePostsPageHeader>
                <div>{'drafts table'}</div>
            </DraftsAndSchedulePostsPageHeader>,
            initialState,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Home loans'}));

        expect(getHistory().push).toHaveBeenCalledWith(`/team1/${HOME_LOANS_URL_SUFFIX}`);
    });
});
