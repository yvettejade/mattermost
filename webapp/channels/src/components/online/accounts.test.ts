// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    getOnlineAccountsView,
    ONLINE_ACCOUNTS,
    ONLINE_ACCOUNTS_VIEW_STORAGE_KEY,
    setOnlineAccountsView,
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

describe('online/accounts', () => {
    test('defaults to tiles when nothing is stored', () => {
        expect(getOnlineAccountsView(memoryStorage())).toBe('tiles');
    });

    test('treats an unknown stored value as tiles', () => {
        const storage = memoryStorage({[ONLINE_ACCOUNTS_VIEW_STORAGE_KEY]: 'grid'});
        expect(getOnlineAccountsView(storage)).toBe('tiles');
    });

    test('reads and persists the compact list preference', () => {
        const storage = memoryStorage();

        setOnlineAccountsView('list', storage);

        expect(getOnlineAccountsView(storage)).toBe('list');
        expect(storage.getItem(ONLINE_ACCOUNTS_VIEW_STORAGE_KEY)).toBe('list');
    });

    test('seeds several accounts for the overview', () => {
        expect(ONLINE_ACCOUNTS).toHaveLength(4);
        expect(ONLINE_ACCOUNTS.map((account) => account.id)).toEqual([
            'ACC-1001',
            'ACC-1002',
            'ACC-1003',
            'ACC-1004',
        ]);
    });
});
