// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CARD_IDS} from './types';
import type {CardControls, CardControlsState, CardId, SeededCard} from './types';

export const ONLINE_CARD_CONTROLS_STORAGE_KEY = 'mm_online_card_controls';

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const SEEDED_CARDS: SeededCard[] = [
    {
        id: 'flexi-debit',
        nameId: 'online_cards.card.flexi_debit',
        name: 'Flexi Debit',
        lastFour: '4412',
        defaults: {
            locked: false,
            blockOverseas: false,
            blockOnline: false,
            dailyLimitCents: null,
        },
    },
    {
        id: 'credit',
        nameId: 'online_cards.card.credit',
        name: 'Credit card',
        lastFour: '8891',
        defaults: {
            locked: false,
            blockOverseas: false,
            blockOnline: false,
            dailyLimitCents: null,
        },
    },
];

export function isCardId(value: string): value is CardId {
    return CARD_IDS.some((id) => id === value);
}

export function seedCardControlsState(): CardControlsState {
    return {
        'flexi-debit': {...SEEDED_CARDS[0].defaults},
        credit: {...SEEDED_CARDS[1].defaults},
    };
}

export function formatNzdFromCents(amountCents: number): string {
    return new Intl.NumberFormat('en-NZ', {
        style: 'currency',
        currency: 'NZD',
    }).format(amountCents / 100);
}

export function formatDailyLimitInput(dailyLimitCents: number | null): string {
    if (dailyLimitCents === null) {
        return '';
    }

    const dollars = Math.floor(dailyLimitCents / 100);
    const cents = dailyLimitCents % 100;
    if (cents === 0) {
        return String(dollars);
    }

    return `${dollars}.${String(cents).padStart(2, '0')}`;
}

export function parseDailyLimitCents(raw: string): {ok: true; value: number | null} | {ok: false} {
    const trimmed = raw.trim();
    if (trimmed === '') {
        return {ok: true, value: null};
    }
    if (!(/^\d+(\.\d{1,2})?$/).test(trimmed)) {
        return {ok: false};
    }

    const [dollars, cents = ''] = trimmed.split('.');
    const value = (Number(dollars) * 100) + Number(cents.padEnd(2, '0'));
    if (!Number.isInteger(value) || value <= 0) {
        return {ok: false};
    }

    return {ok: true, value};
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function parseStoredControls(value: unknown): CardControls | null {
    if (!isRecord(value)) {
        return null;
    }
    if (typeof value.locked !== 'boolean' || typeof value.blockOverseas !== 'boolean' || typeof value.blockOnline !== 'boolean') {
        return null;
    }
    if (value.dailyLimitCents !== null && (typeof value.dailyLimitCents !== 'number' || !Number.isInteger(value.dailyLimitCents) || value.dailyLimitCents <= 0)) {
        return null;
    }

    return {
        locked: value.locked,
        blockOverseas: value.blockOverseas,
        blockOnline: value.blockOnline,
        dailyLimitCents: value.dailyLimitCents,
    };
}

export function loadCardControlsState(storage: ReadableStorage = localStorage): CardControlsState {
    const raw = storage.getItem(ONLINE_CARD_CONTROLS_STORAGE_KEY);
    if (!raw) {
        return seedCardControlsState();
    }

    try {
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed)) {
            return seedCardControlsState();
        }

        const next = seedCardControlsState();
        for (const id of CARD_IDS) {
            const controls = parseStoredControls(parsed[id]);
            if (controls) {
                next[id] = controls;
            }
        }

        return next;
    } catch {
        return seedCardControlsState();
    }
}

export function saveCardControlsState(state: CardControlsState, storage: WritableStorage = localStorage): void {
    storage.setItem(ONLINE_CARD_CONTROLS_STORAGE_KEY, JSON.stringify(state));
}

export function resetCardControlsState(storage: WritableStorage = localStorage): CardControlsState {
    storage.removeItem(ONLINE_CARD_CONTROLS_STORAGE_KEY);
    return seedCardControlsState();
}

export function updateCardControls(
    cardId: CardId,
    patch: Partial<CardControls>,
    storage: WritableStorage = localStorage,
): CardControlsState {
    const state = loadCardControlsState(storage);
    const next: CardControlsState = {
        ...state,
        [cardId]: {
            ...state[cardId],
            ...patch,
        },
    };
    saveCardControlsState(next, storage);
    return next;
}
