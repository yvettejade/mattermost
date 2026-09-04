// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import {netPosition, ONLINE_ACCOUNTS} from './accounts';
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

    test('shows net position instead of a naive sum of every balance', () => {
        renderWithContext(<Online/>);

        expect(screen.getByRole('heading', {name: 'Everyday money'})).toBeVisible();
        expect(screen.getByRole('heading', {name: 'Net position'})).toBeVisible();
        expect(screen.getByTestId('online-position')).toHaveTextContent('-$389,691.85');
        expect(screen.getByTestId('online-position')).not.toHaveTextContent('$435,532.95');
        expect(screen.getByTestId('online-you-have')).toHaveTextContent('You have $22,920.55');
        expect(screen.getByTestId('online-you-owe')).toHaveTextContent('You owe $412,612.40');
        expect(netPosition(ONLINE_ACCOUNTS)).toBe(-38969185);
        expect(mockSelectLhsItem).toHaveBeenCalledWith(LhsItemType.Page, LhsPage.Drafts);
    });

    test('keeps Everyday and Savings subtotals and still shows Cards & loans', () => {
        renderWithContext(<Online/>);

        expect(screen.getByTestId('online-everyday-subtotal')).toHaveTextContent('$4,280.55');
        expect(screen.getByTestId('online-savings-subtotal')).toHaveTextContent('$18,640.00');
        expect(screen.getByTestId('online-cards-loans-subtotal')).toHaveTextContent('$412,612.40');
        expect(screen.getByRole('heading', {name: 'Cards & loans'})).toBeVisible();
        expect(screen.getAllByTestId('online-account')).toHaveLength(4);
        expect(screen.getByRole('heading', {level: 4, name: 'Everyday'})).toBeVisible();
        expect(screen.getByRole('heading', {level: 4, name: 'Savings'})).toBeVisible();
        expect(screen.getByRole('heading', {level: 4, name: 'Credit card'})).toBeVisible();
        expect(screen.getByRole('heading', {level: 4, name: 'Home loan'})).toBeVisible();
    });
});
