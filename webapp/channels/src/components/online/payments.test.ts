// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    applyOwnTransfer,
    applyPayAnyonePayment,
    getAccountBalance,
    PAY_ANYONE_STORAGE_KEY,
    paymentStatus,
    resolvePaymentDate,
    todayInAuckland,
} from './payments';
import {addPayee} from './payees';

function memoryStorage(initial: Record<string, string> = {}): Storage {
    const store = {...initial};
    return {
        get length() {
            return Object.keys(store).length;
        },
        clear: () => {
            for (const key of Object.keys(store)) {
                delete store[key];
            }
        },
        getItem: (key: string) => store[key] ?? null,
        key: (index: number) => Object.keys(store)[index] ?? null,
        removeItem: (key: string) => {
            delete store[key];
        },
        setItem: (key: string, value: string) => {
            store[key] = value;
        },
    };
}

describe('online/payments', () => {
    const aucklandMorning = new Date('2026-08-17T10:00:00+12:00');

    test('treats a blank or same-day date as sent, not scheduled', () => {
        expect(todayInAuckland(aucklandMorning)).toBe('2026-08-17');
        expect(resolvePaymentDate('', aucklandMorning)).toBe('2026-08-17');
        expect(paymentStatus('', aucklandMorning)).toBe('sent');
        expect(paymentStatus('2026-08-17', aucklandMorning)).toBe('sent');
        expect(paymentStatus('2026-08-18', aucklandMorning)).toBe('scheduled');
    });

    test('moves money immediately when the payment is sent today', () => {
        const storage = memoryStorage();
        const result = applyPayAnyonePayment({
            payeeName: 'Alex Chen',
            payeeAccount: '01-0001-0000001-00',
            fromAccountId: 'ACC-1001',
            amount: 80,
            reference: 'Rent',
            when: '',
        }, storage, aucklandMorning);

        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }

        expect(result.payment.status).toBe('sent');
        expect(result.payment.when).toBe('2026-08-17');
        expect(result.state.balances['ACC-1001']).toBe(4200.55);
        expect(getAccountBalance('ACC-1001', storage)).toBe(4200.55);
        expect(storage.getItem(PAY_ANYONE_STORAGE_KEY)).toContain('Alex Chen');
    });

    test('records a future payment as scheduled without moving money', () => {
        const storage = memoryStorage();
        const result = applyPayAnyonePayment({
            payeeName: 'Alex Chen',
            payeeAccount: '01-0001-0000001-00',
            fromAccountId: 'ACC-1001',
            amount: 80,
            reference: 'Rent',
            when: '2026-09-01',
        }, storage, aucklandMorning);

        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }

        expect(result.payment.status).toBe('scheduled');
        expect(result.state.balances['ACC-1001']).toBe(4280.55);
    });

    test('rejects a same-day payment that exceeds the available balance', () => {
        const storage = memoryStorage();
        const result = applyPayAnyonePayment({
            payeeName: 'Alex Chen',
            payeeAccount: '01-0001-0000001-00',
            fromAccountId: 'ACC-1001',
            amount: 5000,
            reference: '',
            when: '',
        }, storage, aucklandMorning);

        expect(result).toEqual({ok: false, reason: 'insufficient'});
        expect(storage.getItem(PAY_ANYONE_STORAGE_KEY)).toBeNull();
    });

    test('keeps custom payees when a payment is recorded', () => {
        const storage = memoryStorage();
        addPayee({
            name: 'Jordan Lee',
            accountNumber: '02-1234-5678901-00',
        }, storage, new Date('2026-08-17T12:00:00Z'));

        applyPayAnyonePayment({
            payeeName: 'Jordan Lee',
            payeeAccount: '02-1234-5678901-00',
            fromAccountId: 'ACC-1001',
            amount: 10,
            reference: '',
            when: '',
        }, storage, aucklandMorning);

        const stored = JSON.parse(storage.getItem(PAY_ANYONE_STORAGE_KEY) ?? '{}');
        expect(stored.customPayees).toHaveLength(1);
        expect(stored.payments).toHaveLength(1);
    });

    test('moves money between own accounts immediately', () => {
        const storage = memoryStorage();
        const result = applyOwnTransfer({
            fromAccountId: 'ACC-1001',
            toAccountId: 'ACC-1002',
            amount: 80,
            when: '',
        }, storage, aucklandMorning);

        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }

        expect(result.transfer.status).toBe('sent');
        expect(result.state.balances['ACC-1001']).toBe(4200.55);
        expect(result.state.balances['ACC-1002']).toBe(18720);
    });

    test('schedules an own-account transfer without moving money', () => {
        const storage = memoryStorage();
        const result = applyOwnTransfer({
            fromAccountId: 'ACC-1001',
            toAccountId: 'ACC-1002',
            amount: 80,
            when: '2026-09-01',
        }, storage, aucklandMorning);

        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }

        expect(result.transfer.status).toBe('scheduled');
        expect(result.state.balances['ACC-1001']).toBe(4280.55);
        expect(result.state.balances['ACC-1002']).toBe(18640);
    });
});
