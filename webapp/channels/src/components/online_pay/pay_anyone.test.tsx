// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {fireEvent, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import PayAnyone from './pay_anyone';
import {
    addCalendarMonths,
    formatPaymentDateDisplay,
    PAY_ANYONE_STORAGE_KEY,
    todayInAuckland,
} from './payments';

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

function addDays(isoDate: string, days: number): string {
    const [year, month, day] = isoDate.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

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

    test('defaults When to today and keeps help text out of the accessible name', () => {
        renderWithContext(<PayAnyone/>);

        const when = screen.getByLabelText('When');
        expect(when).toHaveValue(todayInAuckland());
        expect(when).toHaveAttribute('min', todayInAuckland());
        expect(when).toHaveAttribute('max', addCalendarMonths(todayInAuckland(), 12));
        expect(when).toHaveAccessibleDescription(/Today pays now/);
        expect(screen.getByRole('button', {name: 'Pay now'})).toBeVisible();
        expect(screen.getByTestId('pay-anyone-scheduled')).toHaveTextContent('No scheduled payments');
        expect(mockSelectLhsItem).toHaveBeenCalledWith(LhsItemType.Page, LhsPage.Drafts);
    });

    test('Pay now updates the balance immediately and says sent', async () => {
        renderWithContext(<PayAnyone/>);

        const user = userEvent.setup();
        await fillPayment(user);
        await user.click(screen.getByRole('button', {name: 'Pay now'}));

        expect(screen.getByTestId('pay-anyone-success')).toHaveTextContent('sent to Alex Chen');
        expect(screen.getByTestId('pay-anyone-success')).not.toHaveTextContent('scheduled');
        expect(screen.getByTestId('pay-anyone-scheduled')).toHaveTextContent('No scheduled payments');

        await user.click(screen.getByRole('button', {name: 'Make another payment'}));
        expect(screen.getByText(/Available/)).toHaveTextContent('4,200.55');
    });

    test('a future date is scheduled without changing today’s balance', async () => {
        const when = addDays(todayInAuckland(), 14);
        renderWithContext(<PayAnyone/>);

        const user = userEvent.setup();
        await fillPayment(user, {when});
        expect(screen.getByRole('button', {name: 'Schedule'})).toBeVisible();
        await user.click(screen.getByRole('button', {name: 'Schedule'}));

        const success = screen.getByTestId('pay-anyone-success');
        expect(success).toHaveTextContent(`scheduled for ${formatPaymentDateDisplay(when)}`);
        expect(success).not.toHaveTextContent('sent to');
        expect(screen.getByTestId('pay-anyone-scheduled-item')).toHaveTextContent('Alex Chen');
        expect(screen.getByTestId('pay-anyone-scheduled-item')).toHaveTextContent(formatPaymentDateDisplay(when));

        await user.click(screen.getByRole('button', {name: 'Make another payment'}));
        expect(screen.getByText(/Available/)).toHaveTextContent('4,280.55');
    });

    test('rejects a date in the past and more than 12 months ahead', async () => {
        renderWithContext(<PayAnyone/>);

        const user = userEvent.setup();
        await fillPayment(user, {when: '2000-01-01'});
        await user.click(screen.getByRole('button', {name: 'Schedule'}));
        expect(screen.getByRole('alert')).toHaveTextContent('Choose today or a future date');
        expect(window.localStorage.getItem(PAY_ANYONE_STORAGE_KEY)).toBeNull();

        fireEvent.change(screen.getByLabelText('When'), {
            target: {name: 'when', value: addDays(addCalendarMonths(todayInAuckland(), 12), 1)},
        });
        await user.click(screen.getByRole('button', {name: 'Schedule'}));
        expect(screen.getByRole('alert')).toHaveTextContent('Choose a date within the next 12 months');
        expect(window.localStorage.getItem(PAY_ANYONE_STORAGE_KEY)).toBeNull();
    });

    test('Settings reset clears scheduled items and restores the balance', async () => {
        const when = addDays(todayInAuckland(), 14);
        renderWithContext(<PayAnyone/>);

        const user = userEvent.setup();
        await fillPayment(user, {when});
        await user.click(screen.getByRole('button', {name: 'Schedule'}));
        expect(screen.getByTestId('pay-anyone-scheduled-item')).toBeVisible();

        await user.click(screen.getByRole('button', {name: 'Reset demo'}));
        expect(screen.getByTestId('pay-anyone-reset-notice')).toHaveTextContent('Scheduled payments cleared');
        expect(screen.getByTestId('pay-anyone-scheduled')).toHaveTextContent('No scheduled payments');
        expect(screen.getByText(/Available/)).toHaveTextContent('4,280.55');
        expect(window.localStorage.getItem(PAY_ANYONE_STORAGE_KEY)).toBeNull();
    });
});
