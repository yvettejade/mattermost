// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import {
    cardsAndLoansSubtotal,
    everydaySubtotal,
    formatAudFromCents,
    netPosition,
    ONLINE_ACCOUNTS,
    savingsSubtotal,
    youHave,
    youOwe,
} from './accounts';
import Online from './online';

const mockSelectLhsItem = jest.fn((type: string, id?: string) => {
    return {type: 'SELECT_LHS_ITEM', meta: {lhsType: type, id}};
});

jest.mock('actions/views/lhs', () => ({
    selectLhsItem: (type: string, id?: string) => mockSelectLhsItem(type, id),
}));

jest.mock('actions/views/rhs', () => ({
    suppressRHS: {type: 'SUPPRESS_RHS'},
    unsuppressRHS: {type: 'UNSUPPRESS_RHS'},
}));

describe('components/online/Online', () => {
    beforeEach(() => {
        mockSelectLhsItem.mockClear();
    });

    test('shows net position instead of a sum that treats loans as cash', () => {
        renderWithContext(<Online/>);

        const naiveSum = ONLINE_ACCOUNTS.reduce((sum, account) => sum + account.balanceCents, 0);

        expect(screen.getByRole('heading', {name: 'Everyday money'})).toBeVisible();
        expect(screen.getByTestId('online-position')).toHaveTextContent(formatAudFromCents(netPosition(ONLINE_ACCOUNTS)));
        expect(screen.getByTestId('online-position')).not.toHaveTextContent(formatAudFromCents(naiveSum));
        expect(screen.getByTestId('online-you-have')).toHaveTextContent(formatAudFromCents(youHave(ONLINE_ACCOUNTS)));
        expect(screen.getByTestId('online-you-owe')).toHaveTextContent(formatAudFromCents(youOwe(ONLINE_ACCOUNTS)));
        expect(mockSelectLhsItem).toHaveBeenCalledWith(LhsItemType.Page, LhsPage.Drafts);
    });

    test('keeps Everyday, Savings, and Cards & loans subtotals separate', () => {
        renderWithContext(<Online/>);

        expect(screen.getByTestId('online-everyday-subtotal')).toHaveTextContent(formatAudFromCents(everydaySubtotal(ONLINE_ACCOUNTS)));
        expect(screen.getByTestId('online-savings-subtotal')).toHaveTextContent(formatAudFromCents(savingsSubtotal(ONLINE_ACCOUNTS)));
        expect(screen.getByTestId('online-cards-loans-subtotal')).toHaveTextContent(formatAudFromCents(cardsAndLoansSubtotal(ONLINE_ACCOUNTS)));
        expect(screen.getAllByTestId('online-account')).toHaveLength(4);
        expect(screen.getAllByText('Everyday').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Savings').length).toBeGreaterThan(0);
        expect(screen.getByText('Credit card')).toBeVisible();
        expect(screen.getByText('Home loan')).toBeVisible();
        expect(screen.getAllByText('Outstanding')).toHaveLength(2);
    });
});
