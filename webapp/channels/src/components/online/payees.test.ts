// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    addPayee,
    getCustomPayees,
    isValidNzAccountNumber,
    listPayees,
    normalizeNzAccountNumber,
    PAY_ANYONE_STORAGE_KEY,
    removePayee,
    SEED_PAYEES,
} from './payees';

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

describe('online/payees', () => {
    test('accepts NN-NNNN-NNNNNNN-NN account numbers and 15-digit input', () => {
        expect(isValidNzAccountNumber('02-1234-5678901-00')).toBe(true);
        expect(normalizeNzAccountNumber('021234567890100')).toBe('02-1234-5678901-00');
        expect(isValidNzAccountNumber('02-1234-567890-00')).toBe(false);
        expect(isValidNzAccountNumber('not-an-account')).toBe(false);
        expect(normalizeNzAccountNumber('02-1234-5678901-00 ')).toBe('02-1234-5678901-00');
    });

    test('lists seed payees when nothing has been saved', () => {
        const storage = memoryStorage();

        expect(listPayees(storage)).toEqual(SEED_PAYEES);
        expect(getCustomPayees(storage)).toEqual([]);
    });

    test('persists a customer payee and keeps seed payees first', () => {
        const storage = memoryStorage();
        const result = addPayee({
            name: ' Jordan Lee ',
            accountNumber: '021234567890100',
            referenceDefault: ' School trip ',
        }, storage, new Date('2026-08-17T12:00:00Z'));

        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }

        expect(result.payee).toEqual({
            id: 'payee-1786968000000',
            name: 'Jordan Lee',
            accountNumber: '02-1234-5678901-00',
            referenceDefault: 'School trip',
            seeded: false,
        });
        expect(result.payees.map((payee) => payee.id)).toEqual([
            ...SEED_PAYEES.map((payee) => payee.id),
            'payee-1786968000000',
        ]);
        expect(storage.getItem(PAY_ANYONE_STORAGE_KEY)).toContain('Jordan Lee');
    });

    test('does not persist an invalid account number', () => {
        const storage = memoryStorage();
        const result = addPayee({
            name: 'Jordan Lee',
            accountNumber: '12-34-56',
        }, storage);

        expect(result).toEqual({ok: false, field: 'accountNumber', reason: 'invalid'});
        expect(storage.getItem(PAY_ANYONE_STORAGE_KEY)).toBeNull();
        expect(listPayees(storage)).toEqual(SEED_PAYEES);
    });

    test('does not persist a blank name', () => {
        const storage = memoryStorage();
        const result = addPayee({
            name: '   ',
            accountNumber: '02-1234-5678901-00',
        }, storage);

        expect(result).toEqual({ok: false, field: 'name', reason: 'required'});
        expect(storage.getItem(PAY_ANYONE_STORAGE_KEY)).toBeNull();
    });

    test('removes a customer payee and leaves seed payees in place', () => {
        const storage = memoryStorage();
        const added = addPayee({
            name: 'Jordan Lee',
            accountNumber: '02-1234-5678901-00',
        }, storage, new Date('2026-08-17T12:00:00Z'));

        expect(added.ok).toBe(true);
        if (!added.ok) {
            return;
        }

        expect(removePayee(SEED_PAYEES[0].id, storage)).toEqual({
            ok: false,
            payees: listPayees(storage),
        });
        expect(listPayees(storage).some((payee) => payee.id === added.payee.id)).toBe(true);

        const removed = removePayee(added.payee.id, storage);
        expect(removed.ok).toBe(true);
        expect(removed.payees).toEqual(SEED_PAYEES);
        expect(getCustomPayees(storage)).toEqual([]);
    });

    test('preserves other banking state already stored under the same key', () => {
        const storage = memoryStorage({
            [PAY_ANYONE_STORAGE_KEY]: JSON.stringify({
                balances: {'ACC-1001': 100},
                payments: [{id: 'pay-1'}],
            }),
        });

        addPayee({
            name: 'Jordan Lee',
            accountNumber: '02-1234-5678901-00',
        }, storage, new Date('2026-08-17T12:00:00Z'));

        const stored = JSON.parse(storage.getItem(PAY_ANYONE_STORAGE_KEY) ?? '{}');
        expect(stored.balances).toEqual({'ACC-1001': 100});
        expect(stored.payments).toEqual([{id: 'pay-1'}]);
        expect(stored.customPayees).toHaveLength(1);
    });
});
