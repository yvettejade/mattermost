// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';

import DraftsAndSchedulePostsPageHeader from './drafts_and_schedule_posts_page_header';

describe('components/drafts/DraftsAndSchedulePostsPageHeader', () => {
    beforeEach(() => {
        (getHistory().push as jest.Mock).mockClear();
    });

    test('Transfer navigates to the team own-account transfer page', async () => {
        const history = createMemoryHistory({initialEntries: ['/team1/drafts']});

        renderWithContext(
            (
                <DraftsAndSchedulePostsPageHeader>
                    <div>{'drafts-list'}</div>
                </DraftsAndSchedulePostsPageHeader>
            ),
            {},
            {history},
        );

        expect(screen.getByRole('heading', {name: 'Drafts'})).toBeInTheDocument();
        expect(screen.getByText('drafts-list')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: 'Transfer'}));

        expect(getHistory().push).toHaveBeenCalledWith('/team1/transfer');
    });
});
