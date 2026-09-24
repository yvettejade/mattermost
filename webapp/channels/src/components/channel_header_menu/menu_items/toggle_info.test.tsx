// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as rhsActions from 'actions/views/rhs';

import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {RHSStates} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ToggleInfo from './toggle_info';

describe('components/ChannelHeaderMenu/MenuItems/ToggleInfo', () => {
    const channel = TestHelper.getChannelMock();

    beforeEach(() => {
        jest.spyOn(rhsActions, 'showChannelInfo').mockReturnValue(() => ({data: true}));
        jest.spyOn(rhsActions, 'closeRightHandSide').mockImplementation(() => () => ({data: true}));
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('renders View Info and opens channel info on click', async () => {
        renderWithContext(
            <WithTestMenuContext>
                <ToggleInfo channel={channel}/>
            </WithTestMenuContext>,
        );

        const menuItem = screen.getByText('View Info');
        expect(menuItem).toBeInTheDocument();
        expect(screen.queryByText('Close Info')).not.toBeInTheDocument();

        await userEvent.click(menuItem);
        expect(rhsActions.showChannelInfo).toHaveBeenCalledWith(channel.id);
    });

    test('renders Close Info while the Info family is open', async () => {
        renderWithContext(
            <WithTestMenuContext>
                <ToggleInfo channel={channel}/>
            </WithTestMenuContext>,
            {
                views: {
                    rhs: {
                        rhsState: RHSStates.CHANNEL_INFO,
                        isSidebarOpen: true,
                    },
                },
            },
        );

        const menuItem = screen.getByText('Close Info');
        expect(menuItem).toBeInTheDocument();

        await userEvent.click(menuItem);
        expect(rhsActions.closeRightHandSide).toHaveBeenCalled();
    });
});
