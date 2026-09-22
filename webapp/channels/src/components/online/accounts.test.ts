// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    formatNzdFromCents,
    generateNzAccountNumber,
    loadEverydayAccounts,
    OPEN_ACCOUNT_STORAGE_KEY,
    openYouMoneyAccount,
    SEED_ACCOUNTS,
    YOU_MONEY_ACCOUNT_CAP,
    youMoneyAccounts,
} from './accounts';

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
        getItem: (key: string) => data[key] ?? null,
        key: (index: number) => Object.keys(data)[index] ?? null,
        removeItem: (key: string) => {
            delete data[key];
        },
        setItem: (key: string, value: string) => {
            data[key] = value;
        },
    };
}

describe('components/online/accounts', () => {
    test('formats zero as $0.00 in this Jest locale', () => {
        expect(formatNzdFromCents(0)).toBe('$0.00');
    });

    test('generates a unique NZ account number', () => {
        const first = generateNzAccountNumber(SEED_ACCOUNTS.map((account) => account.number));
        expect(first).toBe('01-1847-0000001-00');
        expect(generateNzAccountNumber([first])).toBe('01-1847-0000002-00');
    });

    test('loads the seeded YouMoney account when storage is empty', () => {
        expect(loadEverydayAccounts(memoryStorage())).toEqual(SEED_ACCOUNTS);
    });

    test('opens a YouMoney account at $0.00 and keeps it after reload', () => {
        const storage = memoryStorage();

        const result = openYouMoneyAccount({nickname: '  Holiday  ', colour: 'teal'}, storage);

        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }
        expect(result.account).toEqual({
            id: 'youmoney-opened-1',
            name: 'Holiday',
            number: '01-1847-0000001-00',
            kind: 'youmoney',
            availableCents: 0,
            colour: 'teal',
        });
        expect(youMoneyAccounts(result.accounts)).toHaveLength(2);
        expect(loadEverydayAccounts(storage)).toEqual(result.accounts);
        expect(storage.getItem(OPEN_ACCOUNT_STORAGE_KEY)).toContain('Holiday');
    });

    test('rejects a blank nickname and does not write storage', () => {
        const storage = memoryStorage();

        expect(openYouMoneyAccount({nickname: '   '}, storage)).toEqual({
            ok: false,
            error: 'nickname_required',
        });
        expect(storage.getItem(OPEN_ACCOUNT_STORAGE_KEY)).toBeNull();
    });

    test('rejects a 26th YouMoney account', () => {
        const storage = memoryStorage();
        for (let i = 0; i < YOU_MONEY_ACCOUNT_CAP - 1; i++) {
            const result = openYouMoneyAccount({nickname: `Pot ${i + 1}`}, storage);
            expect(result.ok).toBe(true);
        }

        expect(youMoneyAccounts(loadEverydayAccounts(storage))).toHaveLength(YOU_MONEY_ACCOUNT_CAP);
        expect(openYouMoneyAccount({nickname: 'One more'}, storage)).toEqual({
            ok: false,
            error: 'cap',
        });
        expect(youMoneyAccounts(loadEverydayAccounts(storage))).toHaveLength(YOU_MONEY_ACCOUNT_CAP);
    });
});
