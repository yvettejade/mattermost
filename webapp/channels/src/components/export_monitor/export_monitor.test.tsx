// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import {resetExportConnectorForTests, setExportConnectorEnabled} from './export_connector';
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
        resetExportConnectorForTests();
    });

    afterEach(() => {
        resetExportConnectorForTests();
    });

    test('shows payloads when the export connector is on', () => {
        renderWithContext(<ExportMonitor/>);

        expect(screen.getByRole('heading', {name: 'Export monitor'})).toBeVisible();
        expect(screen.getByTestId('export-monitor-status')).toHaveTextContent('Export connector is on');
        expect(screen.getByTestId('export-monitor-payloads')).toBeVisible();
        expect(screen.getByText('On-call overtime for last night is approved.')).toBeVisible();
        expect(screen.getByText('Travel for the Monday planning session is approved.')).toBeVisible();
        expect(screen.queryByTestId('export-monitor-empty')).not.toBeInTheDocument();
        expect(mockSelectLhsItem).toHaveBeenCalledWith(LhsItemType.Page, LhsPage.Drafts);
    });

    test('shows zero payloads when the export connector is off', () => {
        setExportConnectorEnabled(false);

        renderWithContext(<ExportMonitor/>);

        expect(screen.getByTestId('export-monitor-status')).toHaveTextContent('Export connector is off');
        expect(screen.getByTestId('export-monitor-empty')).toBeVisible();
        expect(screen.queryByTestId('export-monitor-payloads')).not.toBeInTheDocument();
    });

    test('Turn on restores payloads', async () => {
        setExportConnectorEnabled(false);

        renderWithContext(<ExportMonitor/>);

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', {name: 'Turn on'}));

        expect(screen.getByTestId('export-monitor-status')).toHaveTextContent('Export connector is on');
        expect(screen.getByTestId('export-monitor-payloads')).toBeVisible();
        expect(screen.getByText('On-call overtime for last night is approved.')).toBeVisible();
    });
});
