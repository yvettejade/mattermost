// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import {ONLINE_CARD_CONTROLS_STORAGE_KEY} from './cards';
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

    test('shows Flexi Debit and credit with lock, overseas, online, and daily-limit controls', () => {
        renderWithContext(<OnlineCards/>);

        expect(screen.getByRole('heading', {name: 'Cards'})).toBeVisible();
        expect(screen.getAllByTestId('online-card')).toHaveLength(2);
        expect(screen.getByText('Flexi Debit')).toBeVisible();
        expect(screen.getByText('Credit card')).toBeVisible();
        expect(screen.getAllByRole('button', {name: 'Lock card'})).toHaveLength(2);
        expect(screen.getAllByRole('button', {name: 'Block overseas'})).toHaveLength(2);
        expect(screen.getAllByRole('button', {name: 'Block online'})).toHaveLength(2);
        expect(screen.getAllByLabelText('Daily limit (NZD)')).toHaveLength(2);
        expect(mockSelectLhsItem).toHaveBeenCalledWith(LhsItemType.Page, LhsPage.Drafts);
    });

    test('block overseas persists and confirms with a toast', async () => {
        renderWithContext(<OnlineCards/>);

        const user = userEvent.setup();
        await user.click(screen.getAllByRole('button', {name: 'Block overseas'})[0]);

        expect(screen.getByTestId('online-cards-toast')).toHaveTextContent('Overseas spend blocked on Flexi Debit');
        expect(screen.getAllByRole('button', {name: 'Block overseas'})[0]).toHaveAttribute('aria-pressed', 'true');
        expect(window.localStorage.getItem(ONLINE_CARD_CONTROLS_STORAGE_KEY)).toContain('"blockOverseas":true');
    });

    test('locked card greys out extra controls with an explanation', async () => {
        renderWithContext(<OnlineCards/>);

        const user = userEvent.setup();
        await user.click(screen.getAllByRole('button', {name: 'Lock card'})[0]);

        expect(screen.getByTestId('online-cards-toast')).toHaveTextContent('Flexi Debit locked');
        expect(screen.getByText('Unlock this card to change spend controls.')).toBeVisible();
        expect(screen.getAllByRole('button', {name: 'Block overseas'})[0]).toBeDisabled();
        expect(screen.getAllByRole('button', {name: 'Block online'})[0]).toBeDisabled();
        expect(screen.getAllByLabelText('Daily limit (NZD)')[0]).toBeDisabled();
        expect(screen.getAllByTestId('online-card')[0]).toHaveClass('locked');
    });

    test('empty daily limit means no extra limit and a set limit persists', async () => {
        renderWithContext(<OnlineCards/>);

        const user = userEvent.setup();
        const limit = screen.getAllByLabelText('Daily limit (NZD)')[0];
        await user.type(limit, '150');
        await user.tab();

        expect(screen.getByTestId('online-cards-toast')).toHaveTextContent('Daily limit set to $150.00 on Flexi Debit');
        expect(window.localStorage.getItem(ONLINE_CARD_CONTROLS_STORAGE_KEY)).toContain('"dailyLimitCents":15000');

        await user.clear(limit);
        await user.tab();

        expect(screen.getByTestId('online-cards-toast')).toHaveTextContent('Daily limit removed on Flexi Debit');
        expect(window.localStorage.getItem(ONLINE_CARD_CONTROLS_STORAGE_KEY)).toContain('"dailyLimitCents":null');
    });

    test('reset restores defaults without a page reload', async () => {
        renderWithContext(<OnlineCards/>);

        const user = userEvent.setup();
        await user.click(screen.getAllByRole('button', {name: 'Block online'})[1]);
        await user.click(screen.getByRole('button', {name: 'Reset'}));

        expect(screen.getByTestId('online-cards-toast')).toHaveTextContent('Card controls reset to defaults');
        expect(screen.getAllByRole('button', {name: 'Block online'})[1]).toHaveAttribute('aria-pressed', 'false');
        expect(window.localStorage.getItem(ONLINE_CARD_CONTROLS_STORAGE_KEY)).toBeNull();
    });
});
