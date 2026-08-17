// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import ThisMonthSpendPanel from './this_month_spend_panel';
import {buildDemoTransactions} from './transactions';
import type {DemoTransaction} from './types';

describe('components/account_detail/ThisMonthSpendPanel', () => {
    const now = new Date('2026-08-17T12:00:00+12:00');

    test('renders category totals as text, not a colour-only chart', () => {
        renderWithContext(
            <ThisMonthSpendPanel
                accountKind='transaction'
                now={now}
            />,
        );

        expect(screen.getByRole('heading', {name: 'This month'})).toBeInTheDocument();
        expect(screen.getByText('This month spend by category')).toBeInTheDocument();
        expect(screen.getByRole('columnheader', {name: 'Category'})).toBeInTheDocument();
        expect(screen.getByRole('rowheader', {name: 'Groceries'})).toBeInTheDocument();
        expect(screen.getByRole('rowheader', {name: 'Eating out'})).toBeInTheDocument();
        expect(screen.getByText(/258\.55/)).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: 'Income and transfers'})).toBeInTheDocument();
        expect(screen.getByText(/Income:/)).toBeInTheDocument();
        expect(screen.getByText(/Transfers:/)).toBeInTheDocument();
        expect(screen.queryByText('No spend this month.')).not.toBeInTheDocument();
    });

    test('shows a short empty state instead of a blank chart', () => {
        const transactions: DemoTransaction[] = [];

        renderWithContext(
            <ThisMonthSpendPanel
                accountKind='credit'
                now={now}
                transactions={transactions}
            />,
        );

        expect(screen.getByText('No spend this month.')).toBeInTheDocument();
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    test('credit demo data is an empty month', () => {
        renderWithContext(
            <ThisMonthSpendPanel
                accountKind='credit'
                now={now}
                transactions={buildDemoTransactions(now)}
            />,
        );

        expect(screen.getByText('No spend this month.')).toBeInTheDocument();
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
});
