// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';
import type {UserCustomStatus} from '@mattermost/types/users';

import EditChannelHeaderModal from 'components/edit_channel_header_modal';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import Constants, {ModalIdentifiers, RHSStates} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ChannelHeader from './channel_header';

describe('components/ChannelHeader', () => {
    const baseProps = {
        actions: {
            showPinnedPosts: jest.fn(),
            showChannelFiles: jest.fn(),
            closeRightHandSide: jest.fn(),
            getCustomEmojisInText: jest.fn(),
            updateChannelNotifyProps: jest.fn(),
            showChannelMembers: jest.fn(),
            fetchChannelRemotes: jest.fn(),
            openModal: jest.fn(),
        },
        team: TestHelper.getTeamMock({id: 'team_id'}),
        channel: TestHelper.getChannelMock({}),
        channelMember: TestHelper.getChannelMembershipMock({}),
        currentUser: TestHelper.getUserMock({}),
        isCustomStatusEnabled: false,
        isCustomStatusExpired: false,
        isFileAttachmentsEnabled: true,
        lastActivityTimestamp: 1632146562846,
        isLastActiveEnabled: true,
        memberCount: 2,
        dmUser: undefined,
        gmMembers: undefined,
        rhsState: RHSStates.CHANNEL_INFO,
        isChannelMuted: false,
        hasGuests: false,
        pinnedPostsCount: 0,
        customStatus: undefined,
        timestampUnits: [
            'now',
            'minute',
            'hour',
        ],
        hideGuestTags: false,
        remoteNames: [],
        sharedChannelsPluginsEnabled: false,
        isChannelAutotranslated: false,
        canEditChannelHeader: false,
    };

    const populatedProps = {
        ...baseProps,
        channel: TestHelper.getChannelMock({
            id: 'channel_id',
            team_id: 'team_id',
            name: 'Test',
            delete_at: 0,
        }),
        channelMember: TestHelper.getChannelMembershipMock({
            channel_id: 'channel_id',
            user_id: 'user_id',
        }),
        currentUser: TestHelper.getUserMock({
            id: 'user_id',
            bot_description: 'the bot description',
        }),
    };

    test('should render properly when empty', () => {
        const {container} = renderWithContext(
            <ChannelHeader {...baseProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render properly when populated', () => {
        const {container} = renderWithContext(
            <ChannelHeader {...populatedProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render properly when populated with channel props', () => {
        const props = {
            ...baseProps,
            channel: TestHelper.getChannelMock({
                id: 'channel_id',
                team_id: 'team_id',
                name: 'Test',
                header: 'See ~test',
                props: {
                    channel_mentions: {
                        test: {
                            display_name: 'Test',
                        },
                    },
                },
            }),
            channelMember: TestHelper.getChannelMembershipMock({
                channel_id: 'channel_id',
                user_id: 'user_id',
            }),
            currentUser: TestHelper.getUserMock({
                id: 'user_id',
            }),
        };

        const {container} = renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render archived view', () => {
        const props = {
            ...populatedProps,
            channel: {...populatedProps.channel, delete_at: 1234},
        };

        const {container} = renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render shared view', () => {
        const props = {
            ...populatedProps,
            channel: TestHelper.getChannelMock({
                ...populatedProps.channel,
                shared: true,
                type: Constants.OPEN_CHANNEL as ChannelType,
            }),
        };

        const {container} = renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render correct menu when muted', () => {
        const props = {
            ...populatedProps,
            isChannelMuted: true,
        };

        const {container} = renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should unmute the channel when mute icon is clicked', () => {
        const props = {
            ...populatedProps,
            isChannelMuted: true,
        };

        const {container} = renderWithContext(
            <ChannelHeader {...props}/>,
        );

        const muteButton = container.querySelector('.channel-header__mute');
        expect(muteButton).not.toBeNull();
        (muteButton as HTMLElement).click();
        expect(props.actions.updateChannelNotifyProps).toHaveBeenCalledTimes(1);
        expect(props.actions.updateChannelNotifyProps).toHaveBeenCalledWith('user_id', 'channel_id', {mark_unread: 'all'});
    });

    test('should render active pinned posts', () => {
        const props = {
            ...populatedProps,
            rhsState: RHSStates.PIN,
        };

        const {container} = renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render active channel files', () => {
        const props = {
            ...populatedProps,
            rhsState: RHSStates.CHANNEL_FILES,
            showChannelFilesButton: true,
        };

        const {container} = renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render not active channel files', () => {
        const props = {
            ...populatedProps,
            rhsState: RHSStates.PIN,
            showChannelFilesButton: true,
        };

        const {container} = renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render active flagged posts', () => {
        const props = {
            ...populatedProps,
            rhsState: RHSStates.FLAG,
        };

        const {container} = renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render active mentions posts', () => {
        const props = {
            ...populatedProps,
            rhsState: RHSStates.MENTION,
        };

        const {container} = renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render the pinned icon with the pinned posts count', () => {
        const props = {
            ...populatedProps,
            pinnedPostsCount: 2,
        };
        const {container} = renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render properly when custom status is set', () => {
        const props = {
            ...populatedProps,
            channel: TestHelper.getChannelMock({
                header: 'not the bot description',
                type: Constants.DM_CHANNEL as ChannelType,
                status: 'offline',
            }),
            dmUser: TestHelper.getUserMock({
                id: 'user_id',
                is_bot: false,
            }),
            isCustomStatusEnabled: true,
            customStatus: {
                emoji: 'calender',
                text: 'In a meeting',
            } as UserCustomStatus,
        };

        const {container} = renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render properly when custom status is expired', () => {
        const props = {
            ...populatedProps,
            channel: TestHelper.getChannelMock({
                header: 'not the bot description',
                type: Constants.DM_CHANNEL as ChannelType,
                status: 'offline',
            }),
            dmUser: TestHelper.getUserMock({
                id: 'user_id',
                is_bot: false,
            }),
            isCustomStatusEnabled: true,
            isCustomStatusExpired: true,
            customStatus: {
                emoji: 'calender',
                text: 'In a meeting',
            } as UserCustomStatus,
        };

        const {container} = renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should contain the channel info button', () => {
        const {container} = renderWithContext(
            <ChannelHeader {...populatedProps}/>,
        );

        const channelInfo = container.querySelector('.channel-header__info');
        expect(channelInfo).not.toBeNull();
        expect(container.querySelector('#channel-info-btn')).toBeNull();
    });

    test('should match snapshot with last active display', () => {
        const props = {
            ...populatedProps,
            channel: TestHelper.getChannelMock({
                header: 'not the bot description',
                type: Constants.DM_CHANNEL as ChannelType,
                status: 'offline',
            }),
            dmUser: TestHelper.getUserMock({
                id: 'user_id',
                is_bot: false,
                props: {
                    show_last_active: 'true',
                },
            }),
        };

        const {container} = renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with no last active display because it is disabled', () => {
        const props = {
            ...populatedProps,
            isLastActiveEnabled: false,
            channel: TestHelper.getChannelMock({
                header: 'not the bot description',
                type: Constants.DM_CHANNEL as ChannelType,
                status: 'offline',
            }),
            dmUser: TestHelper.getUserMock({
                id: 'user_id',
                is_bot: false,
                props: {
                    show_last_active: 'false',
                },
            }),
        };

        const {container} = renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should not render the edit channel header button without permission', () => {
        const {container} = renderWithContext(
            <ChannelHeader {...populatedProps}/>,
        );

        expect(container.querySelector('#channelHeaderEditButton')).not.toBeInTheDocument();
    });

    test('should render the edit channel header button to the right of channel files', () => {
        const props = {
            ...populatedProps,
            canEditChannelHeader: true,
        };

        const {container} = renderWithContext(
            <ChannelHeader {...props}/>,
        );

        const buttons = Array.from(container.querySelectorAll('.channel-header__icons button'));
        const ids = buttons.map((button) => button.id);
        expect(ids.indexOf('channelHeaderEditButton')).toBeGreaterThan(ids.indexOf('channelHeaderFilesButton'));
    });

    test('should render the edit channel header button when channel files are hidden', () => {
        const props = {
            ...populatedProps,
            canEditChannelHeader: true,
            isFileAttachmentsEnabled: false,
        };

        const {container} = renderWithContext(
            <ChannelHeader {...props}/>,
        );

        expect(container.querySelector('#channelHeaderFilesButton')).not.toBeInTheDocument();
        expect(container.querySelector('#channelHeaderEditButton')).toBeInTheDocument();
    });

    test('should open the edit channel header modal when the pencil button is clicked', async () => {
        const openModal = jest.fn();
        const props = {
            ...populatedProps,
            canEditChannelHeader: true,
            actions: {
                ...populatedProps.actions,
                openModal,
            },
        };

        renderWithContext(
            <ChannelHeader {...props}/>,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Edit channel header'}));

        expect(openModal).toHaveBeenCalledTimes(1);
        expect(openModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
            dialogType: EditChannelHeaderModal,
            dialogProps: {channel: props.channel},
        });
    });
});
