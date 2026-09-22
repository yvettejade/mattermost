// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {fireEvent, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import AccountDetail from './account_detail';

describe('components/account_detail/AccountDetail', () => {
    const now = new Date('2026-08-17T12:00:00+12:00');

    test('shows YouMoney transactions and the date range control by default', () => {
        renderWithContext(<AccountDetail now={now}/>);

        expect(screen.getByRole('heading', {name: 'Account'})).toBeInTheDocument();
        expect(screen.getByRole('tab', {name: 'YouMoney'})).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByText('Transaction account')).toBeInTheDocument();
        expect(screen.getByLabelText('Search')).toBeInTheDocument();
        expect(screen.getByLabelText('Category')).toBeInTheDocument();
        expect(screen.getByLabelText('Date range')).toBeInTheDocument();
        expect(screen.getByText('6 transactions')).toBeInTheDocument();
        expect(screen.getByText('Woolworths Grey Lynn')).toBeInTheDocument();
        expect(screen.getByText('Salary')).toBeInTheDocument();
    });

    test('this month preset updates the result count', async () => {
        renderWithContext(<AccountDetail now={now}/>);

        await userEvent.selectOptions(screen.getByLabelText('Date range'), 'this-month');

        expect(screen.getByText('3 transactions')).toBeInTheDocument();
        expect(screen.getByText('Woolworths Grey Lynn')).toBeInTheDocument();
        expect(screen.queryByText('Salary')).not.toBeInTheDocument();
        expect(screen.queryByText('Mercury Energy')).not.toBeInTheDocument();
    });

    test('custom from after to shows an inline error and keeps the full list', async () => {
        renderWithContext(<AccountDetail now={now}/>);

        await userEvent.selectOptions(screen.getByLabelText('Date range'), 'custom');
        fireEvent.change(screen.getByLabelText('From'), {target: {value: '2026-08-20'}});
        fireEvent.change(screen.getByLabelText('To'), {target: {value: '2026-08-01'}});

        expect(screen.getByRole('alert')).toHaveTextContent('From date must be on or before the to date.');
        expect(screen.getByText('6 transactions')).toBeInTheDocument();
    });

    test('search, category, and date range use AND logic', async () => {
        renderWithContext(<AccountDetail now={now}/>);

        await userEvent.type(screen.getByLabelText('Search'), 'wool');
        await userEvent.selectOptions(screen.getByLabelText('Category'), 'Groceries');
        await userEvent.selectOptions(screen.getByLabelText('Date range'), 'this-month');

        expect(screen.getByText('1 transaction')).toBeInTheDocument();
        expect(screen.getByText('Woolworths Grey Lynn')).toBeInTheDocument();
        expect(screen.queryByText('Allpress Espresso')).not.toBeInTheDocument();
    });

    test('clearing filters restores the full list', async () => {
        renderWithContext(<AccountDetail now={now}/>);

        await userEvent.selectOptions(screen.getByLabelText('Date range'), 'last-30');
        expect(screen.getByText('4 transactions')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: 'Clear filters'}));

        expect(screen.getByLabelText('Date range')).toHaveValue('');
        expect(screen.getByText('6 transactions')).toBeInTheDocument();
        expect(screen.getByText('Salary')).toBeInTheDocument();
    });

    test('Rapid Save has its own transaction list', async () => {
        renderWithContext(<AccountDetail now={now}/>);

        await userEvent.click(screen.getByRole('tab', {name: 'Rapid Save'}));

        expect(screen.getByRole('tab', {name: 'Rapid Save'})).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByText('Savings account')).toBeInTheDocument();
        expect(screen.getByText('3 transactions')).toBeInTheDocument();
        expect(screen.getByText('Opening deposit')).toBeInTheDocument();
        expect(screen.queryByText('Woolworths Grey Lynn')).not.toBeInTheDocument();
    });
});
