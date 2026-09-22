// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    formatDailyLimitInput,
    loadCardControlsState,
    ONLINE_CARD_CONTROLS_STORAGE_KEY,
    parseDailyLimitCents,
    resetCardControlsState,
    SEEDED_CARDS,
    seedCardControlsState,
    updateCardControls,
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
    test('seeds Flexi Debit and credit with unlocked defaults', () => {
        expect(SEEDED_CARDS.map((card) => card.id)).toEqual(['flexi-debit', 'credit']);
        expect(seedCardControlsState()['flexi-debit']).toEqual({
            locked: false,
            blockOverseas: false,
            blockOnline: false,
            dailyLimitCents: null,
        });
    });

    test('empty daily limit means no extra limit', () => {
        expect(parseDailyLimitCents('')).toEqual({ok: true, value: null});
        expect(parseDailyLimitCents('   ')).toEqual({ok: true, value: null});
        expect(formatDailyLimitInput(null)).toBe('');
    });

    test('parses a positive NZD daily limit into cents', () => {
        expect(parseDailyLimitCents('250')).toEqual({ok: true, value: 25000});
        expect(parseDailyLimitCents('40.25')).toEqual({ok: true, value: 4025});
        expect(parseDailyLimitCents('0')).toEqual({ok: false});
        expect(parseDailyLimitCents('abc')).toEqual({ok: false});
    });

    test('persists control changes and restores them', () => {
        const storage = memoryStorage();

        updateCardControls('flexi-debit', {blockOverseas: true, dailyLimitCents: 10000}, storage);

        expect(loadCardControlsState(storage)['flexi-debit']).toEqual({
            locked: false,
            blockOverseas: true,
            blockOnline: false,
            dailyLimitCents: 10000,
        });
        expect(storage.getItem(ONLINE_CARD_CONTROLS_STORAGE_KEY)).toContain('flexi-debit');
    });

    test('settings reset restores defaults', () => {
        const storage = memoryStorage();
        updateCardControls('credit', {locked: true, blockOnline: true}, storage);

        const next = resetCardControlsState(storage);

        expect(next.credit).toEqual(seedCardControlsState().credit);
        expect(storage.getItem(ONLINE_CARD_CONTROLS_STORAGE_KEY)).toBeNull();
        expect(loadCardControlsState(storage).credit.locked).toBe(false);
    });

    test('ignores corrupt stored state', () => {
        const storage = memoryStorage({[ONLINE_CARD_CONTROLS_STORAGE_KEY]: '{not-json'});

        expect(loadCardControlsState(storage)).toEqual(seedCardControlsState());
    });
});
