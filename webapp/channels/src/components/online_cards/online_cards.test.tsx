// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import {ONLINE_CARD_LOCKS_STORAGE_KEY} from './cards';
import OnlineCards from './online_cards';

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

describe('components/online_cards/OnlineCards', () => {
    beforeEach(() => {
        mockSelectLhsItem.mockClear();
        window.localStorage.clear();
    });

    test('shows Flexi Debit and credit with lock controls', () => {
        renderWithContext(<OnlineCards/>);

        expect(screen.getByRole('heading', {name: 'Cards'})).toBeVisible();
        expect(screen.getAllByTestId('online-card')).toHaveLength(2);
        expect(screen.getByText('Flexi Debit')).toBeVisible();
        expect(screen.getByText('Credit card')).toBeVisible();
        expect(screen.getAllByRole('button', {name: 'Lock card'})).toHaveLength(2);
        expect(screen.getAllByTestId('online-card-status').map((node) => node.textContent)).toEqual(['Active', 'Active']);
        expect(screen.queryByText('Block overseas')).not.toBeInTheDocument();
        expect(screen.queryByText('Block online')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Daily limit (NZD)')).not.toBeInTheDocument();
        expect(mockSelectLhsItem).toHaveBeenCalledWith(LhsItemType.Page, LhsPage.Drafts);
    });

    test('lock persists, marks the card visually, and can be unlocked', async () => {
        renderWithContext(<OnlineCards/>);

        const user = userEvent.setup();
        await user.click(screen.getAllByRole('button', {name: 'Lock card'})[0]);

        expect(screen.getByTestId('online-cards-toast')).toHaveTextContent('Flexi Debit locked');
        expect(screen.getAllByTestId('online-card')[0]).toHaveClass('locked');
        expect(screen.getAllByTestId('online-card')[0]).toHaveAttribute('data-locked', 'true');
        expect(screen.getAllByTestId('online-card-status')[0]).toHaveTextContent('Locked');
        expect(screen.getByText('Unlock this card if you find it.')).toBeVisible();
        expect(screen.getAllByRole('button', {name: 'Lock card'})[0]).toHaveAttribute('aria-pressed', 'true');
        expect(window.localStorage.getItem(ONLINE_CARD_LOCKS_STORAGE_KEY)).toContain('"locked":true');

        await user.click(screen.getAllByRole('button', {name: 'Lock card'})[0]);

        expect(screen.getByTestId('online-cards-toast')).toHaveTextContent('Flexi Debit unlocked');
        expect(screen.getAllByTestId('online-card')[0]).not.toHaveClass('locked');
        expect(screen.getAllByTestId('online-card-status')[0]).toHaveTextContent('Active');
        expect(screen.queryByText('Unlock this card if you find it.')).not.toBeInTheDocument();
        expect(window.localStorage.getItem(ONLINE_CARD_LOCKS_STORAGE_KEY)).toContain('"locked":false');
    });

    test('reset unlocks both cards without a page reload', async () => {
        renderWithContext(<OnlineCards/>);

        const user = userEvent.setup();
        await user.click(screen.getAllByRole('button', {name: 'Lock card'})[1]);
        await user.click(screen.getByRole('button', {name: 'Reset'}));

        expect(screen.getByTestId('online-cards-toast')).toHaveTextContent('Cards unlocked');
        expect(screen.getAllByRole('button', {name: 'Lock card'})[1]).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getAllByTestId('online-card-status').map((node) => node.textContent)).toEqual(['Active', 'Active']);
        expect(window.localStorage.getItem(ONLINE_CARD_LOCKS_STORAGE_KEY)).toBeNull();
    });
});
