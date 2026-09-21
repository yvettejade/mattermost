// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel, ChannelStats} from '@mattermost/types/channels';
import type {DeepPartial} from '@mattermost/types/utilities';

import * as channelBookmarkSelectors from 'mattermost-redux/selectors/entities/channel_bookmarks';
import * as scheduledPostSelectors from 'mattermost-redux/selectors/entities/scheduled_posts';
import EventEmitter from 'mattermost-redux/utils/event_emitter';

import {openModal} from 'actions/views/modals';
import {canAccessChannelSettings} from 'selectors/views/channel_settings';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {
    act,
    renderWithContext,
    screen,
    userEvent,
    fireEvent,
} from 'tests/react_testing_utils';
import Constants, {EventTypes, ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

jest.mock('selectors/views/channel_settings', () => ({
    canAccessChannelSettings: jest.fn(),
}));
jest.mock('actions/views/modals', () => ({
    openModal: jest.fn(() => ({type: 'OPEN_MODAL'})),
}));

import Menu from './menu';

const mockedCanAccessChannelSettings = canAccessChannelSettings as unknown as jest.Mock;
const mockedOpenModal = openModal as unknown as jest.Mock;

const channelId = 'channel_id';

function buildState(overrides: DeepPartial<GlobalState> = {}): DeepPartial<GlobalState> {
    return mergeObjects({
        entities: {
            channels: {
                currentChannelId: channelId,
                channels: {
                    [channelId]: {
                        id: channelId,
                        type: Constants.OPEN_CHANNEL,
                        team_id: 'team_id',
                    },
                },
                messageCounts: {
                    [channelId]: {total: 15, root: 10},
                },
                myMembers: {
                    [channelId]: {
                        channel_id: channelId,
                        msg_count: 10,
                        msg_count_root: 8,
                        mention_count: 0,
                        mention_count_root: 0,
                        urgent_mention_count: 0,
                    },
                },
            },
            channelBookmarks: {
                byChannelId: {},
            },
            scheduledPosts: {
                byId: {},
                byChannelOrThreadId: {},
                byTeamId: {},
                errorsByTeamId: {},
            },
            general: {
                config: {},
                license: {IsLicensed: 'false'},
            },
            teams: {
                currentTeamId: 'team_id',
                teams: {
                    team_id: TestHelper.getTeamMock({id: 'team_id', name: 'team-1'}),
                },
                myMembers: {
                    team_id: {team_id: 'team_id', user_id: 'current_user_id', roles: 'team_user'},
                },
            },
            preferences: {
                myPreferences: {},
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {id: 'current_user_id', roles: 'system_user'},
                },
            },
        },
    }, overrides);
}

