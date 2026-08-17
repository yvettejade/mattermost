// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AccountId, DemoTransaction, ResolvedDateRange, TransactionFilters} from './types';

export const NZ_TIME_ZONE = 'Pacific/Auckland';

export const EMPTY_TRANSACTION_FILTERS: TransactionFilters = {
    query: '',
    category: '',
    datePreset: '',
    customFrom: '',
    customTo: '',
};

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

function padDatePart(value: number): string {
    return String(value).padStart(2, '0');
}

export function toIsoDate(date: Date, timeZone = NZ_TIME_ZONE): string {
    const parts = new Intl.DateTimeFormat('en-NZ', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);

    return [
        parts.find((part) => part.type === 'year')?.value,
        parts.find((part) => part.type === 'month')?.value,
        parts.find((part) => part.type === 'day')?.value,
    ].join('-');
}

export function addCalendarDays(isoDate: string, days: number): string {
    const date = new Date(`${isoDate}T12:00:00+12:00`);
    date.setUTCDate(date.getUTCDate() + days);
    return toIsoDate(date);
}

export function resolveDateRange(filters: TransactionFilters, now: Date, timeZone = NZ_TIME_ZONE): ResolvedDateRange {
    const today = toIsoDate(now, timeZone);

    switch (filters.datePreset) {
    case 'this-month': {
        const {year, month} = getYearMonth(now, timeZone);
        return {kind: 'range', from: `${year}-${padDatePart(month)}-01`, to: today};
    }
    case 'last-30':
        return {kind: 'range', from: addCalendarDays(today, -29), to: today};
    case 'last-90':
        return {kind: 'range', from: addCalendarDays(today, -89), to: today};
    case 'custom': {
        const from = filters.customFrom;
        const to = filters.customTo;
        if (!from && !to) {
            return {kind: 'none'};
        }
        if (from && to && from > to) {
            return {kind: 'invalid'};
        }
        return {
            kind: 'range',
            from: from || '0000-01-01',
            to: to || '9999-12-31',
        };
    }
    default:
        return {kind: 'none'};
    }
}

function matchesQuery(transaction: DemoTransaction, query: string): boolean {
    const needle = query.trim().toLowerCase();
    if (!needle) {
        return true;
    }

    return transaction.description.toLowerCase().includes(needle) || transaction.category.toLowerCase().includes(needle);
}

function matchesDateRange(isoDate: string, range: ResolvedDateRange): boolean {
    if (range.kind !== 'range') {
        return true;
    }

    return isoDate >= range.from && isoDate <= range.to;
}

export function filterTransactions(
    transactions: DemoTransaction[],
    accountId: AccountId,
    filters: TransactionFilters,
    now: Date,
): DemoTransaction[] {
    const range = resolveDateRange(filters, now);

    return transactions.filter((transaction) => {
        if (transaction.accountId !== accountId) {
            return false;
        }
        if (!matchesQuery(transaction, filters.query)) {
            return false;
        }
        if (filters.category && transaction.category !== filters.category) {
            return false;
        }
        return matchesDateRange(transaction.date, range);
    });
}

export function categoriesForAccount(transactions: DemoTransaction[], accountId: AccountId): string[] {
    const categories = new Set<string>();
    transactions.forEach((transaction) => {
        if (transaction.accountId === accountId) {
            categories.add(transaction.category);
        }
    });
    return [...categories].sort((left, right) => left.localeCompare(right));
}

export function hasActiveFilters(filters: TransactionFilters): boolean {
    return Boolean(filters.query.trim() || filters.category || filters.datePreset || filters.customFrom || filters.customTo);
}

export function buildDemoTransactions(now = new Date()): DemoTransaction[] {
    const today = toIsoDate(now);
    const {year, month} = getYearMonth(now);
    const thisMonth = `${year}-${padDatePart(month)}`;

    return [
        {id: 'ym-woolworths', accountId: 'youmoney', description: 'Woolworths Grey Lynn', category: 'Groceries', amount: -86.4, date: `${thisMonth}-03`},
        {id: 'ym-coffee', accountId: 'youmoney', description: 'Allpress Espresso', category: 'Eating out', amount: -12.5, date: `${thisMonth}-14`},
        {id: 'ym-at', accountId: 'youmoney', description: 'AT Hop top up', category: 'Transport', amount: -20, date: addCalendarDays(today, -20)},
        {id: 'ym-power', accountId: 'youmoney', description: 'Mercury Energy', category: 'Bills', amount: -129, date: addCalendarDays(today, -45)},
        {id: 'ym-salary', accountId: 'youmoney', description: 'Salary', category: 'Income', amount: 4200, date: addCalendarDays(today, -100)},
        {id: 'ym-transfer', accountId: 'youmoney', description: 'Transfer to Rapid Save', category: 'Transfers', amount: -250, date: `${thisMonth}-08`},
        {id: 'rs-interest', accountId: 'rapid-save', description: 'Interest', category: 'Income', amount: 18.75, date: `${thisMonth}-01`},
        {id: 'rs-from-ym', accountId: 'rapid-save', description: 'Transfer from YouMoney', category: 'Transfers', amount: 250, date: addCalendarDays(today, -12)},
        {id: 'rs-opening', accountId: 'rapid-save', description: 'Opening deposit', category: 'Transfers', amount: 5000, date: addCalendarDays(today, -120)},
    ];
}

export function formatNzd(amount: number): string {
    return new Intl.NumberFormat('en-NZ', {
        style: 'currency',
        currency: 'NZD',
    }).format(amount);
}

export function formatTransactionDate(isoDate: string): string {
    return new Intl.DateTimeFormat('en-NZ', {
        timeZone: NZ_TIME_ZONE,
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(new Date(`${isoDate}T12:00:00+12:00`));
}
