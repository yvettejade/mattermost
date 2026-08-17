// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    buildDemoTransactions,
    formatNzd,
    getYearMonth,
    previousYearMonth,
    summarizeThisMonthSpend,
} from './transactions';
import type {DemoTransaction} from './types';

describe('account_detail/transactions', () => {
    const now = new Date('2026-08-17T12:00:00+12:00');

    test('getYearMonth uses the NZ calendar month', () => {
        expect(getYearMonth(now)).toEqual({year: 2026, month: 8});
    });

    test('previousYearMonth wraps December to January', () => {
        expect(previousYearMonth(2026, 1)).toEqual({year: 2025, month: 12});
        expect(previousYearMonth(2026, 8)).toEqual({year: 2026, month: 7});
    });

    test('transaction account summarizes this-month spend and keeps income and transfers separate', () => {
        const summary = summarizeThisMonthSpend(buildDemoTransactions(now), 'transaction', now);

        expect(summary.spend.map((row) => row.category)).toEqual(['Groceries', 'Bills', 'Eating out', 'Transport']);
        expect(summary.spend.find((row) => row.category === 'Groceries')?.amount).toBeCloseTo(258.55);
        expect(summary.spendTotal).toBeCloseTo(522.05);
        expect(summary.other).toEqual([
            {kind: 'income', amount: 4200},
            {kind: 'transfer', amount: 250},
        ]);
        expect(summary.spend.some((row) => row.category === 'Income')).toBe(false);
        expect(summary.spend.some((row) => row.category === 'Transfers')).toBe(false);
    });

    test('last-month spend is excluded from this-month totals', () => {
        const summary = summarizeThisMonthSpend(buildDemoTransactions(now), 'transaction', now);
        const groceries = summary.spend.find((row) => row.category === 'Groceries');

        expect(groceries?.amount).toBeCloseTo(258.55);
        expect(groceries?.amount).not.toBeCloseTo(357.55);
    });

    test('credit account with no this-month spend returns an empty summary', () => {
        const summary = summarizeThisMonthSpend(buildDemoTransactions(now), 'credit', now);

        expect(summary.spend).toEqual([]);
        expect(summary.spendTotal).toBe(0);
        expect(summary.other).toEqual([]);
    });

    test('explicit empty transactions stay empty', () => {
        const transactions: DemoTransaction[] = [];
        const summary = summarizeThisMonthSpend(transactions, 'transaction', now);

        expect(summary.spend).toEqual([]);
        expect(summary.spendTotal).toBe(0);
    });

    test('formatNzd uses New Zealand currency', () => {
        expect(formatNzd(186.4)).toMatch(/186\.40/);
    });
});
