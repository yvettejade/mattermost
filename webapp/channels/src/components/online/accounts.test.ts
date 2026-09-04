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
    type OnlineAccount,
} from './accounts';

function account(partial: Partial<OnlineAccount> & Pick<OnlineAccount, 'type' | 'balanceCents'>): OnlineAccount {
    return {
        id: partial.id ?? partial.type,
        name: partial.name ?? {id: 'online.account.test', defaultMessage: partial.type},
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

    test('Cards & loans subtotal is outstanding, not spendable cash', () => {
        expect(cardsAndLoansSubtotal(ONLINE_ACCOUNTS)).toBe(61240 + 41200000);
        expect(youOwe(ONLINE_ACCOUNTS)).toBe(41261240);
    });

    test('netPosition is assets minus absolute outstanding, not a signed ledger sum', () => {
        const naiveSum = ONLINE_ACCOUNTS.reduce((sum, item) => sum + item.balanceCents, 0);

        expect(naiveSum).toBe(428055 + 1864000 + 61240 + 41200000);
        expect(youHave(ONLINE_ACCOUNTS)).toBe(428055 + 1864000);
        expect(netPosition(ONLINE_ACCOUNTS)).toBe((428055 + 1864000) - (61240 + 41200000));
        expect(netPosition(ONLINE_ACCOUNTS)).not.toBe(naiveSum);
        expect(formatAudFromCents(netPosition(ONLINE_ACCOUNTS))).toBe('-$389,691.85');
    });

    test('netPosition includes term deposits and subtracts liabilities stored with either sign', () => {
        const accounts: OnlineAccount[] = [
            account({type: 'transaction', balanceCents: 10000}),
            account({type: 'savings', balanceCents: 20000}),
            account({type: 'term-deposit', balanceCents: 50000}),
            account({type: 'credit', balanceCents: 1500}),
            account({type: 'home-loan', balanceCents: -8000}),
        ];

        expect(everydaySubtotal(accounts)).toBe(10000);
        expect(savingsSubtotal(accounts)).toBe(20000);
        expect(cardsAndLoansSubtotal(accounts)).toBe(1500 + 8000);
        expect(netPosition(accounts)).toBe((10000 + 20000 + 50000) - 1500 - 8000);
    });
});
