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

    test('should display unreads with a zero count', async () => {
        const props = {...defaultProps};

        renderWithContext(
            <Menu
                {...props}
            />,
        );

        await act(async () => {
            props.actions.getChannelStats();
        });

        const unreadsItem = screen.getByText('Unreads');
        expect(unreadsItem).toBeInTheDocument();
        expect(unreadsItem.parentElement).toHaveTextContent('0');
    });

    test('should display unreads with message and mention counts', async () => {
        const props = {...defaultProps};

        renderWithContext(
            <Menu
                {...props}
            />,
            {
                entities: {
                    channels: {
                        messageCounts: {
                            channel_id: {total: 10, root: 10},
                        },
                        myMembers: {
                            channel_id: {
                                channel_id: 'channel_id',
                                user_id: 'user_id',
                                mention_count: 2,
                                mention_count_root: 2,
                                msg_count: 3,
                                msg_count_root: 3,
                                urgent_mention_count: 0,
                            },
                        },
                    },
                },
            },
        );

        await act(async () => {
            props.actions.getChannelStats();
        });

        const unreadsItem = screen.getByText('Unreads');
        expect(unreadsItem).toBeInTheDocument();
        expect(unreadsItem.parentElement).toHaveTextContent('7');
        expect(unreadsItem.parentElement).toHaveTextContent('2');
    });

    test('should hide Bookmarks when the feature is disabled', async () => {
        const props = {...defaultProps};

        renderWithContext(
            <Menu
                {...props}
            />,
        );

        await act(async () => {
            props.actions.getChannelStats();
        });

        expect(screen.queryByText('Bookmarks')).not.toBeInTheDocument();
    });

    test('should display Bookmarks and open the sub-pane on click when enabled', async () => {
        const props = {...defaultProps};
        props.actions.showChannelBookmarks = jest.fn();

        renderWithContext(
            <Menu
                {...props}
            />,
            {
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
                            channel_id: {
                                bm1: {
                                    id: 'bm1',
                                    channel_id: 'channel_id',
                                    display_name: 'Docs',
                                    sort_order: 0,
                                },
                                bm2: {
                                    id: 'bm2',
                                    channel_id: 'channel_id',
                                    display_name: 'Specs',
                                    sort_order: 1,
                                },
                            },
                        },
                    },
                },
            },
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
        const props = {...defaultProps};

        renderWithContext(
            <Menu
                {...props}
            />,
        );

        await act(async () => {
            props.actions.getChannelStats();
        });

        expect(screen.queryByText('Scheduled posts')).not.toBeInTheDocument();
    });

    test('should display Scheduled posts and open the sub-pane on click when enabled', async () => {
        const props = {...defaultProps};
        props.actions.showChannelScheduledPosts = jest.fn();

        renderWithContext(
            <Menu
                {...props}
            />,
            {
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
                        byId: {
                            sp1: {id: 'sp1', channel_id: 'channel_id'},
                            sp2: {id: 'sp2', channel_id: 'channel_id'},
                        },
                        byChannelOrThreadId: {
                            channel_id: ['sp1', 'sp2'],
                        },
                    },
                },
            },
        );

        await act(async () => {
            props.actions.getChannelStats();
        });

        const scheduledItem = screen.getByText('Scheduled posts');
        expect(scheduledItem).toBeInTheDocument();
        expect(scheduledItem.parentElement).toHaveTextContent('2');

        await userEvent.click(scheduledItem);
        expect(props.actions.showChannelScheduledPosts).toHaveBeenCalledWith('channel_id');
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
});
