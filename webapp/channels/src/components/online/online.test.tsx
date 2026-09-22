// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';

import {fireEvent, renderWithContext, screen, userEvent, waitFor, within} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';
import {TestHelper} from 'utils/test_helper';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import {ONLINE_CARD_LOCKS_STORAGE_KEY} from './cards';
import Online from './online';
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
        (getHistory().push as jest.Mock).mockClear();
    });

    test('shows the payments hub tiles', () => {
        renderOnline();

        expect(screen.getByRole('heading', {name: 'Cards, payments & scam controls'})).toBeVisible();
        const overview = screen.getByTestId('online-overview');
        expect(within(overview).getByRole('link', {name: /Cards/})).toBeVisible();
        expect(within(overview).getByRole('link', {name: /Pay anyone/})).toBeVisible();
        expect(within(overview).getByRole('link', {name: /Transfer/})).toBeVisible();
        expect(within(overview).getByRole('button', {name: /International/})).toBeVisible();
        expect(screen.getByTestId('online-scheduled')).toHaveTextContent('No scheduled payments yet');
        expect(mockSelectLhsItem).toHaveBeenCalledWith(LhsItemType.Page, LhsPage.Drafts);
    });

    test('International tile goes to the public quote page', async () => {
        renderOnline();

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', {name: /International/}));

        expect(getHistory().push).toHaveBeenCalledWith('/international');
    });

    test('lock persists, marks the card visually, and can be unlocked', async () => {
        renderOnline('/team1/online/cards');

        expect(screen.getAllByTestId('online-card')).toHaveLength(2);
        expect(screen.getByText('Flexi Debit')).toBeVisible();
        expect(screen.queryByText('Block overseas')).not.toBeInTheDocument();

        const user = userEvent.setup();
        await user.click(screen.getAllByRole('button', {name: 'Lock card'})[0]);

        expect(screen.getByTestId('online-cards-toast')).toHaveTextContent('Flexi Debit locked');
        expect(screen.getAllByTestId('online-card')[0]).toHaveClass('locked');
        expect(screen.getAllByTestId('online-card')[0]).toHaveAttribute('data-locked', 'true');
        expect(screen.getAllByTestId('online-card-status')[0]).toHaveTextContent('Locked');
        expect(screen.getByText('Unlock this card if you find it.')).toBeVisible();
        expect(window.localStorage.getItem(ONLINE_CARD_LOCKS_STORAGE_KEY)).toContain('"locked":true');

        await user.click(screen.getAllByRole('button', {name: 'Lock card'})[0]);

        expect(screen.getByTestId('online-cards-toast')).toHaveTextContent('Flexi Debit unlocked');
        expect(screen.getAllByTestId('online-card')[0]).not.toHaveClass('locked');
        expect(screen.queryByText('Unlock this card if you find it.')).not.toBeInTheDocument();
    });

    test('Pay reviews first, warns about scams, and does not move money until confirm', async () => {
        renderOnline('/team1/online/pay');

        const user = userEvent.setup();
        await user.click(screen.getByLabelText('Alex Chen'));
        await user.type(screen.getByLabelText('Amount'), '80');
        await user.click(screen.getByRole('button', {name: 'Pay'}));

        expect(screen.getByTestId('pay-anyone-confirm')).toBeVisible();
        expect(screen.getByRole('heading', {name: 'Confirm this payment'})).toBeVisible();
        const confirm = screen.getByTestId('pay-anyone-confirm');
        expect(within(confirm).getByText('Alex Chen')).toBeVisible();
        expect(within(confirm).getByText('Everyday')).toBeVisible();
        expect(within(confirm).getByText(/80\.00/)).toBeVisible();
        expect(screen.getByTestId('pay-anyone-warning')).toHaveTextContent('ANZ will never ask you to transfer money to keep an account safe');
        expect(screen.getByTestId('pay-anyone-warning')).toHaveTextContent('investment opportunities');
        expect(window.localStorage.getItem(PAY_ANYONE_STORAGE_KEY)).toBeNull();
    });

    test('Cancel leaves the form intact and does not move money', async () => {
        renderOnline('/team1/online/pay');

        const user = userEvent.setup();
        await user.click(screen.getByLabelText('Alex Chen'));
        await user.type(screen.getByLabelText('Amount'), '80');
        await user.click(screen.getByRole('button', {name: 'Pay'}));
        await user.click(screen.getByRole('button', {name: 'Cancel'}));

        expect(screen.queryByTestId('pay-anyone-confirm')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Amount')).toHaveValue(80);
        expect(screen.getByLabelText('Reference')).toHaveValue('Rent');
        expect(window.localStorage.getItem(PAY_ANYONE_STORAGE_KEY)).toBeNull();
    });

    test('Confirm sends a same-day payment and says sent, not scheduled', async () => {
        renderOnline('/team1/online/pay');

        const user = userEvent.setup();
        await user.click(screen.getByLabelText('Alex Chen'));
        await user.type(screen.getByLabelText('Amount'), '80');
        await user.click(screen.getByRole('button', {name: 'Pay'}));
        await user.click(screen.getByRole('button', {name: 'Confirm payment'}));

        expect(screen.getByTestId('pay-anyone-success')).toHaveTextContent('sent to Alex Chen');
        expect(screen.getByTestId('pay-anyone-success')).not.toHaveTextContent('scheduled');

        await user.click(screen.getByRole('button', {name: 'Make another payment'}));
        expect(screen.getByText(/Available/)).toHaveTextContent('4,200.55');
    });

    test('a future date is scheduled after confirm', async () => {
        renderOnline('/team1/online/pay');

        const user = userEvent.setup();
        await user.click(screen.getByLabelText('Alex Chen'));
        await user.type(screen.getByLabelText('Amount'), '80');
        fireEvent.change(screen.getByLabelText('When'), {target: {name: 'when', value: '2099-01-15'}});
        await user.click(screen.getByRole('button', {name: 'Pay'}));
        await user.click(screen.getByRole('button', {name: 'Confirm payment'}));

        expect(screen.getByTestId('pay-anyone-success')).toHaveTextContent('scheduled for 2099-01-15');

        await user.click(screen.getByRole('button', {name: 'Make another payment'}));
        expect(screen.getByText(/Available/)).toHaveTextContent('4,280.55');
    });

    test('saves a new payee, selects it, and persists it', async () => {
        renderOnline('/team1/online/pay');

        expect(screen.getByLabelText('Spark NZ')).toBeChecked();
        expect(within(screen.getByTestId('pay-anyone-pay-to')).getByText(SEED_PAYEES[0].accountNumber)).toBeVisible();

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', {name: 'Add a payee'}));
        await user.type(screen.getByLabelText('Name'), 'Jordan Lee');
        await user.type(screen.getByLabelText('Account number'), '02-1234-5678901-00');
        await user.type(screen.getByLabelText('Reference default'), 'School trip');
        await user.click(screen.getByRole('button', {name: 'Save payee'}));

        expect(screen.queryByTestId('pay-anyone-add-form')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Jordan Lee')).toBeChecked();
        expect(window.localStorage.getItem(PAY_ANYONE_STORAGE_KEY)).toContain('Jordan Lee');
    });

    test('shows an inline error and does not persist an invalid account number', async () => {
        renderOnline('/team1/online/pay');

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
});
