// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    DEMO_BORROWING_ASSUMPTIONS,
    estimateBorrowingPower,
    formatNzd,
} from './borrowing_power';

describe('estimateBorrowingPower', () => {
    test('returns a positive estimate for the demo assumptions', () => {
        expect(estimateBorrowingPower(DEMO_BORROWING_ASSUMPTIONS)).toBeGreaterThan(0);
    });

    test('returns zero when living costs and expenses consume income', () => {
        expect(estimateBorrowingPower({
            ...DEMO_BORROWING_ASSUMPTIONS,
            annualIncome: 12000,
            monthlyExpenses: 500,
            monthlyLivingCosts: 800,
        })).toBe(0);
    });

    test('a higher interest rate reduces the estimate', () => {
        const base = estimateBorrowingPower(DEMO_BORROWING_ASSUMPTIONS);
        const higherRate = estimateBorrowingPower({
            ...DEMO_BORROWING_ASSUMPTIONS,
            annualInterestRatePercent: 8.5,
        });

        expect(higherRate).toBeLessThan(base);
    });

    test('zero interest uses surplus times the term in months', () => {
        expect(estimateBorrowingPower({
            annualIncome: 12000,
            monthlyExpenses: 0,
            monthlyLivingCosts: 0,
            annualInterestRatePercent: 0,
            termYears: 1,
        })).toBe(12000);
    });
});

describe('formatNzd', () => {
    test('formats whole New Zealand dollars', () => {
        expect(formatNzd(95000)).toMatch(/95,000/);
    });
});
