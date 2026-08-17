// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AccountKind, DemoTransaction, OtherThisMonth, ThisMonthSpendSummary} from './types';

export const NZ_TIME_ZONE = 'Pacific/Auckland';

export function getYearMonth(date: Date, timeZone = NZ_TIME_ZONE): {year: number; month: number} {
    const parts = new Intl.DateTimeFormat('en-NZ', {
        timeZone,
        year: 'numeric',
        month: 'numeric',
    }).formatToParts(date);

    return {
        year: Number(parts.find((part) => part.type === 'year')?.value),
        month: Number(parts.find((part) => part.type === 'month')?.value),
    };
}

export function previousYearMonth(year: number, month: number): {year: number; month: number} {
    if (month === 1) {
        return {year: year - 1, month: 12};
    }

    return {year, month: month - 1};
}

function padMonth(month: number): string {
    return String(month).padStart(2, '0');
}

export function isInCalendarMonth(isoDate: string, now: Date, timeZone = NZ_TIME_ZONE): boolean {
    const current = getYearMonth(now, timeZone);

    // Noon NZST keeps the calendar day stable across NZST/NZDT when we only have a date.
    const transaction = getYearMonth(new Date(`${isoDate}T12:00:00+12:00`), timeZone);

    return transaction.year === current.year && transaction.month === current.month;
}

export function buildDemoTransactions(now = new Date()): DemoTransaction[] {
    const {year, month} = getYearMonth(now);
    const previous = previousYearMonth(year, month);
    const thisMonth = `${year}-${padMonth(month)}`;
    const lastMonth = `${previous.year}-${padMonth(previous.month)}`;

    return [
        {id: 'tx-groceries-1', accountKind: 'transaction', category: 'Groceries', amount: 186.4, type: 'spend', date: `${thisMonth}-03`},
        {id: 'tx-groceries-2', accountKind: 'transaction', category: 'Groceries', amount: 72.15, type: 'spend', date: `${thisMonth}-14`},
        {id: 'tx-eating-out-1', accountKind: 'transaction', category: 'Eating out', amount: 54.8, type: 'spend', date: `${thisMonth}-06`},
        {id: 'tx-eating-out-2', accountKind: 'transaction', category: 'Eating out', amount: 38.5, type: 'spend', date: `${thisMonth}-19`},
        {id: 'tx-transport', accountKind: 'transaction', category: 'Transport', amount: 41.2, type: 'spend', date: `${thisMonth}-11`},
        {id: 'tx-bills', accountKind: 'transaction', category: 'Bills', amount: 129, type: 'spend', date: `${thisMonth}-02`},
        {id: 'tx-income', accountKind: 'transaction', category: 'Income', amount: 4200, type: 'income', date: `${thisMonth}-01`},
        {id: 'tx-transfer', accountKind: 'transaction', category: 'Transfers', amount: 250, type: 'transfer', date: `${thisMonth}-08`},
        {id: 'tx-last-month', accountKind: 'transaction', category: 'Groceries', amount: 99, type: 'spend', date: `${lastMonth}-22`},
        {id: 'cc-last-month', accountKind: 'credit', category: 'Eating out', amount: 45.6, type: 'spend', date: `${lastMonth}-18`},
    ];
}

export function summarizeThisMonthSpend(
    transactions: DemoTransaction[],
    accountKind: AccountKind,
    now = new Date(),
): ThisMonthSpendSummary {
    const thisMonth = transactions.filter((transaction) => (
        transaction.accountKind === accountKind && isInCalendarMonth(transaction.date, now)
    ));

    const spendByCategory = new Map<string, number>();
    const otherTotals: Record<OtherThisMonth['kind'], number> = {
        income: 0,
        transfer: 0,
    };

    thisMonth.forEach((transaction) => {
        if (transaction.type === 'spend') {
            spendByCategory.set(transaction.category, (spendByCategory.get(transaction.category) || 0) + transaction.amount);
            return;
        }

        otherTotals[transaction.type] += transaction.amount;
    });

    const spendTotal = [...spendByCategory.values()].reduce((sum, amount) => sum + amount, 0);
    const spend = [...spendByCategory.entries()].
        map(([category, amount]) => ({
            category,
            amount,
            percent: spendTotal === 0 ? 0 : Math.round((amount / spendTotal) * 100),
        })).
        sort((left, right) => right.amount - left.amount || left.category.localeCompare(right.category));

    const other: OtherThisMonth[] = (['income', 'transfer'] as const).
        filter((kind) => otherTotals[kind] > 0).
        map((kind) => ({kind, amount: otherTotals[kind]}));

    return {
        spend,
        spendTotal,
        other,
    };
}

export function formatNzd(amount: number): string {
    return new Intl.NumberFormat('en-NZ', {
        style: 'currency',
        currency: 'NZD',
    }).format(amount);
}
