// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import {
    OPEN_ACCOUNT_STORAGE_KEY,
    YOU_MONEY_ACCOUNT_CAP,
    openYouMoneyAccount,
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
        window.localStorage.clear();
    });

    test('shows Everyday tiles and does not link Add an account to the marketing page', () => {
        renderWithContext(<Online/>);

        expect(screen.getByRole('heading', {name: 'Everyday money'})).toBeVisible();
        expect(screen.getByRole('heading', {name: 'Everyday'})).toBeVisible();
        expect(screen.getByText('YouMoney')).toBeVisible();
        expect(screen.getByText('01-0123-0123456-00')).toBeVisible();
        expect(screen.getByTestId('online-add-account')).toBeVisible();
        expect(screen.queryByRole('link', {name: 'Add an account'})).not.toBeInTheDocument();
        expect(screen.getByTestId('online-add-account').closest('a')).toBeNull();
        expect(mockSelectLhsItem).toHaveBeenCalledWith(LhsItemType.Page, LhsPage.Drafts);
    });

    test('opens an in-IB nickname and colour flow, then adds a $0.00 YouMoney account', async () => {
        renderWithContext(<Online/>);
        const user = userEvent.setup();

        await user.click(screen.getByRole('button', {name: 'Add an account'}));

        expect(screen.getByRole('heading', {name: 'Open a YouMoney account'})).toBeVisible();
        expect(screen.getByLabelText('Nickname')).toBeVisible();
        expect(screen.getByRole('radio', {name: 'None'})).toBeChecked();

        await user.type(screen.getByLabelText('Nickname'), 'Holiday');
        await user.click(screen.getByRole('radio', {name: 'Teal'}));
        await user.click(screen.getByRole('button', {name: 'Confirm'}));

        expect(screen.getByText('Holiday')).toBeVisible();
        expect(screen.getByText('01-1847-0000001-00')).toBeVisible();
        expect(screen.getAllByText('$0.00').length).toBeGreaterThan(0);
        expect(window.localStorage.getItem(OPEN_ACCOUNT_STORAGE_KEY)).toContain('Holiday');
    });

    test('Cancel returns to the overview without opening an account', async () => {
        renderWithContext(<Online/>);
        const user = userEvent.setup();

        await user.click(screen.getByRole('button', {name: 'Add an account'}));
        await user.type(screen.getByLabelText('Nickname'), 'Should not save');
        await user.click(screen.getByRole('button', {name: 'Cancel'}));

        expect(screen.getByRole('heading', {name: 'Everyday'})).toBeVisible();
        expect(screen.queryByText('Should not save')).not.toBeInTheDocument();
        expect(screen.getAllByTestId('online-account')).toHaveLength(1);
        expect(window.localStorage.getItem(OPEN_ACCOUNT_STORAGE_KEY)).toBeNull();
    });

    test('keeps a newly opened account after refresh', async () => {
        const {unmount} = renderWithContext(<Online/>);
        const user = userEvent.setup();

        await user.click(screen.getByRole('button', {name: 'Add an account'}));
        await user.type(screen.getByLabelText('Nickname'), 'Bills');
        await user.click(screen.getByRole('button', {name: 'Confirm'}));
        unmount();

        renderWithContext(<Online/>);

        expect(screen.getByText('Bills')).toBeVisible();
        expect(screen.getByText('01-1847-0000001-00')).toBeVisible();
    });

    test('shows a clear error at the 25 YouMoney account cap', async () => {
        for (let i = 0; i < YOU_MONEY_ACCOUNT_CAP - 1; i++) {
            const result = openYouMoneyAccount({nickname: `Pot ${i + 1}`});
            expect(result.ok).toBe(true);
        }

        renderWithContext(<Online/>);
        const user = userEvent.setup();

        expect(screen.getAllByTestId('online-account')).toHaveLength(YOU_MONEY_ACCOUNT_CAP);
        await user.click(screen.getByRole('button', {name: 'Add an account'}));

        expect(screen.getByRole('alert')).toHaveTextContent('You can have up to 25 YouMoney accounts.');
        expect(screen.queryByRole('heading', {name: 'Open a YouMoney account'})).not.toBeInTheDocument();
        expect(screen.getAllByTestId('online-account')).toHaveLength(YOU_MONEY_ACCOUNT_CAP);
    });
});
