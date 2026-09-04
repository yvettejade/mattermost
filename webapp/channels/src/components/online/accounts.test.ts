// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    cardsAndLoansSubtotal,
    everydaySubtotal,
    formatAudFromCents,
    netPosition,
    ONLINE_ACCOUNTS,
    savingsSubtotal,
    youHave,
    youOwe,
    type Account,
} from './accounts';

function account(overrides: Partial<Account> & Pick<Account, 'type' | 'balanceCents'>): Account {
    return {
        id: overrides.id ?? overrides.type,
        name: overrides.name ?? {id: 'online.account.test', defaultMessage: overrides.type},
        number: overrides.number ?? '000',
        type: overrides.type,
        balanceCents: overrides.balanceCents,
    };
}

describe('online/accounts netPosition', () => {
    test('subtracts positive outstanding credit and home-loan balances', () => {
        const accounts = [
            account({type: 'transaction', balanceCents: 428055}),
            account({type: 'savings', balanceCents: 1864000}),
            account({type: 'credit', balanceCents: 61240}),
            account({type: 'home-loan', balanceCents: 41200000}),
        ];

        expect(netPosition(accounts)).toBe((428055 + 1864000) - 61240 - 41200000);
        expect(netPosition(accounts)).not.toBe(428055 + 1864000 + 61240 + 41200000);
    });

    test('still subtracts liabilities stored as negative ledger balances', () => {
        const accounts = [
            account({type: 'transaction', balanceCents: 10000}),
            account({type: 'credit', balanceCents: -2500}),
            account({type: 'home-loan', balanceCents: -40000}),
        ];

        expect(netPosition(accounts)).toBe(10000 - 2500 - 40000);
    });

    test('counts term-deposit with transaction and savings assets', () => {
        const accounts = [
            account({type: 'transaction', balanceCents: 1000}),
            account({type: 'savings', balanceCents: 2000}),
            account({type: 'term-deposit', balanceCents: 3000}),
            account({type: 'credit', balanceCents: 400}),
        ];

        expect(netPosition(accounts)).toBe((1000 + 2000 + 3000) - 400);
        expect(youHave(accounts)).toBe(6000);
        expect(youOwe(accounts)).toBe(400);
    });

    test('returns zero for an empty list', () => {
        expect(netPosition([])).toBe(0);
        expect(youHave([])).toBe(0);
        expect(youOwe([])).toBe(0);
    });

    test('seed Everyday and Savings subtotals stay the cash balances', () => {
        expect(everydaySubtotal(ONLINE_ACCOUNTS)).toBe(428055);
        expect(savingsSubtotal(ONLINE_ACCOUNTS)).toBe(1864000);
        expect(cardsAndLoansSubtotal(ONLINE_ACCOUNTS)).toBe(61240 + 41200000);
        expect(netPosition(ONLINE_ACCOUNTS)).toBe((428055 + 1864000) - 61240 - 41200000);
        expect(formatAudFromCents(428055)).toBe('$4,280.55');
        expect(formatAudFromCents(netPosition(ONLINE_ACCOUNTS))).toBe('-$389,691.85');
    });

    test('a term-deposit does not change the Everyday subtotal', () => {
        const withTermDeposit = [
            ...ONLINE_ACCOUNTS,
            account({id: 'term-deposit', type: 'term-deposit', balanceCents: 500000}),
        ];

        expect(everydaySubtotal(withTermDeposit)).toBe(everydaySubtotal(ONLINE_ACCOUNTS));
        expect(savingsSubtotal(withTermDeposit)).toBe(1864000 + 500000);
        expect(netPosition(withTermDeposit)).toBe(netPosition(ONLINE_ACCOUNTS) + 500000);
    });
});
