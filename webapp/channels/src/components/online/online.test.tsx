// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';

import {fireEvent, renderWithContext, screen, userEvent, waitFor, within} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import Online from './online';
import {CARDS_PAYMENTS_STORAGE_KEY} from './store';

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

    test('overview shows unlocked cards and an empty payments list', () => {
        renderOnline();

        expect(screen.getByRole('heading', {name: 'Cards, payments & scam controls'})).toBeVisible();
        expect(screen.getAllByTestId('online-overview-card')).toHaveLength(2);
        expect(screen.getByText('Flexi Debit')).toBeVisible();
        expect(screen.getByTestId('online-overview-payments-empty')).toBeVisible();
        expect(screen.getByRole('link', {name: 'indicative international quote'})).toHaveAttribute('href', '/international');
        expect(mockSelectLhsItem).toHaveBeenCalledWith(LhsItemType.Page, LhsPage.Drafts);
    });

    test('locking a card from Cards updates the badge immediately', async () => {
        renderOnline('/team1/online/cards');

        const user = userEvent.setup();
        const flexi = screen.getAllByTestId('online-card')[0];
        expect(flexi).toHaveAttribute('data-locked', 'false');

        await user.click(within(flexi).getByRole('button', {name: 'Lock card'}));

        expect(flexi).toHaveAttribute('data-locked', 'true');
        expect(within(flexi).getByTestId('online-card-status')).toHaveTextContent('Locked');
        expect(screen.getByTestId('online-cards-toast')).toHaveTextContent('Flexi Debit locked');
        expect(window.localStorage.getItem(CARDS_PAYMENTS_STORAGE_KEY)).toContain('"locked":true');
    });

    test('Pay reviews with a scam warning before money moves', async () => {
        renderOnline('/team1/online/pay');

        const user = userEvent.setup();
        await user.selectOptions(screen.getByLabelText('Payee'), 'payee-alex');
        await user.type(screen.getByLabelText('Amount'), '80');
        await user.click(screen.getByRole('button', {name: 'Review'}));

        const confirm = screen.getByTestId('pay-anyone-confirm');
        expect(confirm).toBeVisible();
        expect(within(confirm).getByText('Alex Chen')).toBeVisible();
        expect(screen.getByTestId('pay-anyone-warning')).toHaveTextContent('ANZ will never ask you to transfer money to keep an account safe');
        expect(screen.getByTestId('pay-anyone-warning')).toHaveTextContent('investment opportunities');
        expect(window.localStorage.getItem(CARDS_PAYMENTS_STORAGE_KEY)).toBeNull();
    });

    test('Cancel leaves the pay form intact', async () => {
        renderOnline('/team1/online/pay');

        const user = userEvent.setup();
        await user.type(screen.getByLabelText('Amount'), '80');
        await user.click(screen.getByRole('button', {name: 'Review'}));
        await user.click(screen.getByRole('button', {name: 'Cancel'}));

        expect(screen.queryByTestId('pay-anyone-confirm')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Amount')).toHaveValue('80');
        expect(window.localStorage.getItem(CARDS_PAYMENTS_STORAGE_KEY)).toBeNull();
    });

    test('Confirm sends a same-day payment and says sent', async () => {
        renderOnline('/team1/online/pay');

        const user = userEvent.setup();
        await user.selectOptions(screen.getByLabelText('Payee'), 'payee-alex');
        await user.type(screen.getByLabelText('Amount'), '80');
        await user.click(screen.getByRole('button', {name: 'Review'}));
        await user.click(screen.getByRole('button', {name: 'Confirm payment'}));

        expect(screen.getByTestId('pay-anyone-success')).toHaveTextContent('sent to Alex Chen');
        expect(screen.getByTestId('pay-anyone-success')).not.toHaveTextContent('scheduled');

        await user.click(screen.getByRole('button', {name: 'Make another payment'}));
        expect(screen.getByText(/Available/)).toHaveTextContent('4,200.55');
    });

    test('a future date is scheduled after confirm', async () => {
        renderOnline('/team1/online/pay');

        const user = userEvent.setup();
        await user.type(screen.getByLabelText('Amount'), '80');
        fireEvent.change(screen.getByLabelText('When'), {target: {value: '2099-01-15'}});
        await user.click(screen.getByRole('button', {name: 'Review'}));
        await user.click(screen.getByRole('button', {name: 'Confirm payment'}));

        expect(screen.getByTestId('pay-anyone-success')).toHaveTextContent('scheduled for 2099-01-15');

        await user.click(screen.getByRole('button', {name: 'Make another payment'}));
        expect(screen.getByText(/Available/)).toHaveTextContent('4,280.55');
    });

    test('saves a new payee and selects it', async () => {
        renderOnline('/team1/online/pay');

        const user = userEvent.setup();
        await user.selectOptions(screen.getByLabelText('Payee'), '__new__');
        await user.type(screen.getByLabelText('Payee name'), 'Jordan Lee');
        await user.type(screen.getByLabelText('Account number'), '010002000000300');
        await user.type(screen.getByLabelText('Default reference'), 'Dinner');
        await user.click(screen.getByRole('button', {name: 'Save payee'}));

        expect(screen.getByLabelText('Payee')).toHaveDisplayValue('Jordan Lee');
        expect(screen.getByLabelText('Reference')).toHaveValue('Dinner');
        expect(window.localStorage.getItem(CARDS_PAYMENTS_STORAGE_KEY)).toContain('Jordan Lee');
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
