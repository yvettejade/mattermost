// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    EMPTY_TRANSACTION_FILTERS,
    addCalendarDays,
    buildDemoTransactions,
    categoriesForAccount,
    filterTransactions,
    formatNzd,
    getYearMonth,
    hasActiveFilters,
    resolveDateRange,
    toIsoDate,
} from './transactions';
import type {TransactionFilters} from './types';

describe('account_detail/transactions', () => {
    const now = new Date('2026-08-17T12:00:00+12:00');

    function filters(patch: Partial<TransactionFilters> = {}): TransactionFilters {
        return {...EMPTY_TRANSACTION_FILTERS, ...patch};
    }

    test('toIsoDate and getYearMonth use the NZ calendar day', () => {
        expect(toIsoDate(now)).toBe('2026-08-17');
        expect(getYearMonth(now)).toEqual({year: 2026, month: 8});
    });

    test('addCalendarDays stays on calendar dates', () => {
        expect(addCalendarDays('2026-08-17', -20)).toBe('2026-07-28');
        expect(addCalendarDays('2026-08-17', -29)).toBe('2026-07-19');
        expect(addCalendarDays('2026-08-17', -89)).toBe('2026-05-20');
    });

    test('this month, last 30, and last 90 resolve inclusive NZ ranges', () => {
        expect(resolveDateRange(filters({datePreset: 'this-month'}), now)).toEqual({
            kind: 'range',
            from: '2026-08-01',
            to: '2026-08-17',
        });
        expect(resolveDateRange(filters({datePreset: 'last-30'}), now)).toEqual({
            kind: 'range',
            from: '2026-07-19',
            to: '2026-08-17',
        });
        expect(resolveDateRange(filters({datePreset: 'last-90'}), now)).toEqual({
            kind: 'range',
            from: '2026-05-20',
            to: '2026-08-17',
        });
    });

    test('custom from after to is invalid', () => {
        expect(resolveDateRange(filters({
            datePreset: 'custom',
            customFrom: '2026-08-20',
            customTo: '2026-08-01',
        }), now)).toEqual({kind: 'invalid'});
    });

    test('YouMoney this month excludes last-month and older rows', () => {
        const visible = filterTransactions(buildDemoTransactions(now), 'youmoney', filters({datePreset: 'this-month'}), now);

        expect(visible.map((row) => row.id)).toEqual(['ym-woolworths', 'ym-coffee', 'ym-transfer']);
    });

    test('last 30 days includes late July but not early July', () => {
        const visible = filterTransactions(buildDemoTransactions(now), 'youmoney', filters({datePreset: 'last-30'}), now);

        expect(visible.map((row) => row.id)).toEqual(['ym-woolworths', 'ym-coffee', 'ym-at', 'ym-transfer']);
    });

    test('last 90 days includes bills but not salary', () => {
        const visible = filterTransactions(buildDemoTransactions(now), 'youmoney', filters({datePreset: 'last-90'}), now);

        expect(visible.map((row) => row.id)).toEqual(['ym-woolworths', 'ym-coffee', 'ym-at', 'ym-power', 'ym-transfer']);
    });

    test('text, category, and date range combine with AND', () => {
        const visible = filterTransactions(
            buildDemoTransactions(now),
            'youmoney',
            filters({query: 'wool', category: 'Groceries', datePreset: 'this-month'}),
            now,
        );

        expect(visible.map((row) => row.id)).toEqual(['ym-woolworths']);
    });

    test('invalid custom range does not apply the date constraint', () => {
        const visible = filterTransactions(
            buildDemoTransactions(now),
            'youmoney',
            filters({datePreset: 'custom', customFrom: '2026-08-20', customTo: '2026-08-01'}),
            now,
        );

        expect(visible).toHaveLength(6);
    });

    test('clearing filters is the empty filter object', () => {
        expect(hasActiveFilters(filters({query: 'wool', datePreset: 'last-30'}))).toBe(true);
        expect(hasActiveFilters(EMPTY_TRANSACTION_FILTERS)).toBe(false);
        expect(filterTransactions(buildDemoTransactions(now), 'youmoney', EMPTY_TRANSACTION_FILTERS, now)).toHaveLength(6);
    });

    test('categories are unique to the selected account', () => {
        expect(categoriesForAccount(buildDemoTransactions(now), 'youmoney')).toEqual([
            'Bills',
            'Eating out',
            'Groceries',
            'Income',
            'Transfers',
            'Transport',
        ]);
        expect(categoriesForAccount(buildDemoTransactions(now), 'rapid-save')).toEqual(['Income', 'Transfers']);
    });

    test('formatNzd uses New Zealand currency', () => {
        expect(formatNzd(-86.4)).toMatch(/86\.40/);
    });
});
