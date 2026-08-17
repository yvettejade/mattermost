// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import Calculators from './calculators';

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

describe('components/calculators/Calculators', () => {
    beforeEach(() => {
        (global as any).historyMock.push.mockClear();
    });

    test('renders calculator sections used as search targets', () => {
        renderWithContext(<Calculators/>, initialState);

        expect(screen.getByRole('heading', {name: 'Calculators'})).toBeVisible();
        expect(document.getElementById('repayments')).toBeTruthy();
        expect(document.getElementById('borrowing')).toBeTruthy();
        expect(document.getElementById('savings-goal')).toBeTruthy();
        expect(document.getElementById('foreign-exchange')).toBeTruthy();
    });

    test('navigates back to site search', async () => {
        renderWithContext(<Calculators/>, initialState);

        await userEvent.click(screen.getByRole('button', {name: 'Site search'}));

        expect((global as any).historyMock.push).toHaveBeenCalledWith('/test-team/site-search');
    });
});
