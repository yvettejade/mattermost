// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';

import SiteSearch from './site_search';

jest.mock('actions/views/rhs', () => ({
    suppressRHS: {type: 'SUPPRESS_RHS'},
    unsuppressRHS: {type: 'UNSUPPRESS_RHS'},
}));

const initialState = {
    entities: {
        teams: {
            currentTeamId: 'team1',
            teams: {
                team1: {id: 'team1', name: 'test-team', display_name: 'Test Team'},
            },
        },
    },
};

describe('components/site_search/SiteSearch', () => {
    beforeEach(() => {
        (getHistory().push as jest.Mock).mockClear();
    });

    test('returns Tool results for calculator queries and keeps product results', async () => {
        renderWithContext(<SiteSearch/>, initialState);

        expect(screen.getByRole('heading', {name: 'Site search'})).toBeVisible();

        await userEvent.type(screen.getByRole('searchbox', {name: 'Search the site'}), 'repayments');

        expect(screen.getByText('Tool')).toBeVisible();
        expect(screen.getByText('Repayments calculator')).toBeVisible();
        expect(screen.getByText('Home loan')).toBeVisible();
    });

    test('navigates to the calculator hash from a Tool result', async () => {
        renderWithContext(<SiteSearch/>, initialState);

        await userEvent.type(screen.getByRole('searchbox', {name: 'Search the site'}), 'borrowing');
        await userEvent.click(screen.getByRole('button', {name: /Borrowing power calculator/i}));

        expect(getHistory().push).toHaveBeenCalledWith('/test-team/calculators#borrowing');
    });
});
