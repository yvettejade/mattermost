// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type AccountType = 'transaction' | 'savings' | 'term-deposit' | 'credit' | 'home-loan';

export type Account = {
    id: string;
    name: {id: string; defaultMessage: string};
    number: string;
    type: AccountType;
    balanceCents: number;
};

export const ASSET_TYPES: readonly AccountType[] = ['transaction', 'savings', 'term-deposit'];
export const LIABILITY_TYPES: readonly AccountType[] = ['credit', 'home-loan'];
export const EVERYDAY_TYPES: readonly AccountType[] = ['transaction'];
export const SAVINGS_TYPES: readonly AccountType[] = ['savings', 'term-deposit'];

export const ONLINE_ACCOUNTS: Account[] = [
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
        balanceCents: 41200000,
    },
];

export function isAssetType(type: AccountType): boolean {
    return ASSET_TYPES.includes(type);
}

export function isLiabilityType(type: AccountType): boolean {
    return LIABILITY_TYPES.includes(type);
}

export function accountsOfTypes(accounts: Account[], types: readonly AccountType[]): Account[] {
    return accounts.filter((account) => types.includes(account.type));
}

function sumBalances(accounts: Account[]): number {
    let total = 0;
    for (const account of accounts) {
        total += account.balanceCents;
    }
    return total;
}

function sumOutstanding(accounts: Account[]): number {
    let total = 0;
    for (const account of accounts) {
        total += Math.abs(account.balanceCents);
    }
    return total;
}

export function youHave(accounts: Account[]): number {
    return sumBalances(accountsOfTypes(accounts, ASSET_TYPES));
}

export function youOwe(accounts: Account[]): number {
    return sumOutstanding(accountsOfTypes(accounts, LIABILITY_TYPES));
}

export function everydaySubtotal(accounts: Account[]): number {
    return sumBalances(accountsOfTypes(accounts, EVERYDAY_TYPES));
}

export function savingsSubtotal(accounts: Account[]): number {
    return sumBalances(accountsOfTypes(accounts, SAVINGS_TYPES));
}

export function cardsAndLoansSubtotal(accounts: Account[]): number {
    return sumOutstanding(accountsOfTypes(accounts, LIABILITY_TYPES));
}

export function netPosition(accounts: Account[]): number {
    // Liabilities may be stored as a positive outstanding or a negative ledger
    // balance. Always subtract the absolute amount so debt is never treated as cash.
    return youHave(accounts) - youOwe(accounts);
}

export function formatAudFromCents(amountCents: number): string {
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
    }).format(amountCents / 100);
}
