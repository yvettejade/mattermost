// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {
    formatHomeLoanRateLabel,
    formatHomeLoanTermLabel,
    HOME_LOAN_SPECIALS,
} from 'components/home_loan_rates/home_loan_rates';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import HomeLoans from './home_loans';

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

describe('components/home_loans/HomeLoans', () => {
    beforeEach(() => {
        (global as any).historyMock.push.mockClear();
    });

    test('lists every catalog special with shared rate, term, and occupancy', () => {
        renderWithContext(<HomeLoans/>, initialState);

        expect(screen.getByRole('heading', {name: 'Home loans'})).toBeVisible();
        expect(screen.getByTestId('home-loan-specials').children).toHaveLength(HOME_LOAN_SPECIALS.length);

        for (const special of HOME_LOAN_SPECIALS) {
            expect(screen.getByTestId(`home-loan-special-rate-${special.id}`)).toHaveTextContent(formatHomeLoanRateLabel(special));
            expect(screen.getByTestId(`home-loan-special-term-${special.id}`)).toHaveTextContent(formatHomeLoanTermLabel(special));
            expect(screen.getByTestId(`home-loan-special-occupancy-${special.id}`)).toHaveTextContent(special.occupancy);
        }
    });

    test('Rates opens the home-loans rates hash', async () => {
        renderWithContext(<HomeLoans/>, initialState);

        await userEvent.click(screen.getByRole('button', {name: 'Rates'}));

        expect((global as any).historyMock.push).toHaveBeenCalledWith('/test-team/rates#home-loans');
    });
});
