// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel, ChannelStats} from '@mattermost/types/channels';

import {openModal} from 'actions/views/modals';
import {canAccessChannelSettings} from 'selectors/views/channel_settings';

import {
    act,
    renderWithContext,
    screen,
    userEvent,
    fireEvent,
} from 'tests/react_testing_utils';
import Constants, {ModalIdentifiers} from 'utils/constants';

jest.mock('selectors/views/channel_settings', () => ({
    canAccessChannelSettings: jest.fn(),
}));
jest.mock('actions/views/modals', () => ({
    openModal: jest.fn(() => ({type: 'OPEN_MODAL'})),
}));

import Menu from './menu';

const mockedCanAccessChannelSettings = canAccessChannelSettings as unknown as jest.Mock;
const mockedOpenModal = openModal as unknown as jest.Mock;

describe('channel_info_rhs/menu', () => {
    const defaultProps = {
        channel: {id: 'channel_id', type: Constants.OPEN_CHANNEL} as Channel,
        channelStats: {files_count: 3, pinnedpost_count: 12, member_count: 32} as ChannelStats,
        isArchived: false,
        actions: {
            openNotificationSettings: jest.fn(),
            showChannelFiles: jest.fn(),
            showPinnedPosts: jest.fn(),
            showChannelMembers: jest.fn(),
            showChannelBookmarks: jest.fn(),
            showChannelScheduledPosts: jest.fn(),
            getChannelStats: jest.fn().mockImplementation(() => Promise.resolve({data: {files_count: 3, pinnedpost_count: 12, member_count: 32}})),
        },
    };

    beforeEach(() => {
        mockedOpenModal.mockClear();
        mockedCanAccessChannelSettings.mockReset();
        defaultProps.actions = {
            openNotificationSettings: jest.fn(),
            showChannelFiles: jest.fn(),
            showPinnedPosts: jest.fn(),
            showChannelMembers: jest.fn(),
            showChannelBookmarks: jest.fn(),
            showChannelScheduledPosts: jest.fn(),
            getChannelStats: jest.fn().mockImplementation(() => Promise.resolve({data: {files_count: 3, pinnedpost_count: 12, member_count: 32}})),
        };
    });

    test('should display notifications preferences', async () => {
        const props = {...defaultProps};
        props.actions.openNotificationSettings = jest.fn();

        renderWithContext(
            <Menu
                {...props}
            />,
        );

        await act(async () => {
            props.actions.getChannelStats();
        });

        expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
        await userEvent.click(screen.getByText('Notification Preferences'));

        expect(props.actions.openNotificationSettings).toHaveBeenCalled();
    });

    test('should NOT display notifications preferences in a DM', async () => {
        const props = {
            ...defaultProps,
            channel: {type: Constants.DM_CHANNEL} as Channel,
        };

        renderWithContext(
            <Menu
                {...props}
            />,
        );

        await act(async () => {
            props.actions.getChannelStats();
        });

        expect(screen.queryByText('Notification Preferences')).not.toBeInTheDocument();
    });

    test('should NOT display notifications preferences in an archived channel', async () => {
        const props = {
            ...defaultProps,
            isArchived: true,
        };

        renderWithContext(
            <Menu
                {...props}
            />,
        );

        await act(async () => {
            props.actions.getChannelStats();
        });

        expect(screen.queryByText('Notification Preferences')).not.toBeInTheDocument();
    });

    test('should display the number of files', async () => {
        const props = {...defaultProps};
        props.actions.showChannelFiles = jest.fn();

        renderWithContext(
            <Menu
                {...props}
            />,
        );

        await act(async () => {
            props.actions.getChannelStats();
        });

        const fileItem = screen.getByText('Files');
        expect(fileItem).toBeInTheDocument();
        expect(fileItem.parentElement).toHaveTextContent('3');

        await userEvent.click(fileItem);
        expect(props.actions.showChannelFiles).toHaveBeenCalled();
    });

    test('should display the pinned messages', async () => {
        const props = {...defaultProps};
        props.actions.showPinnedPosts = jest.fn();

        renderWithContext(
            <Menu
                {...props}
            />,
        );

        await act(async () => {
            props.actions.getChannelStats();
        });

        const fileItem = screen.getByText('Pinned messages');
        expect(fileItem).toBeInTheDocument();
        expect(fileItem.parentElement).toHaveTextContent('12');

        await userEvent.click(fileItem);
        expect(props.actions.showPinnedPosts).toHaveBeenCalled();
    });

    test('should display members', async () => {
        const props = {...defaultProps};
        props.actions.showChannelMembers = jest.fn();

        renderWithContext(
            <Menu
                {...props}
            />,
        );

        await act(async () => {
            props.actions.getChannelStats();
        });

        const membersItem = screen.getByText('Members');
        expect(membersItem).toBeInTheDocument();
        expect(membersItem.parentElement).toHaveTextContent('32');

        await userEvent.click(membersItem);
        expect(props.actions.showChannelMembers).toHaveBeenCalled();
    });

    test('should NOT display members in DM', async () => {
        const props = {
            ...defaultProps,
            channel: {type: Constants.DM_CHANNEL} as Channel,
        };

        renderWithContext(
            <Menu
                {...props}
            />,
        );

        await act(async () => {
            props.actions.getChannelStats();
        });

        const membersItem = screen.queryByText('Members');
        expect(membersItem).not.toBeInTheDocument();
    });

    test('should display Channel Settings and open modal on click (non-DM/GM, not archived, permitted)', async () => {
        mockedCanAccessChannelSettings.mockReturnValue(true);
        const props = {...defaultProps};

        renderWithContext(
            <Menu
                {...props}
            />,
        );

        await act(async () => {
            props.actions.getChannelStats();
        });

        const settingsItem = screen.getByText('Channel Settings');
        expect(settingsItem).toBeInTheDocument();

        fireEvent.click(settingsItem);
        expect(mockedOpenModal).toHaveBeenCalledWith(
            expect.objectContaining({
                modalId: ModalIdentifiers.CHANNEL_SETTINGS,
            }),
        );
    });

    test('should NOT display Channel Settings in DM', async () => {
        mockedCanAccessChannelSettings.mockReturnValue(true);
        const props = {
            ...defaultProps,
            channel: {type: Constants.DM_CHANNEL} as Channel,
        };

        renderWithContext(
            <Menu
                {...props}
            />,
        );
        await act(async () => props.actions.getChannelStats());
        expect(screen.queryByText('Channel Settings')).not.toBeInTheDocument();
    });

    test('should NOT display Channel Settings in GM', async () => {
        mockedCanAccessChannelSettings.mockReturnValue(true);
        const props = {
            ...defaultProps,
            channel: {type: Constants.GM_CHANNEL} as Channel,
        };

        renderWithContext(
            <Menu
                {...props}
            />,
        );
        await act(async () => props.actions.getChannelStats());
        expect(screen.queryByText('Channel Settings')).not.toBeInTheDocument();
    });

    test('should NOT display Channel Settings when archived', async () => {
        mockedCanAccessChannelSettings.mockReturnValue(true);
        const props = {
            ...defaultProps,
            isArchived: true,
        };

        renderWithContext(
            <Menu
                {...props}
            />,
        );
        await act(async () => props.actions.getChannelStats());
        expect(screen.queryByText('Channel Settings')).not.toBeInTheDocument();
    });

    test('should NOT display Channel Settings without permission', async () => {
        mockedCanAccessChannelSettings.mockReturnValue(false);
        const props = {...defaultProps};

        renderWithContext(
            <Menu
                {...props}
            />,
        );
        await act(async () => props.actions.getChannelStats());
        expect(screen.queryByText('Channel Settings')).not.toBeInTheDocument();
    });

    test('should display unreads as 0 when there are none', async () => {
        renderWithContext(
            <Menu
                {...defaultProps}
            />,
            unreadState(0, 0),
        );

        await act(async () => {
            defaultProps.actions.getChannelStats();
        });

        const unreadsItem = screen.getByText('Unreads');
        expect(unreadsItem).toBeInTheDocument();
        expect(unreadsItem.parentElement).toHaveTextContent('0');
        expect(unreadsItem.parentElement?.querySelector('.icon-chevron-right')).not.toBeInTheDocument();
    });

    test('should display unread messages and mention count', async () => {
        renderWithContext(
            <Menu
                {...defaultProps}
            />,
            unreadState(5, 2),
        );

        await act(async () => {
            defaultProps.actions.getChannelStats();
        });

        const unreadsItem = screen.getByText('Unreads');
        expect(unreadsItem).toBeInTheDocument();
        expect(unreadsItem.parentElement).toHaveTextContent('5');
        expect(unreadsItem.parentElement).toHaveTextContent('2');
    });

    test('should hide Bookmarks when the feature is disabled', async () => {
        renderWithContext(
            <Menu
                {...defaultProps}
            />,
        );

        await act(async () => {
            defaultProps.actions.getChannelStats();
        });

        expect(screen.queryByText('Bookmarks')).not.toBeInTheDocument();
    });

    test('should display Bookmarks and open the sub-pane on click', async () => {
        const props = {...defaultProps};
        props.actions.showChannelBookmarks = jest.fn();

        renderWithContext(
            <Menu
                {...props}
            />,
            bookmarksEnabledState(2),
        );

        await act(async () => {
            props.actions.getChannelStats();
        });

        const bookmarksItem = screen.getByText('Bookmarks');
        expect(bookmarksItem).toBeInTheDocument();
        expect(bookmarksItem.parentElement).toHaveTextContent('2');

        await userEvent.click(bookmarksItem);
        expect(props.actions.showChannelBookmarks).toHaveBeenCalledWith('channel_id');
    });

    test('should hide Scheduled posts when the feature is disabled', async () => {
        renderWithContext(
            <Menu
                {...defaultProps}
            />,
        );

        await act(async () => {
            defaultProps.actions.getChannelStats();
        });

        expect(screen.queryByText('Scheduled posts')).not.toBeInTheDocument();
    });

    test('should display Scheduled posts and open the sub-pane on click', async () => {
        const props = {...defaultProps};
        props.actions.showChannelScheduledPosts = jest.fn();

        renderWithContext(
            <Menu
                {...props}
            />,
            scheduledPostsEnabledState(3),
        );

        await act(async () => {
            props.actions.getChannelStats();
        });

        const scheduledItem = screen.getByText('Scheduled posts');
        expect(scheduledItem).toBeInTheDocument();
        expect(scheduledItem.parentElement).toHaveTextContent('3');

        await userEvent.click(scheduledItem);
        expect(props.actions.showChannelScheduledPosts).toHaveBeenCalledWith('channel_id');
    });

    test('should include thread scheduled posts in the Scheduled posts badge', async () => {
        renderWithContext(
            <Menu
                {...defaultProps}
            />,
            scheduledPostsEnabledState(1, {includeThreadReply: true}),
        );

        await act(async () => {
            defaultProps.actions.getChannelStats();
        });

        const scheduledItem = screen.getByText('Scheduled posts');
        expect(scheduledItem.parentElement).toHaveTextContent('2');
    });
});

