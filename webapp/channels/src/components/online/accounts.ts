// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type AccountType = 'transaction' | 'savings' | 'term-deposit' | 'credit' | 'home-loan';

export type OnlineAccount = {
    id: string;
    name: {id: string; defaultMessage: string};
    number: string;
    type: AccountType;
    balanceCents: number;
};

const ASSET_TYPES: ReadonlySet<AccountType> = new Set(['transaction', 'savings', 'term-deposit']);
const LIABILITY_TYPES: ReadonlySet<AccountType> = new Set(['credit', 'home-loan']);

export const ONLINE_ACCOUNTS: OnlineAccount[] = [
    {
        id: 'everyday',
        name: {
            id: 'online.account.everyday',
            defaultMessage: 'Everyday',
        },
        number: '012-345 6789',
        type: 'transaction',
        balanceCents: 428055,
    },
    {
        id: 'savings',
        name: {
            id: 'online.account.savings',
            defaultMessage: 'Savings',
        },
        number: '012-345 6790',
        type: 'savings',
        balanceCents: 1864000,
    },
    {
        id: 'credit-card',
        name: {
            id: 'online.account.credit_card',
            defaultMessage: 'Credit card',
        },
        number: '4321',
        type: 'credit',
        balanceCents: 61240,
    },
    {
        id: 'home-loan',
        name: {
            id: 'online.account.home_loan',
            defaultMessage: 'Home loan',
        },
        number: '012-345 6792',
        type: 'home-loan',

        // Outstanding stored as a positive ledger amount — a naive sum treats this as cash.
        balanceCents: 41200000,
    },
];

export function formatAudFromCents(amountCents: number): string {
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
    }).format(amountCents / 100);
}

function outstandingCents(account: OnlineAccount): number {
    return Math.abs(account.balanceCents);
}

function sumByType(accounts: OnlineAccount[], type: AccountType): number {
    let total = 0;
    for (const account of accounts) {
        if (account.type === type) {
            total += account.balanceCents;
        }
    }
    return total;
}

export function everydaySubtotal(accounts: OnlineAccount[]): number {
    return sumByType(accounts, 'transaction');
}

export function savingsSubtotal(accounts: OnlineAccount[]): number {
    return sumByType(accounts, 'savings');
}

export function youHaveCents(accounts: OnlineAccount[]): number {
    let total = 0;
    for (const account of accounts) {
        if (ASSET_TYPES.has(account.type)) {
            total += account.balanceCents;
        }
    }
    return total;
}

export function youOweCents(accounts: OnlineAccount[]): number {
    let total = 0;
    for (const account of accounts) {
        if (LIABILITY_TYPES.has(account.type)) {
            total += outstandingCents(account);
        }
    }
    return total;
}

export function cardsAndLoansSubtotal(accounts: OnlineAccount[]): number {
    return youOweCents(accounts);
}

export function netPosition(accounts: OnlineAccount[]): number {
    return youHaveCents(accounts) - youOweCents(accounts);
}
