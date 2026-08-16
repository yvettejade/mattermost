// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import MessageTemplates from './message_templates';

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

describe('components/message_templates/MessageTemplates', () => {
    beforeEach(() => {
        mockSelectLhsItem.mockClear();
    });

    test('renders the templates list', () => {
        renderWithContext(<MessageTemplates/>);

        expect(screen.getByRole('heading', {name: 'Templates'})).toBeVisible();
        expect(screen.getByText('Weekly status update')).toBeVisible();
        expect(screen.getByText('Meeting notes')).toBeVisible();
        expect(screen.getByText('Incident update')).toBeVisible();
        expect(mockSelectLhsItem).toHaveBeenCalledWith(LhsItemType.Page, LhsPage.Drafts);
    });
});
