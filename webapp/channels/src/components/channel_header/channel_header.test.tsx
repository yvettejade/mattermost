// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';
import type {UserCustomStatus} from '@mattermost/types/users';

import {renderWithContext, screen} from 'tests/react_testing_utils';
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

    test('renders Add a channel header only for an empty editable channel', () => {
        const openModal = jest.fn();
        const props = {
            ...populatedProps,
            canEditChannelHeader: true,
            actions: {
                ...populatedProps.actions,
                openModal,
            },
            channel: TestHelper.getChannelMock({
                id: 'channel_id',
                team_id: 'team_id',
                header: '   ',
                delete_at: 0,
                type: Constants.OPEN_CHANNEL as ChannelType,
            }),
        };

        const {container} = renderWithContext(<ChannelHeader {...props}/>);

        const description = container.querySelector('#channelHeaderDescription');
        const button = screen.getByRole('button', {name: 'Add a channel header'});
        expect(button).toHaveClass('header-placeholder');
        expect(button).toHaveAttribute('type', 'button');
        expect(description).toContainElement(button);
        expect(description?.querySelector('.header-description__text')).toBeNull();
        expect(button.querySelector('.icon')).not.toBeNull();

        button.click();
        expect(openModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
            dialogType: expect.any(Function),
            dialogProps: {channel: props.channel},
        });
    });

    test('omits the header placeholder when a header is set, the channel is archived, the DM is a bot, or the viewer cannot edit', () => {
        const withHeader = {
            ...populatedProps,
            canEditChannelHeader: true,
            channel: TestHelper.getChannelMock({
                id: 'channel_id',
                header: 'Already set',
                delete_at: 0,
                type: Constants.OPEN_CHANNEL as ChannelType,
            }),
        };
        const {rerender} = renderWithContext(<ChannelHeader {...withHeader}/>);
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
        expect(screen.getByText('Already set')).toBeInTheDocument();

        rerender(
            <ChannelHeader
                {...populatedProps}
                canEditChannelHeader={true}
                channel={TestHelper.getChannelMock({
                    id: 'channel_id',
                    header: '',
                    delete_at: 1234,
                    type: Constants.OPEN_CHANNEL as ChannelType,
                })}
            />,
        );
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();

        rerender(
            <ChannelHeader
                {...populatedProps}
                canEditChannelHeader={true}
                channel={TestHelper.getChannelMock({
                    id: 'channel_id',
                    header: '',
                    delete_at: 0,
                    type: Constants.DM_CHANNEL as ChannelType,
                })}
                dmUser={TestHelper.getUserMock({id: 'bot_id', is_bot: true, bot_description: 'I am a bot'})}
            />,
        );
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();

        rerender(
            <ChannelHeader
                {...populatedProps}
                canEditChannelHeader={false}
                channel={TestHelper.getChannelMock({
                    id: 'channel_id',
                    header: '',
                    delete_at: 0,
                    type: Constants.OPEN_CHANNEL as ChannelType,
                })}
            />,
        );
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();

        rerender(
            <ChannelHeader
                {...populatedProps}
                canEditChannelHeader={false}
                channel={TestHelper.getChannelMock({
                    id: 'channel_id',
                    header: '',
                    delete_at: 0,
                    type: Constants.PRIVATE_CHANNEL as ChannelType,
                })}
            />,
        );
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('renders the header placeholder for an empty direct or group message the viewer can edit', () => {
        const {rerender} = renderWithContext(
            <ChannelHeader
                {...populatedProps}
                canEditChannelHeader={true}
                channel={TestHelper.getChannelMock({
                    id: 'channel_id',
                    header: '',
                    delete_at: 0,
                    type: Constants.DM_CHANNEL as ChannelType,
                })}
                dmUser={TestHelper.getUserMock({id: 'user_id', is_bot: false})}
            />,
        );
        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();

        rerender(
            <ChannelHeader
                {...populatedProps}
                canEditChannelHeader={true}
                channel={TestHelper.getChannelMock({
                    id: 'channel_id',
                    header: '',
                    delete_at: 0,
                    type: Constants.GM_CHANNEL as ChannelType,
                })}
            />,
        );
        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
    });
});
