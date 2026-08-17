// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {
    CALCULATORS_REPAYMENTS_HREF,
    EXAMPLE_HOME_LOAN_OCCUPANCY,
    EXAMPLE_HOME_LOAN_PRINCIPAL,
    EXAMPLE_HOME_LOAN_TERM_YEARS,
    indicativeWeeklyRepayment,
} from 'components/calculators/repayment_math';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';
import {TestHelper} from 'utils/test_helper';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import {HOME_LOAN_SPECIALS} from './home_loan_specials';
import HomeLoans from './home_loans';

const mockSelectLhsItem = jest.fn((type: string, id?: string) => {
    return {type: 'SELECT_LHS_ITEM', meta: {lhsType: type, id}};
});

jest.mock('actions/views/lhs', () => ({
    selectLhsItem: (type: string, id?: string) => mockSelectLhsItem(type, id),
}));

jest.mock('actions/views/rhs', () => ({
    suppressRHS: {type: 'SUPPRESS_RHS'},
    unsuppressRHS: {type: 'UNSUPPRESS_RHS'},
}));

const initialState = {
    entities: {
        teams: {
            currentTeamId: 'team1',
            teams: {
                team1: TestHelper.getTeamMock({id: 'team1', name: 'test-team'}),
            },
        },
    },
};

describe('components/home_loans/HomeLoans', () => {
    beforeEach(() => {
        mockSelectLhsItem.mockClear();
        (getHistory().push as jest.Mock).mockClear();
    });

    test('shows an indicative weekly repayment on each featured special', () => {
        renderWithContext(<HomeLoans/>, initialState);

        expect(screen.getByRole('heading', {name: 'Home loans'})).toBeVisible();
        expect(screen.getAllByTestId('home-loan-special')).toHaveLength(HOME_LOAN_SPECIALS.length);
        expect(screen.getByTestId('home-loans-example')).toHaveTextContent(
            new Intl.NumberFormat('en', {style: 'currency', currency: 'AUD', maximumFractionDigits: 0}).format(EXAMPLE_HOME_LOAN_PRINCIPAL),
        );
        expect(screen.getByTestId('home-loans-example')).toHaveTextContent(String(EXAMPLE_HOME_LOAN_TERM_YEARS));
        expect(screen.getByTestId('home-loans-example')).toHaveTextContent(EXAMPLE_HOME_LOAN_OCCUPANCY);
        expect(screen.getByTestId('home-loans-disclaimer')).toHaveTextContent('not financial advice');

        for (const special of HOME_LOAN_SPECIALS) {
            const weekly = indicativeWeeklyRepayment(special.annualRatePercent);
            expect(screen.getByTestId(`home-loan-weekly-${special.id}`)).toHaveTextContent(
                new Intl.NumberFormat('en', {style: 'currency', currency: 'AUD'}).format(weekly),
            );
        }

        expect(mockSelectLhsItem).toHaveBeenCalledWith(LhsItemType.Page, LhsPage.Drafts);
    });

    test('Work out your repayments goes to the repayments calculator', async () => {
        renderWithContext(<HomeLoans/>, initialState);

        await userEvent.click(screen.getByRole('button', {name: 'Work out your repayments'}));

        expect(getHistory().push).toHaveBeenCalledWith(`/test-team${CALCULATORS_REPAYMENTS_HREF}`);
    });
});
