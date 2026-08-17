// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type AccountType = 'transaction' | 'savings' | 'term-deposit' | 'credit' | 'home-loan';

export type OnlineAccount = {
    id: string;
    type: AccountType;
    name: {id: string; defaultMessage: string};
    number: string;
    balanceCents: number;
};

const ASSET_TYPES: ReadonlySet<AccountType> = new Set(['transaction', 'savings', 'term-deposit']);
const LIABILITY_TYPES: ReadonlySet<AccountType> = new Set(['credit', 'home-loan']);

export const ONLINE_ACCOUNTS: OnlineAccount[] = [
    {
        id: 'everyday',
        type: 'transaction',
        name: {
            id: 'online.account.everyday',
            defaultMessage: 'Everyday',
        },
        number: '012-345 6789',
        balanceCents: 428055,
    },
    {
        id: 'savings',
        type: 'savings',
        name: {
            id: 'online.account.savings',
            defaultMessage: 'Savings',
        },
        number: '012-345 6790',
        balanceCents: 1864000,
    },
    {
        id: 'credit-card',
        type: 'credit',
        name: {
            id: 'online.account.credit_card',
            defaultMessage: 'Credit card',
        },
        number: '4321',

        // Outstanding is stored as a positive ledger amount. A naive sum would
        // treat this as spendable cash.
        balanceCents: 61240,
    },
    {
        id: 'home-loan',
        type: 'home-loan',
        name: {
            id: 'online.account.home_loan',
            defaultMessage: 'Home loan',
        },
        number: '012-345 6792',
        balanceCents: 41200000,
    },
];

export function isAssetAccount(account: OnlineAccount): boolean {
    return ASSET_TYPES.has(account.type);
}

export function isLiabilityAccount(account: OnlineAccount): boolean {
    return LIABILITY_TYPES.has(account.type);
}

export function outstandingCents(account: OnlineAccount): number {
    return Math.abs(account.balanceCents);
}

export function everydaySubtotal(accounts: OnlineAccount[]): number {
    return sumByType(accounts, 'transaction');
}

export function savingsSubtotal(accounts: OnlineAccount[]): number {
    return sumByType(accounts, 'savings');
}

export function cardsAndLoansSubtotal(accounts: OnlineAccount[]): number {
    return accounts.reduce((sum, account) => {
        if (!isLiabilityAccount(account)) {
            return sum;
        }
        return sum + outstandingCents(account);
    }, 0);
}

export function youHave(accounts: OnlineAccount[]): number {
    return accounts.reduce((sum, account) => {
        if (!isAssetAccount(account)) {
            return sum;
        }
        return sum + account.balanceCents;
    }, 0);
}

export function youOwe(accounts: OnlineAccount[]): number {
    return cardsAndLoansSubtotal(accounts);
}

export function netPosition(accounts: OnlineAccount[]): number {
    return youHave(accounts) - youOwe(accounts);
}

export function formatAudFromCents(amountCents: number): string {
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
    }).format(amountCents / 100);
}

function sumByType(accounts: OnlineAccount[], type: AccountType): number {
    return accounts.reduce((sum, account) => {
        if (account.type !== type) {
            return sum;
        }
        return sum + account.balanceCents;
    }, 0);
}
