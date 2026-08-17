// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import AccountDetail from './account_detail';

describe('components/account_detail/AccountDetail', () => {
    test('shows the transaction account spend panel by default', () => {
        renderWithContext(<AccountDetail/>);

        expect(screen.getByRole('heading', {name: 'Account'})).toBeInTheDocument();
        expect(screen.getByRole('tab', {name: 'Everyday'})).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByText('Transaction account')).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: 'This month'})).toBeInTheDocument();
        expect(screen.getByRole('rowheader', {name: 'Groceries'})).toBeInTheDocument();
        expect(screen.getByRole('rowheader', {name: 'Eating out'})).toBeInTheDocument();
    });

    test('credit account shows the empty-month state', async () => {
        renderWithContext(<AccountDetail/>);

        await userEvent.click(screen.getByRole('tab', {name: 'Credit'}));

        expect(screen.getByRole('tab', {name: 'Credit'})).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByText('Credit account')).toBeInTheDocument();
        expect(screen.getByText('No spend this month.')).toBeInTheDocument();
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
});
