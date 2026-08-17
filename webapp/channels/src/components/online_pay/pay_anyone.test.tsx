// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, within} from 'tests/react_testing_utils';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import PayAnyone from './pay_anyone';
import {PAY_ANYONE_STORAGE_KEY, SEED_PAYEES} from './payees';

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

describe('components/online_pay/PayAnyone', () => {
    beforeEach(() => {
        mockSelectLhsItem.mockClear();
        window.localStorage.clear();
    });

    test('shows seed payees in the Pay to list', () => {
        renderWithContext(<PayAnyone/>);

        const payTo = screen.getByTestId('pay-anyone-pay-to');
        expect(within(payTo).getByText('Pay to')).toBeVisible();
        expect(screen.getByLabelText('Spark NZ')).toBeChecked();
        expect(within(payTo).getByText(SEED_PAYEES[0].accountNumber)).toBeVisible();
        expect(screen.getByRole('button', {name: 'Add a payee'})).toBeVisible();
        expect(screen.queryByRole('button', {name: 'Remove Spark NZ'})).not.toBeInTheDocument();
        expect(mockSelectLhsItem).toHaveBeenCalledWith(LhsItemType.Page, LhsPage.Drafts);
    });

    test('saves a new payee, selects it, and persists it', async () => {
        renderWithContext(<PayAnyone/>);

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', {name: 'Add a payee'}));
        await user.type(screen.getByLabelText('Name'), 'Jordan Lee');
        await user.type(screen.getByLabelText('Account number'), '02-1234-5678901-00');
        await user.type(screen.getByLabelText('Reference default'), 'School trip');
        await user.click(screen.getByRole('button', {name: 'Save payee'}));

        expect(screen.queryByTestId('pay-anyone-add-form')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Jordan Lee')).toBeChecked();
        expect(screen.getByTestId('pay-anyone-selected')).toHaveTextContent('Jordan Lee');
        expect(screen.getByTestId('pay-anyone-selected')).toHaveTextContent('02-1234-5678901-00');
        expect(screen.getByTestId('pay-anyone-selected')).toHaveTextContent('School trip');
        expect(window.localStorage.getItem(PAY_ANYONE_STORAGE_KEY)).toContain('Jordan Lee');
    });

    test('shows an inline error and does not persist an invalid account number', async () => {
        renderWithContext(<PayAnyone/>);

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', {name: 'Add a payee'}));
        await user.type(screen.getByLabelText('Name'), 'Jordan Lee');
        await user.type(screen.getByLabelText('Account number'), '12-34-56');
        await user.click(screen.getByRole('button', {name: 'Save payee'}));

        expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid account number like 12-3456-7890123-00');
        expect(screen.getByTestId('pay-anyone-add-form')).toBeVisible();
        expect(screen.queryByLabelText('Jordan Lee')).not.toBeInTheDocument();
        expect(window.localStorage.getItem(PAY_ANYONE_STORAGE_KEY)).toBeNull();
    });

    test('can remove a customer payee but not a seed payee', async () => {
        renderWithContext(<PayAnyone/>);

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', {name: 'Add a payee'}));
        await user.type(screen.getByLabelText('Name'), 'Jordan Lee');
        await user.type(screen.getByLabelText('Account number'), '02-1234-5678901-00');
        await user.click(screen.getByRole('button', {name: 'Save payee'}));
        await user.click(screen.getByRole('button', {name: 'Remove Jordan Lee'}));

        expect(screen.queryByLabelText('Jordan Lee')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Spark NZ')).toBeChecked();
        expect(screen.getByLabelText('Alex Chen')).toBeVisible();
        expect(screen.queryByRole('button', {name: 'Remove Alex Chen'})).not.toBeInTheDocument();
        expect(JSON.parse(window.localStorage.getItem(PAY_ANYONE_STORAGE_KEY) ?? '{}').customPayees).toEqual([]);
    });
});
