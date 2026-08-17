// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    CSV_HEADER,
    csvFileName,
    filterTransactions,
    formatSignedAmount,
    seedAccounts,
    seedTransactions,
    slugifyAccountName,
    transactionsToCsv,
} from './store';

describe('online/store', () => {
    const now = new Date('2026-08-17T12:00:00.000Z');

    test('exports CSV header and filtered rows with signed amounts', () => {
        const transactions = seedTransactions(now);
        const groceries = filterTransactions(transactions, 'everyday', {query: '', category: 'Groceries'});
        const csv = transactionsToCsv(groceries);

        expect(csv).toBe([
            CSV_HEADER,
            '2026-08-03,Weekly shop,Woolworths,Groceries,-186.40',
        ].join('\n'));
        expect(csv.startsWith('Date,Description,Merchant,Category,Amount')).toBe(true);
        expect(csv).not.toContain('Salary');
        expect(csv).not.toContain('Cafe Neo');
    });

    test('search and category filters compose', () => {
        const transactions = seedTransactions(now);
        const byMerchant = filterTransactions(transactions, 'everyday', {query: 'woolworths', category: ''});
        const byCategoryMiss = filterTransactions(transactions, 'everyday', {query: 'woolworths', category: 'Bills'});
        const bySearch = filterTransactions(transactions, 'everyday', {query: 'salary', category: ''});

        expect(byMerchant).toHaveLength(1);
        expect(byMerchant[0].merchant).toBe('Woolworths');
        expect(byCategoryMiss).toHaveLength(0);
        expect(bySearch.map((transaction) => transaction.description)).toEqual(['Salary']);
        expect(formatSignedAmount(bySearch[0].amountCents)).toBe('4200.00');
        expect(formatSignedAmount(-18640)).toBe('-186.40');
    });

    test('file name uses the account slug and today\'s date', () => {
        expect(slugifyAccountName('YouMoney Everyday')).toBe('youmoney-everyday');
        expect(csvFileName('YouMoney Everyday', now)).toBe('youmoney-everyday-2026-08-17.csv');
        expect(seedAccounts()[0].name).toBe('YouMoney Everyday');
    });

    test('quotes CSV fields that contain commas', () => {
        const csv = transactionsToCsv([
            {
                id: 'tx-quoted',
                accountId: 'everyday',
                date: '2026-08-17',
                description: 'Lunch, extras',
                merchant: 'Cafe "Neo"',
                category: 'Eating out',
                amountCents: -1250,
            },
        ]);

        expect(csv).toBe([
            CSV_HEADER,
            '2026-08-17,"Lunch, extras","Cafe ""Neo""",Eating out,-12.50',
        ].join('\n'));
    });
});
