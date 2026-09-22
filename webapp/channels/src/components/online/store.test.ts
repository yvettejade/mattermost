// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    addPayee,
    applyPayAnyone,
    applyOwnTransfer,
    CARDS_PAYMENTS_STORAGE_KEY,
    formatNzdFromCents,
    loadCardsPaymentsState,
    normalizeNzAccountNumber,
    parseAmountCents,
    paymentStatus,
    resetCardsPaymentsState,
    seedCardsPaymentsState,
    setCardLocked,
    submitPayAnyone,
    todayInAuckland,
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
    test('seeds unlocked cards and Everyday/Savings balances', () => {
        const state = seedCardsPaymentsState();

        expect(state.cards.map((card) => [card.id, card.locked])).toEqual([
            ['flexi-debit', false],
            ['credit', false],
        ]);
        expect(state.accounts.map((account) => [account.id, account.availableCents])).toEqual([
            ['everyday', 428055],
            ['savings', 1864000],
        ]);
        expect(state.payees.map((payee) => payee.id)).toEqual(['payee-spark', 'payee-ird', 'payee-alex']);
    });

    test('locks a card immediately and persists it', () => {
        const storage = memoryStorage();
        const next = setCardLocked(seedCardsPaymentsState(), 'flexi-debit', true, storage);

        expect(next.cards[0].locked).toBe(true);
        expect(loadCardsPaymentsState(storage).cards[0].locked).toBe(true);
        expect(storage.getItem(CARDS_PAYMENTS_STORAGE_KEY)).toContain('"locked":true');
    });

    test('reset restores unlocked defaults', () => {
        const storage = memoryStorage();
        setCardLocked(seedCardsPaymentsState(), 'credit', true, storage);

        const next = resetCardsPaymentsState(storage);

        expect(next.cards.every((card) => !card.locked)).toBe(true);
        expect(storage.getItem(CARDS_PAYMENTS_STORAGE_KEY)).toBeNull();
    });

    test('adds a customer payee and rejects an invalid account number', () => {
        const storage = memoryStorage();
        const added = addPayee(seedCardsPaymentsState(), 'Jordan Lee', '010002000000300', 'Dinner', storage);

        expect(added.ok).toBe(true);
        if (added.ok) {
            expect(added.payee.accountNumber).toBe('01-0002-0000003-00');
            expect(added.payee.seeded).toBe(false);
            expect(added.state.payees).toHaveLength(4);
        }

        const invalid = addPayee(seedCardsPaymentsState(), 'Jordan Lee', '12-34', '', storage);
        expect(invalid).toEqual({ok: false, field: 'accountNumber', reason: 'invalid'});
    });

    test('same-day pay anyone debits Everyday; a future date is scheduled', () => {
        const now = new Date('2026-08-17T12:00:00+12:00');
        const sent = applyPayAnyone(
            seedCardsPaymentsState(),
            'everyday',
            'Alex Chen',
            '01-0001-0000001-00',
            8000,
            'Rent',
            '',
            now,
        );

        expect(sent.ok).toBe(true);
        if (sent.ok) {
            expect(sent.payment.status).toBe('sent');
            expect(sent.state.accounts[0].availableCents).toBe(420055);
        }

        const scheduled = applyPayAnyone(
            seedCardsPaymentsState(),
            'everyday',
            'Alex Chen',
            '01-0001-0000001-00',
            8000,
            'Rent',
            '2099-01-15',
            now,
        );

        expect(scheduled.ok).toBe(true);
        if (scheduled.ok) {
            expect(scheduled.payment.status).toBe('scheduled');
            expect(scheduled.state.accounts[0].availableCents).toBe(428055);
        }
    });

    test('submitPayAnyone persists a sent payment', () => {
        const storage = memoryStorage();
        const result = submitPayAnyone(
            'everyday',
            'Alex Chen',
            '01-0001-0000001-00',
            '80',
            'Rent',
            '',
            storage,
            new Date('2026-08-17T12:00:00+12:00'),
        );

        expect(result.ok).toBe(true);
        expect(loadCardsPaymentsState(storage).accounts[0].availableCents).toBe(420055);
        expect(loadCardsPaymentsState(storage).payments[0].payeeName).toBe('Alex Chen');
    });

    test('own-account transfer moves cents between Everyday and Savings', () => {
        const result = applyOwnTransfer(seedCardsPaymentsState(), 'everyday', 'savings', 4025);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.state.accounts[0].availableCents).toBe(424030);
            expect(result.state.accounts[1].availableCents).toBe(1868025);
        }
    });

    test('parseAmountCents and NZ account numbers', () => {
        expect(parseAmountCents('80')).toBe(8000);
        expect(parseAmountCents('12.5')).toBe(1250);
        expect(parseAmountCents('0')).toBeNull();
        expect(normalizeNzAccountNumber('010001000000100')).toBe('01-0001-0000001-00');
        expect(normalizeNzAccountNumber('bad')).toBeNull();
        expect(formatNzdFromCents(900)).toBe('$9.00');
        expect(paymentStatus('', new Date('2026-08-17T12:00:00+12:00'))).toBe('sent');
        expect(paymentStatus('2099-01-15', new Date('2026-08-17T12:00:00+12:00'))).toBe('scheduled');
        expect(todayInAuckland(new Date('2026-08-17T12:00:00+12:00'))).toBe('2026-08-17');
    });

    test('ignores corrupt stored state', () => {
        const storage = memoryStorage({[CARDS_PAYMENTS_STORAGE_KEY]: '{not-json'});

        expect(loadCardsPaymentsState(storage)).toEqual(seedCardsPaymentsState());
    });
});
