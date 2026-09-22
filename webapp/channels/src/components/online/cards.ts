// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CARD_IDS} from './card_types';
import type {CardId, CardLock, CardLockState, SeededCard} from './card_types';

export const ONLINE_CARD_LOCKS_STORAGE_KEY = 'mm_online_card_locks';

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const SEEDED_CARDS: SeededCard[] = [
    {
        id: 'flexi-debit',
        nameId: 'online_cards.card.flexi_debit',
        name: 'Flexi Debit',
        lastFour: '4412',
    },
    {
        id: 'credit',
        nameId: 'online_cards.card.credit',
        name: 'Credit card',
        lastFour: '8891',
    },
];

export function seedCardLockState(): CardLockState {
    return {
        'flexi-debit': {locked: false},
        credit: {locked: false},
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function parseStoredLock(value: unknown): CardLock | null {
    if (!isRecord(value) || typeof value.locked !== 'boolean') {
        return null;
    }

    return {locked: value.locked};
}

export function loadCardLockState(storage: ReadableStorage = localStorage): CardLockState {
    const raw = storage.getItem(ONLINE_CARD_LOCKS_STORAGE_KEY);
    if (!raw) {
        return seedCardLockState();
    }

    try {
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed)) {
            return seedCardLockState();
        }

        const next = seedCardLockState();
        for (const id of CARD_IDS) {
            const lock = parseStoredLock(parsed[id]);
            if (lock) {
                next[id] = lock;
            }
        }

        return next;
    } catch {
        return seedCardLockState();
    }
}

export function saveCardLockState(state: CardLockState, storage: WritableStorage = localStorage): void {
    storage.setItem(ONLINE_CARD_LOCKS_STORAGE_KEY, JSON.stringify(state));
}

export function resetCardLockState(storage: WritableStorage = localStorage): CardLockState {
    storage.removeItem(ONLINE_CARD_LOCKS_STORAGE_KEY);
    return seedCardLockState();
}

export function setCardLocked(
    cardId: CardId,
    locked: boolean,
    storage: WritableStorage = localStorage,
): CardLockState {
    const state = loadCardLockState(storage);
    const next: CardLockState = {
        ...state,
        [cardId]: {locked},
    };
    saveCardLockState(next, storage);
    return next;
}
