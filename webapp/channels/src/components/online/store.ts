// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Account, AccountId, Transaction, TransactionFilter} from './types';

export const CSV_HEADER = 'Date,Description,Merchant,Category,Amount';

const SEED_ACCOUNTS: Account[] = [
    {
        id: 'everyday',
        nameId: 'online.account.youmoney',
        name: 'YouMoney Everyday',
        number: '01-0123-0045678-00',
    },
    {
        id: 'savings',
        nameId: 'online.account.savings',
        name: 'Rapid Save',
        number: '01-0123-0045678-01',
    },
];

function padMonth(month: number): string {
    return String(month).padStart(2, '0');
}

export function getYearMonth(date: Date): {year: number; month: number} {
    return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
    };
}

export function seedAccounts(): Account[] {
    return SEED_ACCOUNTS.map((account) => ({...account}));
}

export function seedTransactions(now = new Date()): Transaction[] {
    const {year, month} = getYearMonth(now);
    const thisMonth = `${year}-${padMonth(month)}`;

    return [
        {id: 'tx-groceries', accountId: 'everyday', date: `${thisMonth}-03`, description: 'Weekly shop', merchant: 'Woolworths', category: 'Groceries', amountCents: -18640},
        {id: 'tx-eating-out', accountId: 'everyday', date: `${thisMonth}-06`, description: 'Lunch', merchant: 'Cafe Neo', category: 'Eating out', amountCents: -5480},
        {id: 'tx-transport', accountId: 'everyday', date: `${thisMonth}-11`, description: 'Transit top-up', merchant: 'AT HOP', category: 'Transport', amountCents: -4120},
        {id: 'tx-bills', accountId: 'everyday', date: `${thisMonth}-02`, description: 'Electricity bill', merchant: 'Mercury', category: 'Bills', amountCents: -12900},
        {id: 'tx-income', accountId: 'everyday', date: `${thisMonth}-01`, description: 'Salary', merchant: 'Acme Ltd', category: 'Income', amountCents: 420000},
        {id: 'tx-transfer', accountId: 'everyday', date: `${thisMonth}-08`, description: 'Transfer to Rapid Save', merchant: 'YouMoney', category: 'Transfers', amountCents: -25000},
        {id: 'tx-savings-interest', accountId: 'savings', date: `${thisMonth}-01`, description: 'Interest', merchant: 'ANZ', category: 'Income', amountCents: 1240},
    ];
}

export function findAccount(accounts: Account[], accountId: string): Account | undefined {
    return accounts.find((account) => account.id === accountId);
}

export function formatSignedAmount(amountCents: number): string {
    return (amountCents / 100).toFixed(2);
}

export function accountCategories(transactions: Transaction[], accountId: AccountId): string[] {
    const categories = new Set<string>();
    transactions.forEach((transaction) => {
        if (transaction.accountId === accountId) {
            categories.add(transaction.category);
        }
    });
    return [...categories].sort((left, right) => left.localeCompare(right));
}

export function filterTransactions(
    transactions: Transaction[],
    accountId: AccountId,
    filter: TransactionFilter,
): Transaction[] {
    const needle = filter.query.trim().toLowerCase();
    const category = filter.category.trim();

    return transactions.filter((transaction) => {
        if (transaction.accountId !== accountId) {
            return false;
        }
        if (category && transaction.category !== category) {
            return false;
        }
        if (!needle) {
            return true;
        }

        return (
            transaction.description.toLowerCase().includes(needle) ||
            transaction.merchant.toLowerCase().includes(needle) ||
            transaction.category.toLowerCase().includes(needle)
        );
    });
}

function csvField(value: string): string {
    if ((/["\n,]/).test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

export function transactionsToCsv(transactions: Transaction[]): string {
    const rows = transactions.map((transaction) => [
        csvField(transaction.date),
        csvField(transaction.description),
        csvField(transaction.merchant),
        csvField(transaction.category),
        formatSignedAmount(transaction.amountCents),
    ].join(','));

    return [CSV_HEADER, ...rows].join('\n');
}

export function slugifyAccountName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function csvFileName(accountName: string, now = new Date()): string {
    return `${slugifyAccountName(accountName)}-${now.toISOString().slice(0, 10)}.csv`;
}

export function downloadCsv(csv: string, fileName: string, doc = document): void {
    const blob = new Blob([csv], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const link = doc.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
}
