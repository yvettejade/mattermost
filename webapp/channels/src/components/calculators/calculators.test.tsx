// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {DEMO_BORROWING_ASSUMPTIONS, estimateBorrowingPower, formatNzd} from './borrowing_power';
import Calculators from './calculators';

describe('components/calculators/Calculators', () => {
    test('renders the borrowing power calculator and demo assumptions', () => {
        renderWithContext(<Calculators/>);

        expect(screen.getByRole('heading', {name: 'Calculators'})).toBeVisible();
        expect(document.getElementById('borrowing')).toBeTruthy();
        expect(screen.getByRole('heading', {name: 'Borrowing power'})).toBeVisible();
        expect(screen.getByRole('heading', {name: 'Assumptions'})).toBeVisible();
        expect(screen.getByText(`Example income: ${formatNzd(DEMO_BORROWING_ASSUMPTIONS.annualIncome)} a year`)).toBeVisible();
        expect(screen.getByText(`Expenses: ${formatNzd(DEMO_BORROWING_ASSUMPTIONS.monthlyExpenses)} a month`)).toBeVisible();
        expect(screen.getByText(`Living costs: ${formatNzd(DEMO_BORROWING_ASSUMPTIONS.monthlyLivingCosts)} a month`)).toBeVisible();
        expect(screen.getByText(`Interest rate used: ${DEMO_BORROWING_ASSUMPTIONS.annualInterestRatePercent}% p.a.`)).toBeVisible();
        expect(screen.getByText('This estimate is not a quote or approval. Lending criteria apply. This is not legal or financial advice.')).toBeVisible();
        expect(screen.getByText(`Estimated borrowing power: ${formatNzd(estimateBorrowingPower(DEMO_BORROWING_ASSUMPTIONS))}`)).toBeVisible();
    });

    test('keeps the demo assumption list when the estimate inputs change', async () => {
        renderWithContext(<Calculators/>);

        await userEvent.clear(screen.getByLabelText('Annual income'));
        await userEvent.type(screen.getByLabelText('Annual income'), '200000');

        expect(screen.getByText(`Example income: ${formatNzd(DEMO_BORROWING_ASSUMPTIONS.annualIncome)} a year`)).toBeVisible();
        expect(screen.queryByText(`Estimated borrowing power: ${formatNzd(estimateBorrowingPower(DEMO_BORROWING_ASSUMPTIONS))}`)).not.toBeInTheDocument();
        expect(screen.getByText(`Estimated borrowing power: ${formatNzd(estimateBorrowingPower({
            ...DEMO_BORROWING_ASSUMPTIONS,
            annualIncome: 200000,
        }))}`)).toBeVisible();
    });
});
