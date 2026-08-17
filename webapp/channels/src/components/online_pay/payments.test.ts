// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    addCalendarMonths,
    applyPayAnyonePayment,
    formatPaymentDateDisplay,
    getAccountBalance,
    listScheduledPayments,
    maxPaymentDate,
    PAY_ANYONE_STORAGE_KEY,
    paymentStatus,
    resetPayAnyoneState,
    resolvePaymentDate,
    todayInAuckland,
    validatePaymentDate,
} from './payments';

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

describe('online_pay/payments', () => {
    const aucklandMorning = new Date('2026-08-17T10:00:00+12:00');

    test('treats today as sent and a later Auckland date as scheduled', () => {
        expect(todayInAuckland(aucklandMorning)).toBe('2026-08-17');
        expect(resolvePaymentDate('', aucklandMorning)).toBe('2026-08-17');
        expect(paymentStatus('', aucklandMorning)).toBe('sent');
        expect(paymentStatus('2026-08-17', aucklandMorning)).toBe('sent');
        expect(paymentStatus('2026-08-18', aucklandMorning)).toBe('scheduled');
    });

    test('rejects dates in the past and more than 12 months ahead', () => {
        expect(maxPaymentDate(aucklandMorning)).toBe('2027-08-17');
        expect(addCalendarMonths('2026-08-17', 12)).toBe('2027-08-17');
        expect(validatePaymentDate('2026-08-16', aucklandMorning)).toBe('past');
        expect(validatePaymentDate('2026-08-17', aucklandMorning)).toBeNull();
        expect(validatePaymentDate('2027-08-17', aucklandMorning)).toBeNull();
        expect(validatePaymentDate('2027-08-18', aucklandMorning)).toBe('too_far');
    });

    test('formats scheduled dates as dd mmm yyyy', () => {
        expect(formatPaymentDateDisplay('2026-09-01')).toBe('01 Sep 2026');
        expect(formatPaymentDateDisplay('2027-01-15')).toBe('15 Jan 2027');
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
        expect(listScheduledPayments(result.state.payments)).toHaveLength(0);
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
        expect(listScheduledPayments(result.state.payments).map((payment) => payment.payeeName)).toEqual(['Alex Chen']);
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

    test('rejects an out-of-range date before writing state', () => {
        const storage = memoryStorage();
        expect(applyPayAnyonePayment({
            payeeName: 'Alex Chen',
            payeeAccount: '01-0001-0000001-00',
            fromAccountId: 'ACC-1001',
            amount: 80,
            reference: 'Rent',
            when: '2026-08-16',
        }, storage, aucklandMorning)).toEqual({ok: false, reason: 'past'});
        expect(applyPayAnyonePayment({
            payeeName: 'Alex Chen',
            payeeAccount: '01-0001-0000001-00',
            fromAccountId: 'ACC-1001',
            amount: 80,
            reference: 'Rent',
            when: '2027-08-18',
        }, storage, aucklandMorning)).toEqual({ok: false, reason: 'too_far'});
        expect(storage.getItem(PAY_ANYONE_STORAGE_KEY)).toBeNull();
    });

    test('demo reset clears scheduled payments and restores balances', () => {
        const storage = memoryStorage();
        applyPayAnyonePayment({
            payeeName: 'Alex Chen',
            payeeAccount: '01-0001-0000001-00',
            fromAccountId: 'ACC-1001',
            amount: 80,
            reference: 'Rent',
            when: '2026-09-01',
        }, storage, aucklandMorning);
        applyPayAnyonePayment({
            payeeName: 'Inland Revenue',
            payeeAccount: '01-0001-0000002-00',
            fromAccountId: 'ACC-1001',
            amount: 40,
            reference: 'Tax',
            when: '',
        }, storage, aucklandMorning);

        const reset = resetPayAnyoneState(storage);
        expect(storage.getItem(PAY_ANYONE_STORAGE_KEY)).toBeNull();
        expect(reset.payments).toEqual([]);
        expect(reset.balances['ACC-1001']).toBe(4280.55);
        expect(getAccountBalance('ACC-1001', storage)).toBe(4280.55);
    });
});
