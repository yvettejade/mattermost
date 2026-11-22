// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {Props} from './sidebar_right';
import SidebarRight from './sidebar_right';

jest.mock('components/channel_info_rhs', () => ({
    __esModule: true,
    default: () => <div data-testid='channel-info-rhs'/>,
}));

jest.mock('components/channel_members_rhs', () => ({
    __esModule: true,
    default: () => <div data-testid='channel-members-rhs'/>,
}));

jest.mock('components/search/index', () => ({
    __esModule: true,
    default: ({children}: {children: React.ReactNode}) => <div data-testid='search'>{children}</div>,
}));

jest.mock('components/resizable_sidebar/resizable_rhs', () => ({
    __esModule: true,
    default: ({children}: {children: React.ReactNode}) => <div>{children}</div>,
}));

jest.mock('components/file_upload_overlay', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('components/rhs_thread', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('components/rhs_card', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('components/post_edit_history', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('plugins/rhs_plugin', () => ({
    __esModule: true,
    default: () => null,
}));

describe('components/sidebar_right', () => {
    const channel = TestHelper.getChannelMock({id: 'channel_id', team_id: 'team_id'});
    const otherChannel = TestHelper.getChannelMock({id: 'other_channel_id', team_id: 'team_id'});
    const team = TestHelper.getTeamMock({id: 'team_id'});

    const baseProps: Props = {
        isExpanded: false,
        isOpen: true,
        channel,
        team,
        teamId: 'team_id',
        productId: 'channels',
        postRightVisible: false,
        postCardVisible: false,
        searchVisible: true,
        isPinnedPosts: false,
        isChannelFiles: false,
        isChannelInfo: true,
        isChannelMembers: false,
        isPluginView: false,
        isPostEditHistory: false,
        previousRhsState: null,
        rhsChannel: channel,
        selectedPostId: '',
        selectedPostCardId: '',
        actions: {
            setRhsExpanded: jest.fn(),
            showPinnedPosts: jest.fn(),
            openRHSSearch: jest.fn(),
            closeRightHandSide: jest.fn(),
            openAtPrevious: jest.fn(),
            updateSearchTerms: jest.fn(),
            showChannelFiles: jest.fn(),
            showChannelInfo: jest.fn(),
        },
    };

    beforeEach(() => {
        Object.values(baseProps.actions).forEach((action) => (action as jest.Mock).mockClear());
    });

    test('renders the channel info pane when the RHS state is channel info', () => {
        renderWithContext(<SidebarRight {...baseProps}/>);

        expect(screen.getByTestId('channel-info-rhs')).toBeInTheDocument();
        expect(screen.queryByTestId('channel-members-rhs')).not.toBeInTheDocument();
    });

    test('does not close the RHS when channel info is shown', () => {
        const {rerender} = renderWithContext(<SidebarRight {...baseProps}/>);
        rerender(<SidebarRight {...baseProps}/>);

        expect(baseProps.actions.closeRightHandSide).not.toHaveBeenCalled();
    });

    test('does not render the channel info pane for other RHS states', () => {
        renderWithContext(
            <SidebarRight
                {...baseProps}
                isChannelInfo={false}
                isChannelMembers={true}
            />,
        );

        expect(screen.queryByTestId('channel-info-rhs')).not.toBeInTheDocument();
        expect(screen.getByTestId('channel-members-rhs')).toBeInTheDocument();
    });

    test('syncs the selected channel when the current channel changes while channel info is open', () => {
        const {rerender} = renderWithContext(<SidebarRight {...baseProps}/>);

        expect(baseProps.actions.showChannelInfo).not.toHaveBeenCalled();

        rerender(
            <SidebarRight
                {...baseProps}
                channel={otherChannel}
            />,
        );

        expect(baseProps.actions.showChannelInfo).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.showChannelInfo).toHaveBeenCalledWith('other_channel_id');
    });

    test('does not sync the selected channel when channel info is not the active view', () => {
        const {rerender} = renderWithContext(
            <SidebarRight
                {...baseProps}
                isChannelInfo={false}
                isChannelMembers={true}
            />,
        );

        rerender(
            <SidebarRight
                {...baseProps}
                isChannelInfo={false}
                isChannelMembers={true}
                channel={otherChannel}
            />,
        );

        expect(baseProps.actions.showChannelInfo).not.toHaveBeenCalled();
    });
});
