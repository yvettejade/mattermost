// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    loadCardLockState,
    ONLINE_CARD_LOCKS_STORAGE_KEY,
    resetCardLockState,
    SEEDED_CARDS,
    seedCardLockState,
    setCardLocked,
} from './cards';

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

describe('online_cards/cards', () => {
    test('seeds Flexi Debit and credit unlocked', () => {
        expect(SEEDED_CARDS.map((card) => card.id)).toEqual(['flexi-debit', 'credit']);
        expect(seedCardLockState()).toEqual({
            'flexi-debit': {locked: false},
            credit: {locked: false},
        });
    });

    test('persists a lock and restores it', () => {
        const storage = memoryStorage();

        setCardLocked('flexi-debit', true, storage);

        expect(loadCardLockState(storage)['flexi-debit'].locked).toBe(true);
        expect(loadCardLockState(storage).credit.locked).toBe(false);
        expect(storage.getItem(ONLINE_CARD_LOCKS_STORAGE_KEY)).toContain('"locked":true');
    });

    test('unlocks a previously locked card', () => {
        const storage = memoryStorage();
        setCardLocked('credit', true, storage);

        const next = setCardLocked('credit', false, storage);

        expect(next.credit.locked).toBe(false);
        expect(loadCardLockState(storage).credit.locked).toBe(false);
    });

    test('reset restores unlocked defaults', () => {
        const storage = memoryStorage();
        setCardLocked('flexi-debit', true, storage);

        const next = resetCardLockState(storage);

        expect(next).toEqual(seedCardLockState());
        expect(storage.getItem(ONLINE_CARD_LOCKS_STORAGE_KEY)).toBeNull();
        expect(loadCardLockState(storage)['flexi-debit'].locked).toBe(false);
    });

    test('ignores corrupt stored state', () => {
        const storage = memoryStorage({[ONLINE_CARD_LOCKS_STORAGE_KEY]: '{not-json'});

        expect(loadCardLockState(storage)).toEqual(seedCardLockState());
    });
});