const CHANNEL_ID = 'channel_id';
const USER_ID = 'current_user_id';

function unreadState(messages: number, mentions: number) {
    return {
        entities: {
            users: {
                currentUserId: USER_ID,
            },
            channels: {
                currentChannelId: CHANNEL_ID,
                myMembers: {
                    [CHANNEL_ID]: {
                        channel_id: CHANNEL_ID,
                        user_id: USER_ID,
                        mention_count: mentions,
                        mention_count_root: mentions,
                        msg_count: 10,
                        msg_count_root: 10,
                        notify_props: {},
                    },
                },
                messageCounts: {
                    [CHANNEL_ID]: {
                        total: 10 + messages,
                        root: 10 + messages,
                    },
                },
            },
        },
    };
}

function bookmarksEnabledState(count: number) {
    const bookmarks = Array.from({length: count}, (_, index) => {
        const id = `bookmark_${index}`;
        return [id, {
            id,
            channel_id: CHANNEL_ID,
            owner_id: USER_ID,
            type: 'link',
            link_url: `https://example.com/${index}`,
            display_name: `Bookmark ${index}`,
            sort_order: index,
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        }];
    });

    return {
        entities: {
            general: {
                config: {
                    FeatureFlagChannelBookmarks: 'true',
                },
                license: {
                    IsLicensed: 'true',
                },
            },
            channelBookmarks: {
                byChannelId: {
                    [CHANNEL_ID]: Object.fromEntries(bookmarks),
                },
            },
        },
    };
}

