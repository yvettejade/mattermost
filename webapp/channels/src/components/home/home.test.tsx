// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {getRapidSaveProduct} from 'components/product_rates/product_rates';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import Home from './home';

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

function rapidSaveCopy() {
    return screen.getAllByText(/Rapid Save/).
        map((node) => node.closest('[data-product="rapid-save"]')?.textContent ?? node.textContent ?? '').
        join(' ');
}

describe('components/home/Home', () => {
    beforeEach(() => {
        (global as any).historyMock.push.mockClear();
    });

    test('hero and product card use the shared Rapid Save rate label', () => {
        renderWithContext(<Home/>, initialState);

        const rateLabel = getRapidSaveProduct().rateLabel;
        const rateMentions = screen.getAllByText(rateLabel);

        expect(screen.getByRole('heading', {name: 'Home'})).toBeVisible();
        expect(rateMentions.length).toBeGreaterThanOrEqual(2);
        expect(rapidSaveCopy().toLowerCase()).not.toContain('bonus');
    });

    test('View Rapid Save opens the product page hash', async () => {
        renderWithContext(<Home/>, initialState);

        await userEvent.click(screen.getByRole('button', {name: 'View Rapid Save'}));

        expect((global as any).historyMock.push).toHaveBeenCalledWith('/test-team/bank-accounts#rapid-save');
    });
});
