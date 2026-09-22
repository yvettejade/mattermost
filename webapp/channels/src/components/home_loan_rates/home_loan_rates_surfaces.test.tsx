// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Home from 'components/home/home';
import HomeLoans from 'components/home_loans/home_loans';
import Rates from 'components/rates/rates';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import {FEATURED_HOME_LOAN_SPECIAL_ID, HOME_LOAN_SMALL_PRINT} from './home_loan_rates';

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

describe('home-loan rate surfaces', () => {
    test('featured homepage special matches the rates table and home-loans page', () => {
        const {unmount} = renderWithContext(<Home/>, initialState);

        const heroRate = screen.getByTestId('home-loan-hero-rate').textContent;
        const heroTerm = screen.getByTestId('home-loan-hero-term').textContent;
        const heroOccupancy = screen.getByTestId('home-loan-hero-occupancy').textContent;
        const heroFee = screen.getByTestId('home-loan-establishment-fee').textContent;
        const heroTerms = screen.getByTestId('home-loan-terms').textContent;
        const promo = screen.getByTestId(`home-loan-promo-${FEATURED_HOME_LOAN_SPECIAL_ID}`);

        expect(heroRate).toBeTruthy();
        expect(promo).toHaveTextContent(heroRate!);
        expect(promo).toHaveTextContent(heroTerm!);
        expect(promo).toHaveTextContent(heroOccupancy!);
        expect(heroFee).toBe(HOME_LOAN_SMALL_PRINT.establishmentFee);
        expect(heroTerms).toBe(HOME_LOAN_SMALL_PRINT.terms);

        unmount();

        const ratesRender = renderWithContext(<Rates/>, initialState);
        const ratesRow = screen.getByTestId(`home-loan-rate-row-${FEATURED_HOME_LOAN_SPECIAL_ID}`);

        expect(ratesRow).toHaveTextContent(heroRate!);
        expect(ratesRow).toHaveTextContent(heroTerm!);
        expect(ratesRow).toHaveTextContent(heroOccupancy!);
        expect(screen.getByTestId('home-loan-establishment-fee')).toHaveTextContent(heroFee!);
        expect(screen.getByTestId('home-loan-terms')).toHaveTextContent(heroTerms!);

        ratesRender.unmount();

        renderWithContext(<HomeLoans/>, initialState);

        expect(screen.getByTestId(`home-loan-special-rate-${FEATURED_HOME_LOAN_SPECIAL_ID}`)).toHaveTextContent(heroRate!);
        expect(screen.getByTestId(`home-loan-special-term-${FEATURED_HOME_LOAN_SPECIAL_ID}`)).toHaveTextContent(heroTerm!);
        expect(screen.getByTestId(`home-loan-special-occupancy-${FEATURED_HOME_LOAN_SPECIAL_ID}`)).toHaveTextContent(heroOccupancy!);
        expect(screen.getByTestId('home-loan-establishment-fee')).toHaveTextContent(heroFee!);
        expect(screen.getByTestId('home-loan-terms')).toHaveTextContent(heroTerms!);
    });
});
