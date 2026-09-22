// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {getRapidSaveProduct} from 'components/product_rates/product_rates';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import BankAccounts from './bank_accounts';

jest.mock('actions/views/rhs', () => ({
    suppressRHS: {type: 'SUPPRESS_RHS'},
    unsuppressRHS: {type: 'UNSUPPRESS_RHS'},
}));

const initialState = {
    entities: {
        teams: {
            currentTeamId: 'team1',
            teams: {
                team1: {id: 'team1', name: 'test-team', display_name: 'Test Team'},
            },
        },
    },
};

describe('components/bank_accounts/BankAccounts', () => {
    beforeEach(() => {
        (global as any).historyMock.push.mockClear();
    });

    test('product card, Rapid Save section, and rates table share one rate label', () => {
        renderWithContext(<BankAccounts/>, initialState);

        const rateLabel = getRapidSaveProduct().rateLabel;
        const rapidSaveSurfaces = document.querySelectorAll('[data-product="rapid-save"]');

        expect(screen.getByRole('heading', {name: 'Bank accounts'})).toBeVisible();
        expect(document.getElementById('rapid-save')).toBeTruthy();
        expect(rapidSaveSurfaces.length).toBeGreaterThanOrEqual(3);
        expect(screen.getAllByText(rateLabel).length).toBeGreaterThanOrEqual(3);
        rapidSaveSurfaces.forEach((surface) => {
            expect(surface.textContent?.toLowerCase()).not.toContain('bonus');
        });
    });

    test('Home returns to the public homepage', async () => {
        renderWithContext(<BankAccounts/>, initialState);

        await userEvent.click(screen.getByRole('button', {name: 'Home'}));

        expect((global as any).historyMock.push).toHaveBeenCalledWith('/test-team/home');
    });
});
