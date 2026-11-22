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

const scrollIntoViewMock = jest.fn();

const mockedCanAccessChannelSettings = canAccessChannelSettings as unknown as jest.Mock;
const mockedOpenModal = openModal as unknown as jest.Mock;

describe('channel_info_rhs/menu', () => {
    const defaultProps = {
        channel: {type: Constants.OPEN_CHANNEL} as Channel,
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

    describe('unread row', () => {
        test('should expose one accessible name covering messages and mentions', async () => {
            const props = {...defaultProps, unreadCount: {messages: 7, mentions: 2}};

            renderWithContext(<Menu {...props}/>);
            await act(async () => props.actions.getChannelStats());

            expect(screen.getByRole('img', {name: '7 unread messages, 2 mentions'})).toBeInTheDocument();
        });

        test('should use singular forms and report zero mentions in the accessible name', async () => {
            const props = {...defaultProps, unreadCount: {messages: 1, mentions: 0}};

            renderWithContext(<Menu {...props}/>);
            await act(async () => props.actions.getChannelStats());

            expect(screen.getByRole('img', {name: '1 unread message, 0 mentions'})).toBeInTheDocument();
        });

        test('should display unread messages and mentions', async () => {
            const props = {...defaultProps, unreadCount: {messages: 7, mentions: 2}};

            renderWithContext(<Menu {...props}/>);
            await act(async () => props.actions.getChannelStats());

            const row = screen.getByText('Unread').parentElement!;
            expect(screen.getByTestId('channelInfoRHSUnreadMessages')).toHaveTextContent('7');
            expect(screen.getByTestId('channelInfoRHSUnreadMentions')).toHaveTextContent('2');
            expect(row).toHaveTextContent('72');
        });

        test('should not display the mentions badge when there are no mentions', async () => {
            const props = {...defaultProps, unreadCount: {messages: 4, mentions: 0}};

            renderWithContext(<Menu {...props}/>);
            await act(async () => props.actions.getChannelStats());

            expect(screen.getByTestId('channelInfoRHSUnreadMessages')).toHaveTextContent('4');
            expect(screen.queryByTestId('channelInfoRHSUnreadMentions')).not.toBeInTheDocument();
        });

        test('should display zero when nothing is unread', async () => {
            const props = {...defaultProps, unreadCount: {messages: 0, mentions: 0}};

            renderWithContext(<Menu {...props}/>);
            await act(async () => props.actions.getChannelStats());

            expect(screen.getByTestId('channelInfoRHSUnreadMessages')).toHaveTextContent('0');
        });

        test('should be displayed in DMs and archived channels', async () => {
            const props = {
                ...defaultProps,
                channel: {type: Constants.DM_CHANNEL} as Channel,
                isArchived: true,
                unreadCount: {messages: 1, mentions: 1},
            };

            renderWithContext(<Menu {...props}/>);
            await act(async () => props.actions.getChannelStats());

            expect(screen.getByText('Unread')).toBeInTheDocument();
        });
    });

    describe('bookmarks row', () => {
        beforeEach(() => {
            scrollIntoViewMock.mockClear();
            window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
        });

        test('should display the bookmarks count and fetch bookmarks', async () => {
            const props = {
                ...defaultProps,
                channel: {id: 'channel_id', type: Constants.OPEN_CHANNEL} as Channel,
                isBookmarksEnabled: true,
                bookmarksCount: 5,
            };
            const fetchChannelBookmarks = jest.fn();

            renderWithContext(
                <Menu
                    {...props}
                    actions={{...props.actions, fetchChannelBookmarks}}
                />,
            );
            await act(async () => props.actions.getChannelStats());

            expect(screen.getByText('Bookmarks').parentElement).toHaveTextContent('5');
            expect(fetchChannelBookmarks).toHaveBeenCalledWith('channel_id');
        });

        test('should NOT display bookmarks when channel bookmarks are disabled', async () => {
            const fetchChannelBookmarks = jest.fn();
            const props = {
                ...defaultProps,
                isBookmarksEnabled: false,
                bookmarksCount: 5,
                actions: {...defaultProps.actions, fetchChannelBookmarks},
            };

            renderWithContext(<Menu {...props}/>);
            await act(async () => props.actions.getChannelStats());

            expect(screen.queryByText('Bookmarks')).not.toBeInTheDocument();
            expect(fetchChannelBookmarks).not.toHaveBeenCalled();
        });

        test('should scroll to and focus the channel bookmarks bar when clicked', async () => {
            const bar = document.createElement('div');
            bar.setAttribute('data-testid', 'channel-bookmarks-container');
            const barButton = document.createElement('button');
            bar.appendChild(barButton);
            document.body.appendChild(bar);

            const props = {...defaultProps, isBookmarksEnabled: true, bookmarksCount: 1};
            renderWithContext(<Menu {...props}/>);
            await act(async () => props.actions.getChannelStats());

            await userEvent.click(screen.getByText('Bookmarks'));

            expect(scrollIntoViewMock).toHaveBeenCalled();
            expect(document.activeElement).toBe(barButton);

            document.body.removeChild(bar);
        });

        test('should render a non-interactive row when there are no bookmarks', async () => {
            const props = {...defaultProps, isBookmarksEnabled: true, bookmarksCount: 0};
            renderWithContext(<Menu {...props}/>);
            await act(async () => props.actions.getChannelStats());

            expect(screen.getByText('Bookmarks').parentElement).toHaveTextContent('0');
            expect(screen.queryByRole('button', {name: 'Bookmarks'})).not.toBeInTheDocument();

            await userEvent.click(screen.getByText('Bookmarks'));
            expect(scrollIntoViewMock).not.toHaveBeenCalled();
        });

        test('should render an interactive row when there are bookmarks', async () => {
            const props = {...defaultProps, isBookmarksEnabled: true, bookmarksCount: 2};
            renderWithContext(<Menu {...props}/>);
            await act(async () => props.actions.getChannelStats());

            expect(screen.getByRole('button', {name: 'Bookmarks'})).toBeInTheDocument();
        });
    });

    describe('scheduled posts row', () => {
        test('should display the scheduled posts count and link to the scheduled posts page', async () => {
            const historyMock = (global as any).historyMock;
            historyMock.push.mockClear();
            const props = {
                ...defaultProps,
                teamName: 'my-team',
                isScheduledPostsEnabled: true,
                scheduledPostsCount: 3,
            };

            renderWithContext(<Menu {...props}/>);
            await act(async () => props.actions.getChannelStats());

            const row = screen.getByText('Scheduled posts');
            expect(row.parentElement).toHaveTextContent('3');

            await userEvent.click(row);
            expect(historyMock.push).toHaveBeenCalledWith('/my-team/scheduled_posts');
        });

        test('should NOT display scheduled posts when disabled or unlicensed', async () => {
            const props = {
                ...defaultProps,
                teamName: 'my-team',
                isScheduledPostsEnabled: false,
                scheduledPostsCount: 3,
            };

            renderWithContext(<Menu {...props}/>);
            await act(async () => props.actions.getChannelStats());

            expect(screen.queryByText('Scheduled posts')).not.toBeInTheDocument();
        });
    });

    describe('visibility by channel type', () => {
        const allRowProps = {
            ...defaultProps,
            teamName: 'my-team',
            unreadCount: {messages: 1, mentions: 0},
            isBookmarksEnabled: true,
            bookmarksCount: 1,
            isScheduledPostsEnabled: true,
            scheduledPostsCount: 1,
        };

        test.each([
            [Constants.OPEN_CHANNEL, false],
            [Constants.PRIVATE_CHANNEL, false],
            [Constants.GM_CHANNEL, false],
            [Constants.DM_CHANNEL, true],
        ])('Members row is hidden only in DMs (%s)', async (type, hidden) => {
            const props = {...allRowProps, channel: {type} as Channel};

            renderWithContext(<Menu {...props}/>);
            await act(async () => props.actions.getChannelStats());

            expect(screen.queryByText('Members') === null).toBe(hidden);
            expect(screen.getByText('Pinned messages')).toBeInTheDocument();
            expect(screen.getByText('Unread')).toBeInTheDocument();
            expect(screen.getByText('Bookmarks')).toBeInTheDocument();
            expect(screen.getByText('Scheduled posts')).toBeInTheDocument();
        });

        test('should display all rows in an archived channel', async () => {
            const props = {...allRowProps, isArchived: true};

            renderWithContext(<Menu {...props}/>);
            await act(async () => props.actions.getChannelStats());

            expect(screen.getByText('Unread')).toBeInTheDocument();
            expect(screen.getByText('Members')).toBeInTheDocument();
            expect(screen.getByText('Pinned messages')).toBeInTheDocument();
            expect(screen.getByText('Bookmarks')).toBeInTheDocument();
            expect(screen.getByText('Scheduled posts')).toBeInTheDocument();
        });
    });
});
