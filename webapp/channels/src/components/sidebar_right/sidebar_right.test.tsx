// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
import {Constants} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import SidebarRight from './sidebar_right';

jest.mock('components/channel_info_rhs', () => ({
    __esModule: true,
    default: () => <div data-testid='channel-info-rhs'>{'Channel Info RHS'}</div>,
}));

jest.mock('components/channel_bookmarks_rhs', () => ({
    __esModule: true,
    default: () => <div data-testid='channel-bookmarks-rhs'>{'Channel Bookmarks RHS'}</div>,
}));

jest.mock('components/channel_members_rhs', () => ({
    __esModule: true,
    default: () => <div data-testid='channel-members-rhs'>{'Channel Members RHS'}</div>,
}));

jest.mock('components/search/index', () => ({
    __esModule: true,
    default: ({children}: {children?: React.ReactNode}) => <div data-testid='rhs-search'>{children}</div>,
}));

jest.mock('components/resizable_sidebar/resizable_rhs', () => ({
    __esModule: true,
    default: ({children}: {children?: React.ReactNode}) => <div>{children}</div>,
}));

describe('components/sidebar_right', () => {
    const channel = TestHelper.getChannelMock({id: 'channel_id'});
    const team = TestHelper.getTeamMock({id: 'team_id'});

    const baseProps = {
        isExpanded: false,
        isOpen: true,
        channel,
        team,
        teamId: team.id,
        productId: null,
        postRightVisible: false,
        postCardVisible: false,
        searchVisible: false,
        isPinnedPosts: false,
        isChannelFiles: false,
        isChannelInfo: false,
        isChannelMembers: false,
        isChannelBookmarks: false,
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
            showChannelBookmarks: jest.fn(),
        },
    };

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('mounts Channel Info RHS when CHANNEL_INFO is active', () => {
        const {getByTestId} = renderWithContext(
            <SidebarRight
                {...baseProps}
                isChannelInfo={true}
            />,
        );

        expect(getByTestId('channel-info-rhs')).toBeInTheDocument();
    });

    test('mounts Channel Bookmarks RHS when CHANNEL_BOOKMARKS is active', () => {
        const {getByTestId} = renderWithContext(
            <SidebarRight
                {...baseProps}
                isChannelBookmarks={true}
            />,
        );

        expect(getByTestId('channel-bookmarks-rhs')).toBeInTheDocument();
    });

    test('does not auto-close when Channel Info is open', () => {
        renderWithContext(
            <SidebarRight
                {...baseProps}
                isChannelInfo={true}
            />,
        );

        expect(baseProps.actions.closeRightHandSide).not.toHaveBeenCalled();
    });

    test('toggles Channel Info with Ctrl/Cmd+Alt+I', () => {
        renderWithContext(
            <SidebarRight
                {...baseProps}
                isOpen={false}
            />,
        );

        const event = new KeyboardEvent('keydown', {
            key: 'i',
            keyCode: Constants.KeyCodes.I[1],
            ctrlKey: true,
            altKey: true,
            bubbles: true,
        });
        document.dispatchEvent(event);

        expect(baseProps.actions.showChannelInfo).toHaveBeenCalledWith(channel.id);
    });

    test('closes Channel Info with Ctrl/Cmd+Alt+I when info is already open', () => {
        renderWithContext(
            <SidebarRight
                {...baseProps}
                isChannelInfo={true}
            />,
        );

        const event = new KeyboardEvent('keydown', {
            key: 'i',
            keyCode: Constants.KeyCodes.I[1],
            ctrlKey: true,
            altKey: true,
            bubbles: true,
        });
        document.dispatchEvent(event);

        expect(baseProps.actions.closeRightHandSide).toHaveBeenCalled();
    });
});
