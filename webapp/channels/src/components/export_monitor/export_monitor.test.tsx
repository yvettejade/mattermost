// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import {EXPORT_CONNECTOR_STORAGE_KEY} from './export_connector';
import ExportMonitor from './export_monitor';

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

describe('components/export_monitor/ExportMonitor', () => {
    beforeEach(() => {
        mockSelectLhsItem.mockClear();
        window.localStorage.clear();
    });

    test('shows approved items and payloads when the connector is on', () => {
        renderWithContext(<ExportMonitor/>);

        expect(screen.getByRole('heading', {name: 'Export monitor'})).toBeVisible();
        expect(screen.getByTestId('export-connector-status')).toHaveTextContent('On');
        expect(screen.getAllByText('EXP-1042')).toHaveLength(2);
        expect(screen.getAllByText('Q3 field travel')).toHaveLength(2);
        expect(screen.getAllByTestId('export-payload')).toHaveLength(3);
        expect(screen.queryByRole('button', {name: 'Turn connector on'})).not.toBeInTheDocument();
        expect(mockSelectLhsItem).toHaveBeenCalledWith(LhsItemType.Page, LhsPage.Drafts);
    });

    test('shows zero payloads until the connector is turned back on', async () => {
        window.localStorage.setItem(EXPORT_CONNECTOR_STORAGE_KEY, 'false');

        renderWithContext(<ExportMonitor/>);

        expect(screen.getByTestId('export-connector-status')).toHaveTextContent('Off');
        expect(screen.getByTestId('export-payloads-empty')).toHaveTextContent('No payloads. The export connector is off.');
        expect(screen.getByText('EXP-1042')).toBeVisible();
        expect(screen.queryAllByTestId('export-payload')).toHaveLength(0);

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', {name: 'Turn connector on'}));

        expect(screen.getByTestId('export-connector-status')).toHaveTextContent('On');
        expect(screen.getAllByTestId('export-payload')).toHaveLength(3);
        expect(window.localStorage.getItem(EXPORT_CONNECTOR_STORAGE_KEY)).toBe('true');
    });
});