describe('channel_info_rhs/menu', () => {
    const defaultProps = {
        channel: {id: channelId, type: Constants.OPEN_CHANNEL} as Channel,
        channelStats: {files_count: 3, pinnedpost_count: 12, member_count: 32} as ChannelStats,
        isArchived: false,
        actions: {
            openNotificationSettings: jest.fn(),
            showChannelFiles: jest.fn(),
            showPinnedPosts: jest.fn(),
            showChannelMembers: jest.fn(),
            showChannelBookmarks: jest.fn(),
            openScheduledPosts: jest.fn(),
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
            openScheduledPosts: jest.fn(),
            getChannelStats: jest.fn().mockImplementation(() => Promise.resolve({data: {files_count: 3, pinnedpost_count: 12, member_count: 32}})),
        };
        jest.spyOn(EventEmitter, 'emit').mockImplementation(jest.fn());
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

    test('should render Unreads MenuItem by id even with zero unreads', async () => {
        renderWithContext(
            <Menu
                {...defaultProps}
            />,
            buildState({
                entities: {
                    channels: {
                        messageCounts: {
                            [channelId]: {total: 10, root: 8},
                        },
                        myMembers: {
                            [channelId]: {
                                channel_id: channelId,
                                msg_count: 10,
                                msg_count_root: 8,
                                mention_count: 0,
                                mention_count_root: 0,
                                urgent_mention_count: 0,
                            },
                        },
                    },
                },
            }),
        );
        await act(async () => defaultProps.actions.getChannelStats());

        const unreadsById = document.getElementById('channelInfoRHSUnreads');
        expect(unreadsById).toBeInTheDocument();
        expect(unreadsById).toHaveAttribute('id', 'channelInfoRHSUnreads');
        expect(unreadsById).toHaveTextContent('Unreads');
        expect(unreadsById).toHaveTextContent('0');
    });

    test('should still render Unreads by id when bookmark or scheduled selectors throw', async () => {
        jest.spyOn(channelBookmarkSelectors, 'getChannelBookmarks').mockImplementation(() => {
            throw new Error('channelBookmarks missing');
        });
        jest.spyOn(scheduledPostSelectors, 'showChannelOrThreadScheduledPostIndicator').mockImplementation(() => {
            throw new Error('scheduledPosts missing');
        });

        renderWithContext(
            <Menu
                {...defaultProps}
            />,
            buildState(),
        );
        await act(async () => defaultProps.actions.getChannelStats());

        expect(document.getElementById('channelInfoRHSUnreads')).toBeInTheDocument();
        expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
        expect(screen.getByText('Members')).toBeInTheDocument();
        expect(screen.queryByText('Bookmarks')).not.toBeInTheDocument();
        expect(screen.queryByText('Scheduled posts')).not.toBeInTheDocument();

        jest.restoreAllMocks();
    });

    test('should display Unreads with a zero badge and keep the row after Members/Pins order', async () => {
        const props = {...defaultProps};

        renderWithContext(
            <Menu
                {...props}
            />,
            buildState({
                entities: {
                    channels: {
                        messageCounts: {
                            [channelId]: {total: 10, root: 8},
                        },
                        myMembers: {
                            [channelId]: {
                                channel_id: channelId,
                                msg_count: 10,
                                msg_count_root: 8,
                                mention_count: 0,
                                mention_count_root: 0,
                                urgent_mention_count: 0,
                            },
                        },
                    },
                },
            }),
        );
        await act(async () => props.actions.getChannelStats());

        const unreadsItem = screen.getByText('Unreads');
        expect(unreadsItem).toBeInTheDocument();
        expect(unreadsItem.parentElement).toHaveTextContent('0');

        const labels = screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'));
        expect(labels.indexOf('Unreads')).toBeLessThan(labels.indexOf('Members'));
        expect(labels.indexOf('Members')).toBeLessThan(labels.indexOf('Pinned messages'));
        expect(labels.indexOf('Pinned messages')).toBeLessThan(labels.indexOf('Files'));
    });

    test('should display CRT-aware unread counts and mention styling', async () => {
        const props = {...defaultProps};

        renderWithContext(
            <Menu
                {...props}
            />,
            buildState({
                entities: {
                    general: {
                        config: {
                            CollapsedThreads: 'always_on',
                        },
                    },
                    channels: {
                        messageCounts: {
                            [channelId]: {total: 20, root: 10},
                        },
                        myMembers: {
                            [channelId]: {
                                channel_id: channelId,
                                msg_count: 5,
                                msg_count_root: 8,
                                mention_count: 9,
                                mention_count_root: 3,
                                urgent_mention_count: 1,
                            },
                        },
                    },
                },
            }),
        );
        await act(async () => props.actions.getChannelStats());

        const unreadsItem = screen.getByText('Unreads');
        expect(unreadsItem.parentElement).toHaveTextContent('2');
        expect(unreadsItem.parentElement?.querySelector('[data-mention="true"]')).toBeInTheDocument();
        expect(unreadsItem.parentElement?.querySelector('[data-urgent="true"]')).toBeInTheDocument();
    });

    test('should jump to unreads and keep the RHS open when there are messages to jump to', async () => {
        const props = {...defaultProps};

        renderWithContext(
            <Menu
                {...props}
            />,
            buildState({
                entities: {
                    channels: {
                        messageCounts: {
                            [channelId]: {total: 15, root: 10},
                        },
                        myMembers: {
                            [channelId]: {
                                channel_id: channelId,
                                msg_count: 10,
                                msg_count_root: 8,
                                mention_count: 0,
                                mention_count_root: 0,
                                urgent_mention_count: 0,
                            },
                        },
                    },
                },
            }),
        );
        await act(async () => props.actions.getChannelStats());

        await userEvent.click(screen.getByText('Unreads'));

        expect(EventEmitter.emit).toHaveBeenCalledWith(EventTypes.POST_LIST_SCROLL_TO_UNREAD_MESSAGES);
        expect(props.actions.showChannelMembers).not.toHaveBeenCalled();
    });

    test('should no-op Unreads click when there is nothing to jump to', async () => {
        const props = {...defaultProps};

        renderWithContext(
            <Menu
                {...props}
            />,
            buildState({
                entities: {
                    channels: {
                        messageCounts: {
                            [channelId]: {total: 10, root: 8},
                        },
                        myMembers: {
                            [channelId]: {
                                channel_id: channelId,
                                msg_count: 10,
                                msg_count_root: 8,
                                mention_count: 0,
                                mention_count_root: 0,
                                urgent_mention_count: 0,
                            },
                        },
                    },
                },
            }),
        );
        await act(async () => props.actions.getChannelStats());

        await userEvent.click(screen.getByText('Unreads'));
        expect(EventEmitter.emit).not.toHaveBeenCalled();
    });

    test('should hide Bookmarks when the feature is gated off', async () => {
        renderWithContext(
            <Menu
                {...defaultProps}
            />,
            buildState(),
        );
        await act(async () => defaultProps.actions.getChannelStats());

        expect(screen.queryByText('Bookmarks')).not.toBeInTheDocument();
    });

    test('should show Bookmarks with a zero badge and open the subpanel when gated on', async () => {
        const props = {...defaultProps};

        renderWithContext(
            <Menu
                {...props}
            />,
            buildState({
                entities: {
                    general: {
                        config: {
                            FeatureFlagChannelBookmarks: 'true',
                        },
                        license: {IsLicensed: 'true'},
                    },
                },
            }),
        );
        await act(async () => props.actions.getChannelStats());

        const bookmarksItem = screen.getByText('Bookmarks');
        expect(bookmarksItem).toBeInTheDocument();
        expect(bookmarksItem.parentElement).toHaveTextContent('0');

        await userEvent.click(bookmarksItem);
        expect(props.actions.showChannelBookmarks).toHaveBeenCalledWith(channelId);
    });

    test('should show Bookmarks in a DM when gated on', async () => {
        renderWithContext(
            <Menu
                {...defaultProps}
                channel={{id: channelId, type: Constants.DM_CHANNEL} as Channel}
            />,
            buildState({
                entities: {
                    general: {
                        config: {
                            FeatureFlagChannelBookmarks: 'true',
                        },
                        license: {IsLicensed: 'true'},
                    },
                    channelBookmarks: {
                        byChannelId: {
                            [channelId]: {
                                bm1: {id: 'bm1'},
                                bm2: {id: 'bm2'},
                            },
                        },
                    },
                },
            }),
        );
        await act(async () => defaultProps.actions.getChannelStats());

        const bookmarksItem = screen.getByText('Bookmarks');
        expect(bookmarksItem).toBeInTheDocument();
        expect(bookmarksItem.parentElement).toHaveTextContent('2');
    });

    test('should hide Scheduled posts when gated off', async () => {
        renderWithContext(
            <Menu
                {...defaultProps}
            />,
            buildState(),
        );
        await act(async () => defaultProps.actions.getChannelStats());

        expect(screen.queryByText('Scheduled posts')).not.toBeInTheDocument();
    });

    test('should show Scheduled posts with a non-error badge and navigate away', async () => {
        const props = {...defaultProps};

        renderWithContext(
            <Menu
                {...props}
            />,
            buildState({
                entities: {
                    general: {
                        config: {
                            ScheduledPosts: 'true',
                        },
                        license: {IsLicensed: 'true'},
                    },
                    scheduledPosts: {
                        byId: {
                            ok: {id: 'ok'},
                            failed: {id: 'failed', error_code: 'failed'},
                        },
                        byChannelOrThreadId: {
                            [channelId]: ['ok', 'failed'],
                        },
                    },
                },
            }),
        );
        await act(async () => props.actions.getChannelStats());

        const scheduledItem = screen.getByText('Scheduled posts');
        expect(scheduledItem).toBeInTheDocument();
        expect(scheduledItem.parentElement).toHaveTextContent('1');

        await userEvent.click(scheduledItem);
        expect(props.actions.openScheduledPosts).toHaveBeenCalledWith(channelId);
    });

    test('should show Scheduled posts with a zero badge in a GM when gated on', async () => {
        renderWithContext(
            <Menu
                {...defaultProps}
                channel={{id: channelId, type: Constants.GM_CHANNEL} as Channel}
            />,
            buildState({
                entities: {
                    general: {
                        config: {
                            ScheduledPosts: 'true',
                        },
                        license: {IsLicensed: 'true'},
                    },
                },
            }),
        );
        await act(async () => defaultProps.actions.getChannelStats());

        const scheduledItem = screen.getByText('Scheduled posts');
        expect(scheduledItem).toBeInTheDocument();
        expect(scheduledItem.parentElement).toHaveTextContent('0');
    });

    test('should render the locked menu order including gated rows', async () => {
        renderWithContext(
            <Menu
                {...defaultProps}
            />,
            buildState({
                entities: {
                    general: {
                        config: {
                            FeatureFlagChannelBookmarks: 'true',
                            ScheduledPosts: 'true',
                        },
                        license: {IsLicensed: 'true'},
                    },
                },
            }),
        );
        await act(async () => defaultProps.actions.getChannelStats());

        const labels = screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'));
        expect(labels).toEqual([
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
