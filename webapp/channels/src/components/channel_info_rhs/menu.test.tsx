// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel, ChannelStats} from '@mattermost/types/channels';

import EventEmitter from 'mattermost-redux/utils/event_emitter';

import {fetchChannelBookmarks} from 'actions/channel_bookmarks';
import {openModal} from 'actions/views/modals';
import {closeRightHandSide} from 'actions/views/rhs';
import {canAccessChannelSettings} from 'selectors/views/channel_settings';

import {
    act,
    renderWithContext,
    screen,
    userEvent,
    fireEvent,
} from 'tests/react_testing_utils';
import Constants, {EventTypes, ModalIdentifiers} from 'utils/constants';

jest.mock('selectors/views/channel_settings', () => ({
    canAccessChannelSettings: jest.fn(),
}));
jest.mock('actions/views/modals', () => ({
    openModal: jest.fn(() => ({type: 'OPEN_MODAL'})),
}));
jest.mock('actions/channel_bookmarks', () => ({
    fetchChannelBookmarks: jest.fn(() => ({type: 'MOCK_FETCH_CHANNEL_BOOKMARKS'})),
}));
jest.mock('actions/views/rhs', () => ({
    closeRightHandSide: jest.fn(() => ({type: 'MOCK_CLOSE_RHS'})),
}));
jest.mock('mattermost-redux/utils/event_emitter', () => ({
    __esModule: true,
    default: {
        emit: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
    },
}));

const mockHistoryPush = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useHistory: () => ({
        push: mockHistoryPush,
    }),
}));

import Menu from './menu';

