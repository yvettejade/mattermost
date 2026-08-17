// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import {calculateRepayment, EXAMPLE_HOME_LOAN_PRINCIPAL, EXAMPLE_HOME_LOAN_TERM_YEARS} from './repayment_math';
import Calculators from './calculators';

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

describe('components/calculators/Calculators', () => {
    beforeEach(() => {
        mockSelectLhsItem.mockClear();
    });

    test('renders the repayments calculator using the shared repayment maths', () => {
        renderWithContext(<Calculators/>);

        expect(screen.getByRole('heading', {name: 'Calculators'})).toBeVisible();
        expect(document.getElementById('repayments')).toBeTruthy();
        expect(document.getElementById('borrowing')).toBeTruthy();
        expect(document.getElementById('savings-goal')).toBeTruthy();
        expect(document.getElementById('foreign-exchange')).toBeTruthy();

        const expected = calculateRepayment({
            principal: EXAMPLE_HOME_LOAN_PRINCIPAL,
            annualRatePercent: 5.99,
            termYears: EXAMPLE_HOME_LOAN_TERM_YEARS,
            frequency: 'weekly',
        });
        expect(screen.getByTestId('calculators-repayment-result')).toHaveTextContent(
            new Intl.NumberFormat('en', {style: 'currency', currency: 'AUD'}).format(expected),
        );
        expect(screen.getByText('This is not financial advice. Figures are indicative only.')).toBeVisible();
        expect(mockSelectLhsItem).toHaveBeenCalledWith(LhsItemType.Page, LhsPage.Drafts);
    });

    test('recalculates when the advertised rate changes', async () => {
        renderWithContext(<Calculators/>);

        const rateInput = screen.getByLabelText('Interest rate (% p.a.)');
        await userEvent.clear(rateInput);
        await userEvent.type(rateInput, '6');

        const expected = calculateRepayment({
            principal: EXAMPLE_HOME_LOAN_PRINCIPAL,
            annualRatePercent: 6,
            termYears: EXAMPLE_HOME_LOAN_TERM_YEARS,
            frequency: 'weekly',
        });
        expect(screen.getByTestId('calculators-repayment-result')).toHaveTextContent(
            new Intl.NumberFormat('en', {style: 'currency', currency: 'AUD'}).format(expected),
        );
    });
});
