// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {
    FEATURED_HOME_LOAN_SPECIAL_ID,
    formatHomeLoanRateLabel,
    formatHomeLoanTermLabel,
    getFeaturedHomeLoanSpecial,
    HOME_LOAN_SPECIALS,
    HOME_LOANS_RATES_HASH,
} from 'components/home_loan_rates/home_loan_rates';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import Rates from './rates';

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

describe('components/rates/Rates', () => {
    test('home-loans table lists every catalog special', () => {
        renderWithContext(<Rates/>, initialState);

        const featured = getFeaturedHomeLoanSpecial();

        expect(screen.getByRole('heading', {name: 'Rates'})).toBeVisible();
        expect(screen.getByTestId('home-loans-rates')).toHaveAttribute('id', HOME_LOANS_RATES_HASH);
        expect(screen.getByTestId(`home-loan-rate-row-${FEATURED_HOME_LOAN_SPECIAL_ID}`)).toBeVisible();

        for (const special of HOME_LOAN_SPECIALS) {
            expect(screen.getByTestId(`home-loan-rate-${special.id}`)).toHaveTextContent(formatHomeLoanRateLabel(special));
            expect(screen.getByTestId(`home-loan-term-${special.id}`)).toHaveTextContent(formatHomeLoanTermLabel(special));
            expect(screen.getByTestId(`home-loan-occupancy-${special.id}`)).toHaveTextContent(special.occupancy);
        }

        expect(screen.getByTestId(`home-loan-rate-${FEATURED_HOME_LOAN_SPECIAL_ID}`)).toHaveTextContent(formatHomeLoanRateLabel(featured));
    });
});