function scheduledPostsEnabledState(count: number, options?: {includeThreadReply?: boolean}) {
    const ids = Array.from({length: count}, (_, index) => `scheduled_${index}`);
    const byId = Object.fromEntries(ids.map((id) => [id, {
        id,
        channel_id: CHANNEL_ID,
        user_id: USER_ID,
        root_id: '',
        message: id,
        scheduled_at: 1,
        create_at: 1,
        update_at: 1,
        props: {},
    }]));
    const byChannelOrThreadId: Record<string, string[]> = {
        [CHANNEL_ID]: ids,
    };

    if (options?.includeThreadReply) {
        byId.thread_reply = {
            id: 'thread_reply',
            channel_id: CHANNEL_ID,
            user_id: USER_ID,
            root_id: 'root_id',
            message: 'thread reply',
            scheduled_at: 1,
            create_at: 1,
            update_at: 1,
            props: {},
        };
        byChannelOrThreadId.root_id = ['thread_reply'];
    }

    return {
        entities: {
            general: {
                config: {
                    ScheduledPosts: 'true',
                },
                license: {
                    IsLicensed: 'true',
                },
            },
            scheduledPosts: {
                byId,
                byTeamId: {},
                errorsByTeamId: {},
                byChannelOrThreadId,
            },
        },
    };
}
