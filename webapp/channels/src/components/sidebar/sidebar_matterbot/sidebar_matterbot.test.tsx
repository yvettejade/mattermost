// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {RHSStates} from 'utils/constants';

import SidebarMatterBot from './sidebar_matterbot';

describe('components/sidebar/sidebar_matterbot', () => {
    test('opens the assistant chat from the direct messages list', async () => {
        const {store} = renderWithContext(
            <SidebarMatterBot collapsed={false}/>,
        );

        const row = screen.getByRole('button', {name: 'MatterBot'});
        expect(row.querySelector('.icon-robot-happy')).not.toBeNull();
        expect(row.closest('#sidebarItem_matterbot')).not.toBeNull();

        await userEvent.click(row);
        expect(store.getState().views.rhs.rhsState).toBe(RHSStates.ASSISTANT);

        await userEvent.click(row);
        expect(store.getState().views.rhs.rhsState).toBeNull();
    });
});
