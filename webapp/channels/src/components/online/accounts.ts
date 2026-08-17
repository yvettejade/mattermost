// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const ONLINE_ACCOUNTS_VIEW_STORAGE_KEY = 'mm_online_accounts_view';

export type OnlineAccountsView = 'tiles' | 'list';

export type OnlineAccount = {
    id: string;
    name: {id: string; defaultMessage: string};
    number: string;
    available: number;
};

export const ONLINE_ACCOUNTS: OnlineAccount[] = [
    {
        id: 'ACC-1001',
        name: {
            id: 'online.account.everyday',
            defaultMessage: 'Everyday',
        },
        number: '012-345 6789',
        available: 4280.55,
    },
    {
        id: 'ACC-1002',
        name: {
            id: 'online.account.savings',
            defaultMessage: 'Savings',
        },
        number: '012-345 6790',
        available: 18640,
    },
    {
        id: 'ACC-1003',
        name: {
            id: 'online.account.credit_card',
            defaultMessage: 'Credit card',
        },
        number: '4321',
        available: -612.4,
    },
    {
        id: 'ACC-1004',
        name: {
            id: 'online.account.home_loan',
            defaultMessage: 'Home loan',
        },
        number: '012-345 6792',
        available: -412000,
    },
];

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'>;

export function getOnlineAccountsView(storage: ReadableStorage = localStorage): OnlineAccountsView {
    return storage.getItem(ONLINE_ACCOUNTS_VIEW_STORAGE_KEY) === 'list' ? 'list' : 'tiles';
}

export function setOnlineAccountsView(view: OnlineAccountsView, storage: WritableStorage = localStorage): void {
    storage.setItem(ONLINE_ACCOUNTS_VIEW_STORAGE_KEY, view);
}
