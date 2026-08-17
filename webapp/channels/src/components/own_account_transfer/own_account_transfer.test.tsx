// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {OWN_ACCOUNT_TRANSFER_STORAGE_KEY} from './accounts';
import OwnAccountTransfer from './own_account_transfer';

describe('components/own_account_transfer/OwnAccountTransfer', () => {
    beforeEach(() => {
        window.localStorage.removeItem(OWN_ACCOUNT_TRANSFER_STORAGE_KEY);
    });

    test('shows eligible own-account balances', () => {
        renderWithContext(<OwnAccountTransfer/>);

        expect(screen.getByRole('heading', {name: 'Transfer'})).toBeInTheDocument();
        expect(screen.getByText('YouMoney')).toBeInTheDocument();
        expect(screen.getByText('Rapid Save')).toBeInTheDocument();
        expect(screen.getByText('Online Account')).toBeInTheDocument();
        expect(screen.getByText('$4,280.50')).toBeInTheDocument();
        expect(screen.getByText('$12,500.00')).toBeInTheDocument();
        expect(screen.getByText('$890.25')).toBeInTheDocument();
        expect(screen.getByText('No transfers yet.')).toBeInTheDocument();
    });

    test('transfer updates balances immediately and writes a transaction', async () => {
        renderWithContext(<OwnAccountTransfer/>);

        await userEvent.selectOptions(screen.getByLabelText('From'), 'youmoney');
        await userEvent.selectOptions(screen.getByLabelText('To'), 'rapid-save');
        await userEvent.type(screen.getByLabelText('Amount'), '250');
        await userEvent.click(screen.getByRole('button', {name: 'Transfer'}));

        expect(screen.getByText('Transferred $250.00 from YouMoney to Rapid Save.')).toBeInTheDocument();
        expect(screen.getByText('$4,030.50')).toBeInTheDocument();
        expect(screen.getByText('$12,750.00')).toBeInTheDocument();
        expect(screen.getByText('$250.00 from YouMoney to Rapid Save')).toBeInTheDocument();
        expect(screen.queryByText('No transfers yet.')).not.toBeInTheDocument();
    });

    test('insufficient funds leaves balances unchanged', async () => {
        renderWithContext(<OwnAccountTransfer/>);

        await userEvent.selectOptions(screen.getByLabelText('From'), 'online-account');
        await userEvent.selectOptions(screen.getByLabelText('To'), 'youmoney');
        await userEvent.type(screen.getByLabelText('Amount'), '900');
        await userEvent.click(screen.getByRole('button', {name: 'Transfer'}));

        expect(screen.getByText('That amount is more than the available balance.')).toBeInTheDocument();
        expect(screen.getByText('$4,280.50')).toBeInTheDocument();
        expect(screen.getByText('$890.25')).toBeInTheDocument();
        expect(screen.getByText('No transfers yet.')).toBeInTheDocument();
    });
});
