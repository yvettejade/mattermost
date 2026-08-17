// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {fireEvent, renderWithContext, screen, userEvent, within} from 'tests/react_testing_utils';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import {PAY_ANYONE_STORAGE_KEY} from './payments';
import PayAnyone from './pay_anyone';

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

async function fillPayment(user: ReturnType<typeof userEvent.setup>, overrides?: {when?: string}) {
    await user.type(screen.getByLabelText('Payee name'), 'Alex Chen');
    await user.type(screen.getByLabelText('Account number'), '01-0001-0000001-00');
    await user.type(screen.getByLabelText('Amount'), '80');
    await user.type(screen.getByLabelText('Reference'), 'Rent');
    if (overrides?.when) {
        fireEvent.change(screen.getByLabelText('When'), {target: {name: 'when', value: overrides.when}});
    }
}

describe('components/online_pay/PayAnyone', () => {
    beforeEach(() => {
        mockSelectLhsItem.mockClear();
        window.localStorage.clear();
    });

    test('Pay reviews the payment instead of sending money', async () => {
        renderWithContext(<PayAnyone/>);

        const user = userEvent.setup();
        await fillPayment(user);
        await user.click(screen.getByRole('button', {name: 'Pay'}));

        expect(screen.getByTestId('pay-anyone-confirm')).toBeVisible();
        expect(screen.getByRole('heading', {name: 'Confirm this payment'})).toBeVisible();
        const confirm = screen.getByTestId('pay-anyone-confirm');
        expect(within(confirm).getByText('Alex Chen')).toBeVisible();
        expect(within(confirm).getByText('Everyday')).toBeVisible();
        expect(within(confirm).getByText(/80\.00/)).toBeVisible();
        expect(within(confirm).getByText('Rent')).toBeVisible();
        expect(screen.getByTestId('pay-anyone-warning')).toHaveTextContent('BNZ will never ask you to transfer money to keep an account safe');
        expect(screen.getByTestId('pay-anyone-warning')).toHaveTextContent('investment opportunities');
        expect(screen.getByRole('button', {name: 'Confirm payment'})).toBeVisible();
        expect(window.localStorage.getItem(PAY_ANYONE_STORAGE_KEY)).toBeNull();
        expect(mockSelectLhsItem).toHaveBeenCalledWith(LhsItemType.Page, LhsPage.Drafts);
    });

    test('Cancel leaves the form intact and does not move money', async () => {
        renderWithContext(<PayAnyone/>);

        const user = userEvent.setup();
        await fillPayment(user);
        await user.click(screen.getByRole('button', {name: 'Pay'}));
        await user.click(screen.getByRole('button', {name: 'Cancel'}));

        expect(screen.queryByTestId('pay-anyone-confirm')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Payee name')).toHaveValue('Alex Chen');
        expect(screen.getByLabelText('Amount')).toHaveValue(80);
        expect(screen.getByLabelText('Reference')).toHaveValue('Rent');
        expect(window.localStorage.getItem(PAY_ANYONE_STORAGE_KEY)).toBeNull();
    });

    test('Confirm sends a same-day payment and says sent, not scheduled', async () => {
        renderWithContext(<PayAnyone/>);

        const user = userEvent.setup();
        await fillPayment(user);
        await user.click(screen.getByRole('button', {name: 'Pay'}));
        await user.click(screen.getByRole('button', {name: 'Confirm payment'}));

        expect(screen.getByTestId('pay-anyone-success')).toHaveTextContent('sent to Alex Chen');
        expect(screen.getByTestId('pay-anyone-success')).not.toHaveTextContent('scheduled');

        await user.click(screen.getByRole('button', {name: 'Make another payment'}));
        expect(screen.getByText(/Available/)).toHaveTextContent('4,200.55');
    });

    test('a future date is scheduled after confirm', async () => {
        renderWithContext(<PayAnyone/>);

        const user = userEvent.setup();
        await fillPayment(user, {when: '2099-01-15'});
        await user.click(screen.getByRole('button', {name: 'Pay'}));
        await user.click(screen.getByRole('button', {name: 'Confirm payment'}));

        expect(screen.getByTestId('pay-anyone-success')).toHaveTextContent('scheduled for 2099-01-15');

        await user.click(screen.getByRole('button', {name: 'Make another payment'}));
        expect(screen.getByText(/Available/)).toHaveTextContent('4,280.55');
    });
});
