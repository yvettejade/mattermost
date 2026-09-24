// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as rhsActions from 'actions/views/rhs';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {RHSStates} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ChannelInfoButton from './channel_info_button';

describe('components/ChannelHeader/ChannelInfoButton', () => {
    const channel = TestHelper.getChannelMock({id: 'channel_id'});

    beforeEach(() => {
        jest.spyOn(rhsActions, 'showChannelInfo').mockReturnValue(() => ({data: true}));
        jest.spyOn(rhsActions, 'closeRightHandSide').mockReturnValue(() => ({data: true}));
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('renders the header info button', () => {
        const {container} = renderWithContext(
            <ChannelInfoButton channel={channel}/>,
        );

        expect(container.querySelector('#channel-info-btn')).toBeInTheDocument();
    });

    test('opens channel info when inactive', async () => {
        renderWithContext(
            <ChannelInfoButton channel={channel}/>,
        );

        await userEvent.click(screen.getByRole('button'));
        expect(rhsActions.showChannelInfo).toHaveBeenCalledWith(channel.id);
    });

    test.each([
        RHSStates.CHANNEL_INFO,
        RHSStates.CHANNEL_MEMBERS,
        RHSStates.CHANNEL_FILES,
        RHSStates.PIN,
        RHSStates.CHANNEL_BOOKMARKS,
    ])('closes the RHS when %s is open', async (rhsState) => {
        renderWithContext(
            <ChannelInfoButton channel={channel}/>,
            {
                views: {
                    rhs: {
                        rhsState,
                        isSidebarOpen: true,
                    },
                },
            },
        );

        await userEvent.click(screen.getByRole('button'));
        expect(rhsActions.closeRightHandSide).toHaveBeenCalled();
        expect(rhsActions.showChannelInfo).not.toHaveBeenCalled();
    });
});
