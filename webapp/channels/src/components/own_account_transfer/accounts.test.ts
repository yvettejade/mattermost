// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    applyOwnAccountTransfer,
    formatNzdFromCents,
    loadOwnAccountTransferState,
    OWN_ACCOUNT_TRANSFER_STORAGE_KEY,
    parseAmountCents,
    seedOwnAccountTransferState,
    submitOwnAccountTransfer,
} from './accounts';

function memoryStorage(initial: Record<string, string> = {}): Storage {
    const data = {...initial};
    return {
        get length() {
            return Object.keys(data).length;
        },
        clear() {
            Object.keys(data).forEach((key) => {
                delete data[key];
            });
        },
        getItem(key: string) {
            return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
        },
        key() {
            return null;
        },
        removeItem(key: string) {
            delete data[key];
        },
        setItem(key: string, value: string) {
            data[key] = value;
        },
    };
}

describe('own_account_transfer/accounts', () => {
    test('parseAmountCents accepts dollars and cents', () => {
        expect(parseAmountCents('100')).toBe(10000);
        expect(parseAmountCents('12.5')).toBe(1250);
        expect(parseAmountCents('12.50')).toBe(1250);
        expect(parseAmountCents(' 20.05 ')).toBe(2005);
    });

    test('parseAmountCents rejects invalid amounts', () => {
        expect(parseAmountCents('')).toBeNull();
        expect(parseAmountCents('0')).toBeNull();
        expect(parseAmountCents('-10')).toBeNull();
        expect(parseAmountCents('abc')).toBeNull();
        expect(parseAmountCents('1.234')).toBeNull();
    });

    test('formatNzdFromCents uses en-NZ currency', () => {
        expect(formatNzdFromCents(428050)).toBe('$4,280.50');
    });

    test('applyOwnAccountTransfer moves money and writes a transaction', () => {
        const now = new Date('2026-08-17T04:00:00.000Z');
        const result = applyOwnAccountTransfer(
            seedOwnAccountTransferState(),
            'youmoney',
            'rapid-save',
            25000,
            now,
        );

        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }

        expect(result.state.accounts.find((account) => account.id === 'youmoney')?.balanceCents).toBe(403050);
        expect(result.state.accounts.find((account) => account.id === 'rapid-save')?.balanceCents).toBe(1275000);
        expect(result.state.accounts.find((account) => account.id === 'online-account')?.balanceCents).toBe(89025);
        expect(result.transfer).toEqual({
            id: 'xfer-1786939200000',
            fromAccountId: 'youmoney',
            toAccountId: 'rapid-save',
            amountCents: 25000,
            createdAt: '2026-08-17T04:00:00.000Z',
        });
        expect(result.state.transfers[0]).toEqual(result.transfer);
    });

    test('applyOwnAccountTransfer rejects same account, invalid amount, and insufficient funds', () => {
        const state = seedOwnAccountTransferState();

        expect(applyOwnAccountTransfer(state, 'youmoney', 'youmoney', 1000).error).toBe('same_account');
        expect(applyOwnAccountTransfer(state, 'youmoney', 'rapid-save', 0).error).toBe('invalid_amount');
        expect(applyOwnAccountTransfer(state, 'youmoney', 'rapid-save', 500000).error).toBe('insufficient');
    });

    test('submitOwnAccountTransfer persists mutated balances', () => {
        const storage = memoryStorage();
        const now = new Date('2026-08-17T04:05:00.000Z');

        const result = submitOwnAccountTransfer('youmoney', 'online-account', '40.25', storage, now);

        expect(result.ok).toBe(true);
        const stored = loadOwnAccountTransferState(storage);
        expect(stored.accounts.find((account) => account.id === 'youmoney')?.balanceCents).toBe(423025);
        expect(stored.accounts.find((account) => account.id === 'online-account')?.balanceCents).toBe(93050);
        expect(stored.transfers).toHaveLength(1);
        expect(storage.getItem(OWN_ACCOUNT_TRANSFER_STORAGE_KEY)).toContain('xfer-1786939500000');
    });

    test('loadOwnAccountTransferState falls back to seed on corrupt storage', () => {
        const storage = memoryStorage({[OWN_ACCOUNT_TRANSFER_STORAGE_KEY]: '{not-json'});
        expect(loadOwnAccountTransferState(storage)).toEqual(seedOwnAccountTransferState());
    });
});
