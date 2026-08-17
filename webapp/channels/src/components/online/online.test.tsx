// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import {ONLINE_ACCOUNTS_VIEW_STORAGE_KEY} from './accounts';
import Online from './online';

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

describe('components/online/Online', () => {
    beforeEach(() => {
        mockSelectLhsItem.mockClear();
        window.localStorage.clear();
    });

    test('shows accounts as tiles by default', () => {
        renderWithContext(<Online/>);

        expect(screen.getByRole('heading', {name: 'Everyday money'})).toBeVisible();
        expect(screen.getByTestId('online-accounts')).toHaveClass('tiles');
        expect(screen.getAllByTestId('online-account')).toHaveLength(4);
        expect(screen.getByText('Everyday')).toBeVisible();
        expect(screen.getByRole('radio', {name: 'Tiles'})).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('radio', {name: 'List'})).toHaveAttribute('aria-checked', 'false');
        expect(mockSelectLhsItem).toHaveBeenCalledWith(LhsItemType.Page, LhsPage.Drafts);
    });

    test('switches to a compact list and remembers the preference', async () => {
        renderWithContext(<Online/>);

        const user = userEvent.setup();
        await user.click(screen.getByRole('radio', {name: 'List'}));

        expect(screen.getByTestId('online-accounts')).toHaveClass('list');
        expect(screen.getByRole('radio', {name: 'List'})).toHaveAttribute('aria-checked', 'true');
        expect(window.localStorage.getItem(ONLINE_ACCOUNTS_VIEW_STORAGE_KEY)).toBe('list');
    });

    test('restores the compact list from local storage', () => {
        window.localStorage.setItem(ONLINE_ACCOUNTS_VIEW_STORAGE_KEY, 'list');

        renderWithContext(<Online/>);

        expect(screen.getByTestId('online-accounts')).toHaveClass('list');
        expect(screen.getByRole('radio', {name: 'List'})).toHaveAttribute('aria-checked', 'true');
    });
});