const mockedCanAccessChannelSettings = canAccessChannelSettings as unknown as jest.Mock;
const mockedOpenModal = openModal as unknown as jest.Mock;
const mockedFetchChannelBookmarks = fetchChannelBookmarks as unknown as jest.Mock;
const mockedCloseRightHandSide = closeRightHandSide as unknown as jest.Mock;

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
            getChannelStats: jest.fn().mockImplementation(() => Promise.resolve({data: {files_count: 3, pinnedpost_count: 12, member_count: 32}})),
        },
    };

    beforeEach(() => {
        mockedOpenModal.mockClear();
        mockedCanAccessChannelSettings.mockReset();
        mockedFetchChannelBookmarks.mockClear();
        mockedCloseRightHandSide.mockClear();
        mockHistoryPush.mockClear();
        (EventEmitter.emit as jest.Mock).mockClear();
        defaultProps.actions = {
            openNotificationSettings: jest.fn(),
            showChannelFiles: jest.fn(),
            showPinnedPosts: jest.fn(),
            showChannelMembers: jest.fn(),
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

    test('should display Unreads with a zero badge and no-op when empty', async () => {
        const props = {...defaultProps};

        renderWithContext(
            <Menu
                {...props}
            />,
        );

        const unreadsItem = screen.getByText('Unreads');
        expect(unreadsItem).toBeInTheDocument();
        expect(unreadsItem.parentElement).toHaveTextContent('0');

        await userEvent.click(unreadsItem);
        expect(EventEmitter.emit).not.toHaveBeenCalled();
    });

    test('should jump to unreads without marking read when messages are unread', async () => {
        const props = {...defaultProps};

        renderWithContext(
            <Menu
                {...props}
            />,
            {
                entities: {
                    channels: {
                        messageCounts: {
                            channel_id: {root: 5, total: 5},
                        },
                        myMembers: {
                            channel_id: {
                                channel_id: 'channel_id',
                                user_id: 'user_id',
                                msg_count: 2,
                                msg_count_root: 2,
                                mention_count: 0,
                                mention_count_root: 0,
                            },
                        },
                    },
                },
            },
        );

        const unreadsItem = screen.getByText('Unreads');
        expect(unreadsItem.parentElement).toHaveTextContent('3');

        await userEvent.click(unreadsItem);
        expect(EventEmitter.emit).toHaveBeenCalledWith(EventTypes.POST_LIST_SCROLL_TO_UNREADS);
    });

    test('should show mention count beside unread messages when mentions exist', async () => {
        const props = {...defaultProps};

        renderWithContext(
            <Menu
                {...props}
            />,
            {
                entities: {
                    channels: {
                        messageCounts: {
                            channel_id: {root: 2, total: 2},
                        },
                        myMembers: {
                            channel_id: {
                                channel_id: 'channel_id',
                                user_id: 'user_id',
                                msg_count: 2,
                                msg_count_root: 2,
                                mention_count: 4,
                                mention_count_root: 4,
                            },
                        },
                    },
                },
            },
        );

        const unreadsItem = screen.getByText('Unreads');
        expect(unreadsItem.parentElement).toHaveTextContent('04');

        await userEvent.click(unreadsItem);
        expect(EventEmitter.emit).toHaveBeenCalledWith(EventTypes.POST_LIST_SCROLL_TO_UNREADS);
    });

    test('should hide Bookmarks and Scheduled posts when gated off', async () => {
        renderWithContext(
            <Menu
                {...defaultProps}
            />,
        );

        expect(screen.getByText('Unreads')).toBeInTheDocument();
        expect(screen.queryByText('Bookmarks')).not.toBeInTheDocument();
        expect(screen.queryByText('Scheduled posts')).not.toBeInTheDocument();
    });

    test('should show Bookmarks when licensed and flagged, including empty expand', async () => {
        renderWithContext(
            <Menu
                {...defaultProps}
            />,
            licensedFeatureState(),
        );

        const bookmarksItem = screen.getByText('Bookmarks');
        expect(bookmarksItem).toBeInTheDocument();
        expect(bookmarksItem.parentElement).toHaveTextContent('0');

        await userEvent.click(bookmarksItem);
        expect(screen.getByText('No bookmarks yet')).toBeInTheDocument();
    });

    test('should show Scheduled posts when enabled and exclude error-coded posts from the badge', async () => {
        renderWithContext(
            <Menu
                {...defaultProps}
            />,
            {
                ...licensedFeatureState(),
                entities: {
                    ...licensedFeatureState().entities,
                    scheduledPosts: {
                        byId: {
                            ok_post: {id: 'ok_post', channel_id: 'channel_id'},
                            bad_post: {id: 'bad_post', channel_id: 'channel_id', error_code: 'unable_to_send'},
                        },
                        byTeamId: {},
                        errorsByTeamId: {},
                        byChannelOrThreadId: {
                            channel_id: ['ok_post', 'bad_post'],
                            some_thread: ['thread_only'],
                        },
                    },
                    teams: {
                        currentTeamId: 'team_id',
                        teams: {
                            team_id: {id: 'team_id', name: 'team-name'},
                        },
                    },
                },
            },
        );

        const scheduledItem = screen.getByText('Scheduled posts');
        expect(scheduledItem).toBeInTheDocument();
        expect(scheduledItem.parentElement).toHaveTextContent('1');

        await userEvent.click(scheduledItem);
        expect(mockHistoryPush).toHaveBeenCalledWith('/team-name/scheduled_posts?target_id=channel_id');
        expect(mockedCloseRightHandSide).toHaveBeenCalled();
    });

    test('should keep the five feature rows before Files, Settings, and Notifications', async () => {
        mockedCanAccessChannelSettings.mockReturnValue(true);

        renderWithContext(
            <Menu
                {...defaultProps}
            />,
            licensedFeatureState(),
        );

        const labels = screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'));
        expect(labels).toEqual([
            'Unreads',
            'Members',
            'Pinned messages',
            'Bookmarks',
            'Scheduled posts',
            'Files',
            'Channel Settings',
            'Notification Preferences',
        ]);
    });
});

function licensedFeatureState() {
    return {
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
        },
    };
}
