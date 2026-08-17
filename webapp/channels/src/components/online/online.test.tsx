// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import {getHistory} from 'utils/browser_history';
import {ONLINE_URL_SUFFIX} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import Online from './online';
import {EVERYDAY_MONEY_STORAGE_KEY, saveSavingsGoal} from './store';
import {RAPID_SAVE_ACCOUNT_ID} from './types';

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

    test('shows overall position and seeded accounts as tiles', () => {
        renderOnline();

        expect(screen.getByRole('heading', {name: 'Everyday money'})).toBeVisible();
        expect(screen.getByTestId('online-position')).toHaveTextContent('-$389,691.85');
        expect(screen.getAllByTestId('online-account')).toHaveLength(4);
        expect(screen.getByText('Everyday')).toBeVisible();
        expect(screen.getByText('Rapid Save')).toBeVisible();
        expect(screen.queryByTestId('online-goal-hint')).not.toBeInTheDocument();
        expect(mockSelectLhsItem).toHaveBeenCalledWith(LhsItemType.Page, LhsPage.Drafts);
    });

    test('Rapid Save tile shows a compact progress hint only for that account', () => {
        saveSavingsGoal(RAPID_SAVE_ACCOUNT_ID, 2000000, 'House deposit');

        renderOnline();

        const hint = screen.getByTestId('online-goal-hint');
        expect(hint).toHaveTextContent('$18,640.00 of $20,000.00');
        expect(hint).toHaveTextContent('House deposit');
        expect(screen.getAllByTestId('online-goal-hint')).toHaveLength(1);
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '93');
    });

    test('Rapid Save account detail can set a labelled goal and show progress', async () => {
        renderOnline('/team1/online/accounts/savings');

        expect(screen.getByRole('heading', {name: 'Rapid Save'})).toBeVisible();
        expect(screen.queryByTestId('online-goal-progress')).not.toBeInTheDocument();

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', {name: 'Set a savings goal'}));
        await user.type(screen.getByLabelText('Amount'), '20000');
        await user.type(screen.getByLabelText('Label'), 'House deposit');
        await user.click(screen.getByRole('button', {name: 'Save goal'}));

        expect(screen.getByTestId('online-goal-progress')).toHaveTextContent('$18,640.00 of $20,000.00');
        expect(screen.getByTestId('online-goal-progress')).toHaveTextContent('House deposit');
        expect(screen.getByRole('progressbar', {name: 'Savings goal progress'})).toHaveAttribute('aria-valuenow', '93');
        expect(window.localStorage.getItem(EVERYDAY_MONEY_STORAGE_KEY)).toContain('House deposit');
    });

    test('a zero or cleared goal hides the progress UI', async () => {
        saveSavingsGoal(RAPID_SAVE_ACCOUNT_ID, 2000000, 'House deposit');

        renderOnline('/team1/online/accounts/savings');

        expect(screen.getByTestId('online-goal-progress')).toBeVisible();

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', {name: 'Set a savings goal'}));
        await user.click(screen.getByRole('button', {name: 'Clear goal'}));

        expect(screen.queryByTestId('online-goal-progress')).not.toBeInTheDocument();
        expect(JSON.parse(window.localStorage.getItem(EVERYDAY_MONEY_STORAGE_KEY) ?? '{}').goals).toEqual({});
    });

    test('Everyday and other accounts do not offer a savings goal', () => {
        renderOnline('/team1/online/accounts/everyday');

        expect(screen.getByRole('heading', {name: 'Everyday'})).toBeVisible();
        expect(screen.queryByRole('button', {name: 'Set a savings goal'})).not.toBeInTheDocument();
    });

    test('reset from Settings clears the Rapid Save goal', async () => {
        saveSavingsGoal(RAPID_SAVE_ACCOUNT_ID, 2000000, 'House deposit');

        renderOnline('/team1/online/settings');

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', {name: 'Reset demo data'}));
        await user.click(screen.getByRole('link', {name: 'Accounts'}));

        expect(screen.queryByTestId('online-goal-hint')).not.toBeInTheDocument();
        expect(loadGoals()).toEqual({});
        expect(JSON.parse(window.localStorage.getItem(EVERYDAY_MONEY_STORAGE_KEY) ?? '{}').accounts.find((account: {id: string}) => account.id === RAPID_SAVE_ACCOUNT_ID).availableCents).toBe(1864000);
    });

    test('account tiles navigate to account detail', async () => {
        renderOnline();

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', {name: /Rapid Save/}));

        expect(getHistory().push).toHaveBeenCalledWith(`/team1/${ONLINE_URL_SUFFIX}/accounts/savings`);
    });
});

function loadGoals() {
    return JSON.parse(window.localStorage.getItem(EVERYDAY_MONEY_STORAGE_KEY) ?? '{}').goals;
}
