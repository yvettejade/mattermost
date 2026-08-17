// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    EVERYDAY_MONEY_STORAGE_KEY,
    formatAudFromCents,
    goalProgressPercent,
    hasVisibleGoal,
    loadEverydayMoneyState,
    parseGoalAmountCents,
    resetEverydayMoneyState,
    saveSavingsGoal,
    seedEverydayMoneyState,
} from './store';
import {RAPID_SAVE_ACCOUNT_ID} from './types';

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
    test('parses goal amounts including zero', () => {
        expect(parseGoalAmountCents('20000')).toBe(2000000);
        expect(parseGoalAmountCents('40.25')).toBe(4025);
        expect(parseGoalAmountCents('0')).toBe(0);
        expect(parseGoalAmountCents('0.00')).toBe(0);
        expect(parseGoalAmountCents('1.234')).toBeNull();
        expect(parseGoalAmountCents('-5')).toBeNull();
    });

    test('caps goal progress at 100 percent', () => {
        expect(goalProgressPercent(0, 10000)).toBe(0);
        expect(goalProgressPercent(5000, 10000)).toBe(50);
        expect(goalProgressPercent(10000, 10000)).toBe(100);
        expect(goalProgressPercent(15000, 10000)).toBe(100);
        expect(goalProgressPercent(5000, 0)).toBe(0);
        expect(goalProgressPercent(5000, -100)).toBe(0);
        expect(goalProgressPercent(-200, 10000)).toBe(0);
    });

    test('hides a missing, zero, or cleared goal', () => {
        expect(hasVisibleGoal(undefined)).toBe(false);
        expect(hasVisibleGoal({amountCents: 0, label: 'House deposit'})).toBe(false);
        expect(hasVisibleGoal({amountCents: 2000000, label: 'House deposit'})).toBe(true);
    });

    test('seeds Rapid Save among the everyday-money accounts', () => {
        const state = seedEverydayMoneyState();

        expect(state.accounts.map((account) => account.id)).toEqual([
            'everyday',
            'savings',
            'credit-card',
            'home-loan',
        ]);
        expect(state.accounts.find((account) => account.id === RAPID_SAVE_ACCOUNT_ID)?.name).toBe('Rapid Save');
        expect(state.goals).toEqual({});
        expect(formatAudFromCents(1864000)).toBe('$18,640.00');
    });

    test('persists a Rapid Save goal in the same storage as balances', () => {
        const storage = memoryStorage();
        const next = saveSavingsGoal(RAPID_SAVE_ACCOUNT_ID, 2000000, 'House deposit', storage);
        const loaded = loadEverydayMoneyState(storage);

        expect(next.goals[RAPID_SAVE_ACCOUNT_ID]).toEqual({
            amountCents: 2000000,
            label: 'House deposit',
        });
        expect(loaded.accounts.find((account) => account.id === RAPID_SAVE_ACCOUNT_ID)?.availableCents).toBe(1864000);
        expect(loaded.goals[RAPID_SAVE_ACCOUNT_ID]).toEqual({
            amountCents: 2000000,
            label: 'House deposit',
        });
        expect(storage.getItem(EVERYDAY_MONEY_STORAGE_KEY)).toContain('House deposit');
    });

    test('keeps sibling everyday-money fields when saving a goal', () => {
        const storage = memoryStorage({
            [EVERYDAY_MONEY_STORAGE_KEY]: JSON.stringify({
                accounts: seedEverydayMoneyState().accounts,
                transactions: [{id: 'tx-keep'}],
                payees: [{id: 'payee-keep'}],
                settings: {hideBalances: false, paymentAlerts: true},
            }),
        });

        saveSavingsGoal(RAPID_SAVE_ACCOUNT_ID, 500000, 'Emergency fund', storage);

        const stored = JSON.parse(storage.getItem(EVERYDAY_MONEY_STORAGE_KEY) ?? '{}');
        expect(stored.transactions).toEqual([{id: 'tx-keep'}]);
        expect(stored.payees).toEqual([{id: 'payee-keep'}]);
        expect(stored.settings.paymentAlerts).toBe(true);
        expect(stored.goals.savings.label).toBe('Emergency fund');
    });

    test('a zero goal clears progress state', () => {
        const storage = memoryStorage();
        saveSavingsGoal(RAPID_SAVE_ACCOUNT_ID, 2000000, 'House deposit', storage);

        const cleared = saveSavingsGoal(RAPID_SAVE_ACCOUNT_ID, 0, 'House deposit', storage);

        expect(cleared.goals[RAPID_SAVE_ACCOUNT_ID]).toBeUndefined();
        expect(hasVisibleGoal(cleared.goals[RAPID_SAVE_ACCOUNT_ID])).toBe(false);
    });

    test('reset from Settings restores seeded balances and no goal', () => {
        const storage = memoryStorage();
        saveSavingsGoal(RAPID_SAVE_ACCOUNT_ID, 2000000, 'House deposit', storage);

        const reset = resetEverydayMoneyState(storage);

        expect(reset.goals).toEqual({});
        expect(reset.accounts.find((account) => account.id === RAPID_SAVE_ACCOUNT_ID)?.availableCents).toBe(1864000);
        expect(loadEverydayMoneyState(storage).goals).toEqual({});
    });
});
