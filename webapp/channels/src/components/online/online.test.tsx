// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import Online from './online';
import {EVERYDAY_MONEY_STORAGE_KEY} from './store';

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

const initialState = {
    entities: {
        teams: {
            currentTeamId: 'team1',
            teams: {
                team1: TestHelper.getTeamMock({id: 'team1', name: 'team1'}),
            },
        },
    },
};

function renderOnline(pathname = '/team1/online') {
    const history = createMemoryHistory({initialEntries: [pathname]});
    return renderWithContext(
        <Online/>,
        initialState,
        {history},
    );
}

describe('components/online/Online', () => {
    beforeEach(() => {
        mockSelectLhsItem.mockClear();
        window.localStorage.clear();
    });

    test('shows overall position and seeded accounts', () => {
        renderOnline();

        expect(screen.getByRole('heading', {name: 'Everyday money'})).toBeVisible();
        expect(screen.getByTestId('online-position')).toHaveTextContent('-$389,691.85');
        expect(screen.getAllByTestId('online-account')).toHaveLength(4);
        expect(screen.getByText('Everyday')).toBeVisible();
        expect(screen.getByText('Savings')).toBeVisible();
        expect(mockSelectLhsItem).toHaveBeenCalledWith(LhsItemType.Page, LhsPage.Drafts);
    });

    test('hides balances when the setting is on', async () => {
        renderOnline('/team1/online/settings');

        const user = userEvent.setup();
        await user.click(screen.getByRole('checkbox', {name: 'Hide balances on the accounts overview'}));
        await user.click(screen.getByRole('link', {name: 'Accounts'}));

        expect(screen.getByTestId('online-position')).toHaveTextContent('Hidden');
        expect(window.localStorage.getItem(EVERYDAY_MONEY_STORAGE_KEY)).toContain('"hideBalances":true');
    });

    test('account detail supports search, export, and scheduled activity', async () => {
        const createObjectURL = jest.fn(() => 'blob:online-export');
        const revokeObjectURL = jest.fn();
        Object.defineProperty(URL, 'createObjectURL', {configurable: true, value: createObjectURL});
        Object.defineProperty(URL, 'revokeObjectURL', {configurable: true, value: revokeObjectURL});
        const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

        renderOnline('/team1/online/accounts/everyday');

        expect(screen.getByTestId('online-scheduled')).toHaveTextContent('Rent');
        expect(screen.getByTestId('online-activity')).toHaveTextContent('Groceries — Woolworths');

        const user = userEvent.setup();
        await user.type(screen.getByRole('searchbox', {name: 'Search activity'}), 'salary');

        expect(screen.getByTestId('online-activity')).toHaveTextContent('Salary');
        expect(screen.queryByText('Groceries — Woolworths')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: 'Export'}));

        expect(createObjectURL).toHaveBeenCalled();
        const blob = createObjectURL.mock.calls[0][0] as Blob;
        expect(blob.type).toBe('text/csv');
        click.mockRestore();
    });

    test('requires review before a between-accounts transfer', async () => {
        renderOnline('/team1/online/transfer');

        const user = userEvent.setup();
        const confirm = screen.getByRole('button', {name: 'Confirm transfer'});
        expect(confirm).toBeDisabled();

        await user.type(screen.getByLabelText('Amount'), '40.25');
        await user.click(screen.getByRole('button', {name: 'Review'}));

        expect(screen.getByTestId('online-transfer-review')).toHaveTextContent('$40.25 from Everyday to Savings');
        expect(confirm).toBeEnabled();

        await user.click(confirm);

        await waitFor(() => {
            expect(screen.getByRole('status')).toHaveTextContent('Transferred $40.25 from Everyday to Savings.');
        });
    });

    test('requires review before paying anyone', async () => {
        renderOnline('/team1/online/pay');

        const user = userEvent.setup();
        const confirm = screen.getByRole('button', {name: 'Confirm payment'});
        expect(confirm).toBeDisabled();

        await user.clear(screen.getByLabelText('Payee'));
        await user.type(screen.getByLabelText('Payee'), 'Jordan Lee');
        await user.clear(screen.getByLabelText('Account number'));
        await user.type(screen.getByLabelText('Account number'), '87654321');
        await user.type(screen.getByLabelText('Amount'), '25.00');
        await user.click(screen.getByRole('button', {name: 'Review'}));

        expect(screen.getByTestId('online-pay-review')).toHaveTextContent('$25.00 from Everyday to Jordan Lee (87654321)');
        await user.click(confirm);

        await waitFor(() => {
            expect(screen.getByRole('status')).toHaveTextContent('Paid $25.00 to Jordan Lee from Everyday.');
        });
    });
});
