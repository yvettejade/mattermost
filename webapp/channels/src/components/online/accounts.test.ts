// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    cardsAndLoansSubtotal,
    everydaySubtotal,
    formatAudFromCents,
    netPosition,
    ONLINE_ACCOUNTS,
    savingsSubtotal,
    youHaveCents,
    youOweCents,
    type OnlineAccount,
} from './accounts';

function account(partial: Partial<OnlineAccount> & Pick<OnlineAccount, 'type' | 'balanceCents'>): OnlineAccount {
    return {
        id: partial.id ?? partial.type,
        name: partial.name ?? {id: 'online.account.test', defaultMessage: 'Test'},
        number: partial.number ?? '000',
        type: partial.type,
        balanceCents: partial.balanceCents,
    };
}

describe('online/accounts', () => {
    test('seeds Everyday, Savings, Credit card, and Home loan', () => {
        expect(ONLINE_ACCOUNTS.map((item) => item.id)).toEqual([
            'everyday',
            'savings',
            'credit-card',
            'home-loan',
        ]);
        expect(ONLINE_ACCOUNTS.map((item) => item.type)).toEqual([
            'transaction',
            'savings',
            'credit',
            'home-loan',
        ]);
    });

    test('Everyday and Savings subtotals ignore cards and loans', () => {
        expect(everydaySubtotal(ONLINE_ACCOUNTS)).toBe(428055);
        expect(savingsSubtotal(ONLINE_ACCOUNTS)).toBe(1864000);
        expect(everydaySubtotal(ONLINE_ACCOUNTS) + savingsSubtotal(ONLINE_ACCOUNTS)).toBe(2292055);
    });

    test('Cards & loans subtotal is the absolute outstanding', () => {
        expect(cardsAndLoansSubtotal(ONLINE_ACCOUNTS)).toBe(61240 + 41200000);
        expect(youOweCents(ONLINE_ACCOUNTS)).toBe(41261240);
    });

    test('netPosition subtracts credit and home-loan outstanding instead of summing stored ledgers', () => {
        const naiveSum = ONLINE_ACCOUNTS.reduce((sum, item) => sum + item.balanceCents, 0);

        expect(naiveSum).toBe(43553295);
        expect(youHaveCents(ONLINE_ACCOUNTS)).toBe(2292055);
        expect(netPosition(ONLINE_ACCOUNTS)).toBe(2292055 - 41261240);
        expect(netPosition(ONLINE_ACCOUNTS)).toBe(-38969185);
        expect(formatAudFromCents(netPosition(ONLINE_ACCOUNTS))).toBe('-$389,691.85');
    });

    test('netPosition uses the absolute outstanding when a loan is stored as a signed debit', () => {
        const accounts = [
            account({type: 'transaction', balanceCents: 10000}),
            account({type: 'home-loan', balanceCents: -50000}),
        ];

        expect(netPosition(accounts)).toBe(10000 - 50000);
        expect(cardsAndLoansSubtotal(accounts)).toBe(50000);
    });

    test('netPosition includes term deposits as assets', () => {
        const accounts = [
            account({type: 'transaction', balanceCents: 10000}),
            account({type: 'term-deposit', balanceCents: 25000}),
            account({type: 'credit', balanceCents: 4000}),
        ];

        expect(everydaySubtotal(accounts)).toBe(10000);
        expect(savingsSubtotal(accounts)).toBe(0);
        expect(youHaveCents(accounts)).toBe(35000);
        expect(netPosition(accounts)).toBe(31000);
    });

    test('netPosition is zero for an empty list', () => {
        expect(netPosition([])).toBe(0);
        expect(everydaySubtotal([])).toBe(0);
        expect(savingsSubtotal([])).toBe(0);
        expect(cardsAndLoansSubtotal([])).toBe(0);
    });
});
