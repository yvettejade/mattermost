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
        jest.spyOn(rhsActions, 'closeRightHandSide').mockReturnValue(() => ({data: true}));
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

        expect(screen.getByText('View Info')).toBeInTheDocument();
        expect(screen.queryByText('Close Info')).not.toBeInTheDocument();

        await userEvent.click(screen.getByText('View Info'));
        expect(rhsActions.showChannelInfo).toHaveBeenCalledWith(channel.id);
    });

    test('renders Close Info and closes the RHS when info is already open', async () => {
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

        expect(screen.getByText('Close Info')).toBeInTheDocument();

        await userEvent.click(screen.getByText('Close Info'));
        expect(rhsActions.closeRightHandSide).toHaveBeenCalled();
    });

    test('treats members RHS as info-active and closes on click', async () => {
        renderWithContext(
            <WithTestMenuContext>
                <ToggleInfo channel={channel}/>
            </WithTestMenuContext>,
            {
                views: {
                    rhs: {
                        rhsState: RHSStates.CHANNEL_MEMBERS,
                        isSidebarOpen: true,
                    },
                },
            },
        );

        expect(screen.getByText('Close Info')).toBeInTheDocument();

        await userEvent.click(screen.getByText('Close Info'));
        expect(rhsActions.closeRightHandSide).toHaveBeenCalled();
    });
});
