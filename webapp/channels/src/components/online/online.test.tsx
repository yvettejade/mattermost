// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import Online from './online';
import {CSV_HEADER} from './store';

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

function renderOnline(pathname = '/team1/online/accounts/everyday') {
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
    });

    test('shows YouMoney Everyday activity with signed amounts', () => {
        renderOnline();

        expect(screen.getByRole('heading', {name: 'Everyday money'})).toBeVisible();
        expect(screen.getByRole('heading', {name: 'YouMoney Everyday'})).toBeVisible();
        expect(screen.getByTestId('online-activity')).toHaveTextContent('Weekly shop');
        expect(screen.getByTestId('online-activity')).toHaveTextContent('-186.40');
        expect(mockSelectLhsItem).toHaveBeenCalledWith(LhsItemType.Page, LhsPage.Drafts);
    });

    test('export stays disabled when filters match nothing', async () => {
        renderOnline();

        const user = userEvent.setup();
        await user.type(screen.getByRole('searchbox', {name: 'Search transactions'}), 'no-such-merchant');

        expect(screen.getByText('There is nothing to export.')).toBeVisible();
        expect(screen.getByRole('button', {name: 'Export CSV'})).toBeDisabled();
    });

    test('exports only the filtered rows as CSV', async () => {
        const createObjectURL = jest.fn(() => 'blob:online-export');
        const revokeObjectURL = jest.fn();
        Object.defineProperty(URL, 'createObjectURL', {configurable: true, value: createObjectURL});
        Object.defineProperty(URL, 'revokeObjectURL', {configurable: true, value: revokeObjectURL});
        const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
        const created: HTMLAnchorElement[] = [];
        const originalCreateElement = document.createElement.bind(document);
        const createElement = jest.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) => {
            const element = originalCreateElement(tagName, options);
            if (tagName === 'a') {
                created.push(element as HTMLAnchorElement);
            }
            return element;
        });

        renderOnline();

        const user = userEvent.setup();
        await user.selectOptions(screen.getByLabelText('Category'), 'Groceries');
        await user.click(screen.getByRole('button', {name: 'Export CSV'}));

        expect(createObjectURL).toHaveBeenCalled();
        const blob = createObjectURL.mock.calls[0][0] as Blob;
        expect(blob.type).toBe('text/csv');
        const csv = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsText(blob);
        });
        expect(csv).toContain(CSV_HEADER);
        expect(csv).toContain('Woolworths');
        expect(csv).toContain('-186.40');
        expect(csv).not.toContain('Salary');
        expect(created[0]?.download).toMatch(/^youmoney-everyday-\d{4}-\d{2}-\d{2}\.csv$/);

        click.mockRestore();
        createElement.mockRestore();
    });

    test('unknown accounts show an empty state', () => {
        renderOnline('/team1/online/accounts/credit-card');

        expect(screen.getByText('That account is not available.')).toBeVisible();
        expect(screen.queryByRole('button', {name: 'Export CSV'})).not.toBeInTheDocument();
    });
});
