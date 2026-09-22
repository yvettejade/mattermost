// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {
    FEATURED_HOME_LOAN_SPECIAL_ID,
    formatHomeLoanRateLabel,
    formatHomeLoanSpecialLine,
    formatHomeLoanTermLabel,
    getFeaturedHomeLoanSpecial,
    HOME_LOAN_SPECIALS,
} from 'components/home_loan_rates/home_loan_rates';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import Home from './home';

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

describe('components/home/Home', () => {
    beforeEach(() => {
        (global as any).historyMock.push.mockClear();
    });

    test('hero and featured promo tile use the shared home-loan special', () => {
        renderWithContext(<Home/>, initialState);

        const featured = getFeaturedHomeLoanSpecial();

        expect(screen.getByRole('heading', {name: 'Home'})).toBeVisible();
        expect(screen.getByTestId('home-loan-hero')).toHaveAttribute('data-special', FEATURED_HOME_LOAN_SPECIAL_ID);
        expect(screen.getByTestId('home-loan-hero-line')).toHaveTextContent(formatHomeLoanSpecialLine(featured));
        expect(screen.getByTestId('home-loan-hero-rate')).toHaveTextContent(formatHomeLoanRateLabel(featured));
        expect(screen.getByTestId('home-loan-hero-term')).toHaveTextContent(formatHomeLoanTermLabel(featured));
        expect(screen.getByTestId('home-loan-hero-occupancy')).toHaveTextContent(featured.occupancy);
        expect(screen.getByTestId(`home-loan-promo-${FEATURED_HOME_LOAN_SPECIAL_ID}`)).toHaveTextContent(formatHomeLoanRateLabel(featured));
        expect(screen.getByTestId(`home-loan-promo-${FEATURED_HOME_LOAN_SPECIAL_ID}`)).toHaveTextContent(formatHomeLoanTermLabel(featured));
        expect(screen.getByTestId(`home-loan-promo-${FEATURED_HOME_LOAN_SPECIAL_ID}`)).toHaveTextContent(featured.occupancy);
        expect(screen.getAllByTestId(/home-loan-promo-/)).toHaveLength(HOME_LOAN_SPECIALS.length);
    });

    test('Rates opens the home-loans rates hash', async () => {
        renderWithContext(<Home/>, initialState);

        await userEvent.click(screen.getByRole('button', {name: 'Rates'}));

        expect((global as any).historyMock.push).toHaveBeenCalledWith('/test-team/rates#home-loans');
    });

    test('Home loans opens the home-loans page', async () => {
        renderWithContext(<Home/>, initialState);

        await userEvent.click(screen.getByRole('button', {name: 'Home loans'}));

        expect((global as any).historyMock.push).toHaveBeenCalledWith('/test-team/home-loans');
    });
});
