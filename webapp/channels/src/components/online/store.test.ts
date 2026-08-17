// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    applyOwnTransfer,
    applyPayAnyone,
    EVERYDAY_MONEY_STORAGE_KEY,
    filterTransactions,
    formatAudFromCents,
    isValidPayeeAccountNumber,
    loadEverydayMoneyState,
    overallPositionCents,
    parseAmountCents,
    saveEverydayMoneySettings,
    scheduledTransactions,
    seedEverydayMoneyState,
    submitOwnTransfer,
    submitPayAnyone,
    transactionsToCsv,
    transferableAccounts,
} from './store';

function memoryStorage(initial: Record<string, string> = {}): Storage {
    const data = {...initial};
    return {
        get length() {
            return Object.keys(data).length;
        },
        clear: () => {
            for (const key of Object.keys(data)) {
                delete data[key];
            }
        },
        getItem: (key: string) => (key in data ? data[key] : null),
        key: (index: number) => Object.keys(data)[index] ?? null,
        removeItem: (key: string) => {
            delete data[key];
        },
        setItem: (key: string, value: string) => {
            data[key] = value;
        },
    };
}

describe('online/store', () => {
    const now = new Date('2026-08-17T12:00:00+10:00');

    test('parses dollar amounts as integer cents', () => {
        expect(parseAmountCents('40.25')).toBe(4025);
        expect(parseAmountCents('1')).toBe(100);
        expect(parseAmountCents('0')).toBeNull();
        expect(parseAmountCents('1.234')).toBeNull();
        expect(parseAmountCents('-5')).toBeNull();
    });

    test('accepts 6 to 10 digit payee account numbers', () => {
        expect(isValidPayeeAccountNumber('123456')).toBe(true);
        expect(isValidPayeeAccountNumber('12345678')).toBe(true);
        expect(isValidPayeeAccountNumber('12345')).toBe(false);
        expect(isValidPayeeAccountNumber('12-345678')).toBe(false);
    });

    test('seeds four accounts and a net position', () => {
        const state = seedEverydayMoneyState(now);

        expect(state.accounts.map((account) => account.id)).toEqual([
            'everyday',
            'savings',
            'credit-card',
            'home-loan',
        ]);
        expect(transferableAccounts(state.accounts)).toHaveLength(2);
        expect(overallPositionCents(state.accounts)).toBe((428055 + 1864000) - 61240 - 41200000);
        expect(formatAudFromCents(428055)).toBe('$4,280.55');
    });

    test('filters account activity by search and scheduled flag', () => {
        const state = seedEverydayMoneyState(now);
        const groceries = filterTransactions(state.transactions, 'everyday', 'woolworths');
        const scheduled = scheduledTransactions(state.transactions, 'everyday');

        expect(groceries).toHaveLength(1);
        expect(groceries[0].description).toContain('Woolworths');
        expect(scheduled.map((transaction) => transaction.description)).toEqual(['Rent', 'Car insurance']);
    });

    test('exports filtered activity as CSV', () => {
        const state = seedEverydayMoneyState(now);
        const csv = transactionsToCsv(filterTransactions(state.transactions, 'everyday', 'salary'));

        expect(csv).toContain('Date,Description,Amount,Kind,Scheduled');
        expect(csv).toContain('Salary');
        expect(csv).toContain('$4,200.00');
        expect(csv).not.toContain('Woolworths');
    });

    test('rejects same-account and overdrawn transfers', () => {
        const state = seedEverydayMoneyState(now);

        expect(applyOwnTransfer(state, 'everyday', 'everyday', 1000, now)).toEqual({
            ok: false,
            error: 'same_account',
        });
        expect(applyOwnTransfer(state, 'everyday', 'savings', 99999999, now)).toEqual({
            ok: false,
            error: 'insufficient',
        });
        expect(applyOwnTransfer(state, 'everyday', 'credit-card', 1000, now)).toEqual({
            ok: false,
            error: 'unknown_account',
        });
    });

    test('moves money between eligible accounts and records both sides', () => {
        const storage = memoryStorage();
        const result = submitOwnTransfer('everyday', 'savings', '40.25', storage, now);

        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }

        const everyday = result.state.accounts.find((account) => account.id === 'everyday');
        const savings = result.state.accounts.find((account) => account.id === 'savings');
        expect(everyday?.availableCents).toBe(428055 - 4025);
        expect(savings?.availableCents).toBe(1864000 + 4025);
        expect(result.state.transactions[0].description).toBe('Transfer to Savings');
        expect(loadEverydayMoneyState(storage, now).accounts.find((account) => account.id === 'everyday')?.availableCents).toBe(428055 - 4025);
        expect(storage.getItem(EVERYDAY_MONEY_STORAGE_KEY)).toContain('xfer-out');
    });

    test('rejects pay-anyone without a reviewable payee or funds', () => {
        const state = seedEverydayMoneyState(now);

        expect(applyPayAnyone(state, 'everyday', '', '12345678', 1000, now)).toEqual({
            ok: false,
            error: 'invalid_payee',
        });
        expect(applyPayAnyone(state, 'everyday', 'Alex Chen', '12', 1000, now)).toEqual({
            ok: false,
            error: 'invalid_account_number',
        });
        expect(applyPayAnyone(state, 'home-loan', 'Alex Chen', '12345678', 1000, now)).toEqual({
            ok: false,
            error: 'unknown_account',
        });
    });

    test('pays anyone from an eligible account and remembers the payee', () => {
        const storage = memoryStorage();
        const result = submitPayAnyone('everyday', 'Jordan Lee', '87654321', '25.00', storage, now);

        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }

        expect(result.state.accounts.find((account) => account.id === 'everyday')?.availableCents).toBe(428055 - 2500);
        expect(result.state.payees[0]).toEqual({
            id: `payee-${now.getTime()}`,
            name: 'Jordan Lee',
            accountNumber: '87654321',
        });
        expect(result.state.transactions[0].description).toBe('Pay anyone — Jordan Lee');
    });

    test('persists settings without resetting balances', () => {
        const storage = memoryStorage();
        submitOwnTransfer('everyday', 'savings', '10.00', storage, now);

        const next = saveEverydayMoneySettings({hideBalances: true, paymentAlerts: false}, storage, now);

        expect(next.settings).toEqual({hideBalances: true, paymentAlerts: false});
        expect(next.accounts.find((account) => account.id === 'everyday')?.availableCents).toBe(428055 - 1000);
    });
});
