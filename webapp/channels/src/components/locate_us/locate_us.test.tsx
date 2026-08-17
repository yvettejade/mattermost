// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import LocateUs from './locate_us';
import {DEMO_SUNDAY_11_NZST, DEMO_WEEKDAY_11_NZST} from './locations';

jest.mock('actions/views/rhs', () => ({
    suppressRHS: {type: 'SUPPRESS_RHS'},
    unsuppressRHS: {type: 'UNSUPPRESS_RHS'},
}));

describe('components/locate_us/LocateUs', () => {
    test('lists every location and updates the count when Branch is selected', async () => {
        renderWithContext(
            <LocateUs now={DEMO_WEEKDAY_11_NZST}/>,
        );

        expect(screen.getAllByRole('heading', {name: 'Locate us'}).length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('6 locations')).toBeVisible();
        expect(screen.getByText('Auckland High Street')).toBeVisible();
        expect(screen.getByText('Auckland Queen Street ATM')).toBeVisible();

        await userEvent.click(screen.getByRole('radio', {name: 'Branch'}));

        expect(screen.getByText('3 locations')).toBeVisible();
        expect(screen.getByText('Dunedin George Street')).toBeVisible();
        expect(screen.queryByText('Auckland Queen Street ATM')).not.toBeInTheDocument();
    });

    test('ATM chip keeps machines only', async () => {
        renderWithContext(
            <LocateUs now={DEMO_WEEKDAY_11_NZST}/>,
        );

        await userEvent.click(screen.getByRole('radio', {name: 'ATM'}));

        expect(screen.getByText('3 locations')).toBeVisible();
        expect(screen.getByText('Wellington Railway Station ATM')).toBeVisible();
        expect(screen.queryByText('Wellington Lambton Quay')).not.toBeInTheDocument();
    });

    test('Open now at weekday 11:00 NZST drops the late-opening branch', async () => {
        renderWithContext(
            <LocateUs now={DEMO_WEEKDAY_11_NZST}/>,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Open now'}));

        expect(screen.getByText('5 locations')).toBeVisible();
        expect(screen.queryByText('Dunedin George Street')).not.toBeInTheDocument();
        expect(screen.getByText('Auckland High Street')).toBeVisible();
    });

    test('shows an empty state when nothing matches', async () => {
        renderWithContext(
            <LocateUs now={DEMO_SUNDAY_11_NZST}/>,
        );

        await userEvent.click(screen.getByRole('radio', {name: 'Branch'}));
        await userEvent.click(screen.getByRole('button', {name: 'Open now'}));

        expect(screen.getByText('No locations')).toBeVisible();
        expect(screen.getByText('No locations match these filters')).toBeVisible();
        expect(screen.getByText('Try All, or turn off Open now.')).toBeVisible();
    });

    test('keeps filters above the list', () => {
        renderWithContext(
            <LocateUs now={DEMO_WEEKDAY_11_NZST}/>,
        );

        const filters = screen.getByTestId('locate-us-filters');
        const list = screen.getByText('Auckland High Street').closest('ul');

        expect(filters.compareDocumentPosition(list as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
});
