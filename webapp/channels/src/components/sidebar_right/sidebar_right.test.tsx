// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import SidebarRight from './sidebar_right';
import type {Props} from './sidebar_right';

jest.mock('components/channel_info_rhs', () => () => <div data-testid='channel-info-rhs'/>);
jest.mock('components/channel_members_rhs', () => () => <div data-testid='channel-members-rhs'/>);
jest.mock('components/search/index', () => ({children}: {children: React.ReactNode}) => <div data-testid='search'>{children}</div>);
jest.mock('components/resizable_sidebar/resizable_rhs', () => ({children}: {children: React.ReactNode}) => <div>{children}</div>);

describe('components/sidebar_right/SidebarRight', () => {
    const channel = TestHelper.getChannelMock({id: 'channel1', display_name: 'Channel One'});
    const otherChannel = TestHelper.getChannelMock({id: 'channel2', display_name: 'Channel Two'});
    const team = TestHelper.getTeamMock({id: 'team1'});

    const getBaseProps = (): Props => ({
        isExpanded: false,
        isOpen: true,
        channel,
        team,
        teamId: team.id,
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
    });

    test('should render the channel info pane for the channel info view', () => {
        renderWithContext(<SidebarRight {...getBaseProps()}/>);

        expect(screen.getByTestId('channel-info-rhs')).toBeInTheDocument();
        expect(screen.queryByTestId('channel-members-rhs')).not.toBeInTheDocument();
    });

    test('should not render the channel info pane for other views', () => {
        renderWithContext(
            <SidebarRight
                {...getBaseProps()}
                isChannelInfo={false}
                isChannelMembers={true}
            />,
        );

        expect(screen.queryByTestId('channel-info-rhs')).not.toBeInTheDocument();
        expect(screen.getByTestId('channel-members-rhs')).toBeInTheDocument();
    });

    test('should not render anything when closed', () => {
        renderWithContext(
            <SidebarRight
                {...getBaseProps()}
                isOpen={false}
            />,
        );

        expect(screen.queryByTestId('channel-info-rhs')).not.toBeInTheDocument();
    });

    test('should show a loading screen instead of the pane until the channel is available', () => {
        renderWithContext(
            <SidebarRight
                {...getBaseProps()}
                channel={undefined}
            />,
        );

        expect(screen.queryByTestId('channel-info-rhs')).not.toBeInTheDocument();
    });

    test('should not close the RHS when channel info is shown', () => {
        const props = getBaseProps();
        const {rerender} = renderWithContext(<SidebarRight {...props}/>);

        rerender(
            <SidebarRight
                {...props}
                isExpanded={true}
            />,
        );

        expect(props.actions.closeRightHandSide).not.toHaveBeenCalled();
        expect(screen.getByTestId('channel-info-rhs')).toBeInTheDocument();
    });

    test('should show the info of the new channel when the current channel changes', () => {
        const props = getBaseProps();
        const {rerender} = renderWithContext(<SidebarRight {...props}/>);

        expect(props.actions.showChannelInfo).not.toHaveBeenCalled();

        rerender(
            <SidebarRight
                {...props}
                channel={otherChannel}
            />,
        );

        expect(props.actions.showChannelInfo).toHaveBeenCalledTimes(1);
        expect(props.actions.showChannelInfo).toHaveBeenCalledWith(otherChannel.id);
    });

    test('should not show channel info again once the pane has followed the channel', () => {
        const props = getBaseProps();
        const {rerender} = renderWithContext(<SidebarRight {...props}/>);

        rerender(
            <SidebarRight
                {...props}
                channel={otherChannel}
            />,
        );
        rerender(
            <SidebarRight
                {...props}
                channel={otherChannel}
                rhsChannel={otherChannel}
            />,
        );

        expect(props.actions.showChannelInfo).toHaveBeenCalledTimes(1);
    });

    test('should not change the RHS channel when another view is open', () => {
        const props = {...getBaseProps(), isChannelInfo: false, isChannelMembers: true};
        const {rerender} = renderWithContext(<SidebarRight {...props}/>);

        rerender(
            <SidebarRight
                {...props}
                channel={otherChannel}
            />,
        );

        expect(props.actions.showChannelInfo).not.toHaveBeenCalled();
    });
});
