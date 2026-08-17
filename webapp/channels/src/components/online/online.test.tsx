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
    youHaveCents,
    youOweCents,
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

    test('shows net position instead of a spendable Overall sum', () => {
        renderWithContext(<Online/>);

        expect(screen.getByRole('heading', {name: 'Everyday money'})).toBeVisible();
        expect(screen.getByRole('heading', {name: 'Net position'})).toBeVisible();
        expect(screen.queryByText('Overall')).not.toBeInTheDocument();
        expect(screen.getByTestId('online-position')).toHaveTextContent(formatAudFromCents(netPosition(ONLINE_ACCOUNTS)));
        expect(screen.getByTestId('online-you-have')).toHaveTextContent(formatAudFromCents(youHaveCents(ONLINE_ACCOUNTS)));
        expect(screen.getByTestId('online-you-owe')).toHaveTextContent(formatAudFromCents(youOweCents(ONLINE_ACCOUNTS)));
        expect(screen.getByTestId('online-position')).not.toHaveTextContent('$435,532.95');
        expect(mockSelectLhsItem).toHaveBeenCalledWith(LhsItemType.Page, LhsPage.Drafts);
    });

    test('keeps Everyday, Savings, and Cards & loans subtotals', () => {
        renderWithContext(<Online/>);

        expect(screen.getByTestId('online-subtotal-everyday')).toHaveTextContent(formatAudFromCents(everydaySubtotal(ONLINE_ACCOUNTS)));
        expect(screen.getByTestId('online-subtotal-savings')).toHaveTextContent(formatAudFromCents(savingsSubtotal(ONLINE_ACCOUNTS)));
        expect(screen.getByTestId('online-subtotal-cards-loans')).toHaveTextContent(formatAudFromCents(cardsAndLoansSubtotal(ONLINE_ACCOUNTS)));
        expect(screen.getAllByTestId('online-account')).toHaveLength(4);
        expect(screen.getByTestId('online-subtotal-everyday')).toHaveTextContent('Everyday');
        expect(screen.getByTestId('online-subtotal-savings')).toHaveTextContent('Savings');
        expect(screen.getByTestId('online-subtotal-cards-loans')).toHaveTextContent('Cards & loans');
        expect(screen.getByRole('heading', {name: 'Everyday'})).toBeVisible();
        expect(screen.getByRole('heading', {name: 'Savings'})).toBeVisible();
        expect(screen.getByRole('heading', {name: 'Credit card'})).toBeVisible();
        expect(screen.getByRole('heading', {name: 'Home loan'})).toBeVisible();
    });
});
