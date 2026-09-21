// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel, ChannelStats} from '@mattermost/types/channels';

import {scrollPostListToUnread} from 'actions/views/channel';
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
jest.mock('actions/views/channel', () => ({
    scrollPostListToUnread: jest.fn(() => ({type: 'SCROLL_POST_LIST_TO_UNREAD'})),
}));

import Menu from './menu';

const mockedCanAccessChannelSettings = canAccessChannelSettings as unknown as jest.Mock;
const mockedOpenModal = openModal as unknown as jest.Mock;
const mockedScrollPostListToUnread = scrollPostListToUnread as unknown as jest.Mock;

const enabledFeaturesState = {
    entities: {
        general: {
            config: {
                FeatureFlagChannelBookmarks: 'true',
                ScheduledPosts: 'true',
            },
            license: {
                IsLicensed: 'true',
            },
        },
        teams: {
            currentTeamId: 'team-id',
            teams: {
                'team-id': {id: 'team-id', name: 'team-slug'},
            },
        },
        channels: {
            messageCounts: {
                channel_id: {total: 10, root: 10},
            },
            myMembers: {
                channel_id: {
                    mention_count: 2,
                    mention_count_root: 2,
                    msg_count: 7,
                    msg_count_root: 7,
                    urgent_mention_count: 1,
                },
            },
        },
        channelBookmarks: {
            byChannelId: {
                channel_id: {
                    bm1: {id: 'bm1'},
                    bm2: {id: 'bm2'},
                },
            },
        },
        scheduledPosts: {
            byId: {
                sp1: {id: 'sp1'},
                sp2: {id: 'sp2', error_code: 'failed'},
            },
            byChannelOrThreadId: {
                channel_id: ['sp1', 'sp2'],
                thread_id: ['sp3'],
            },
        },
    },
};

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
            getChannelStats: jest.fn().mockImplementation(() => Promise.resolve({data: {files_count: 3, pinnedpost_count: 12, member_count: 32}})),
        },
    };

    beforeEach(() => {
        mockedOpenModal.mockClear();
        mockedCanAccessChannelSettings.mockReset();
        mockedScrollPostListToUnread.mockClear();
        defaultProps.actions = {
            openNotificationSettings: jest.fn(),
            showChannelFiles: jest.fn(),
            showPinnedPosts: jest.fn(),
            showChannelMembers: jest.fn(),
            showChannelBookmarks: jest.fn(),
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

    test('should show unreads at zero and jump without opening a new RHS', async () => {
        const props = {...defaultProps};

        renderWithContext(
            <Menu
                {...props}
            />,
        );
        await act(async () => props.actions.getChannelStats());

        const unreadsItem = screen.getByText('Unreads');
        expect(unreadsItem).toBeInTheDocument();
        expect(unreadsItem.parentElement).toHaveTextContent('0');

        await userEvent.click(unreadsItem);
        expect(mockedScrollPostListToUnread).toHaveBeenCalled();
        expect(props.actions.showChannelMembers).not.toHaveBeenCalled();
        expect(props.actions.showPinnedPosts).not.toHaveBeenCalled();
        expect(props.actions.showChannelFiles).not.toHaveBeenCalled();
        expect(props.actions.showChannelBookmarks).not.toHaveBeenCalled();
    });

    test('should show unread message count with mention as a secondary indicator', async () => {
        renderWithContext(
            <Menu
                {...defaultProps}
            />,
            enabledFeaturesState,
        );
        await act(async () => defaultProps.actions.getChannelStats());

        const unreadsItem = screen.getByText('Unreads');
        expect(unreadsItem.parentElement).toHaveTextContent('3');
        expect(unreadsItem.parentElement?.querySelector('.unreadMentions')).toHaveTextContent('2');
        expect(unreadsItem.parentElement?.querySelector('.badge.urgent')).toBeInTheDocument();
    });

    test('should show bookmarks including on DM when enabled, with a zero count', async () => {
        const props = {
            ...defaultProps,
            channel: {id: 'channel_id', type: Constants.DM_CHANNEL} as Channel,
        };

        renderWithContext(
            <Menu
                {...props}
            />,
            {
                ...enabledFeaturesState,
                entities: {
                    ...enabledFeaturesState.entities,
                    channelBookmarks: {
                        byChannelId: {},
                    },
                },
            },
        );
        await act(async () => props.actions.getChannelStats());

        const bookmarksItem = screen.getByText('Bookmarks');
        expect(bookmarksItem).toBeInTheDocument();
        expect(bookmarksItem.parentElement).toHaveTextContent('0');

        await userEvent.click(bookmarksItem);
        expect(props.actions.showChannelBookmarks).toHaveBeenCalledWith('channel_id');
    });

    test('should hide bookmarks when the feature is disabled', async () => {
        renderWithContext(
            <Menu
                {...defaultProps}
            />,
        );
        await act(async () => defaultProps.actions.getChannelStats());

        expect(screen.queryByText('Bookmarks')).not.toBeInTheDocument();
    });

    test('should hide scheduled posts when unlicensed or disabled', async () => {
        renderWithContext(
            <Menu
                {...defaultProps}
            />,
        );
        await act(async () => defaultProps.actions.getChannelStats());

        expect(screen.queryByText('Scheduled posts')).not.toBeInTheDocument();
    });

    test('should count non-error scheduled posts for the channel key only and navigate', async () => {
        const historyMock = (global as any).historyMock;
        historyMock.push.mockClear();

        renderWithContext(
            <Menu
                {...defaultProps}
            />,
            enabledFeaturesState,
        );
        await act(async () => defaultProps.actions.getChannelStats());

        const scheduledItem = screen.getByText('Scheduled posts');
        expect(scheduledItem).toBeInTheDocument();
        expect(scheduledItem.parentElement).toHaveTextContent('1');

        await userEvent.click(scheduledItem);
        expect(historyMock.push).toHaveBeenCalledWith('/team-slug/scheduled_posts?target_id=channel_id');
    });

    test('should render menu rows in the locked order', async () => {
        mockedCanAccessChannelSettings.mockReturnValue(true);

        renderWithContext(
            <Menu
                {...defaultProps}
            />,
            enabledFeaturesState,
        );
        await act(async () => defaultProps.actions.getChannelStats());

        const labels = screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'));
        expect(labels).toEqual([
            'Channel Settings',
            'Notification Preferences',
            'Unreads',
            'Members',
            'Pinned messages',
            'Bookmarks',
            'Scheduled posts',
            'Files',
        ]);
    });
});
