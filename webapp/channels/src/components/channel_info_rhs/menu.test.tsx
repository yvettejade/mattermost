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
        channel: {type: Constants.OPEN_CHANNEL} as Channel,
        channelStats: {files_count: 3, pinnedpost_count: 12, member_count: 32} as ChannelStats,
        isArchived: false,
        teamName: 'team-1',
        unreadCount: {messages: 7, mentions: 2},
        bookmarksCount: 4,
        isBookmarksEnabled: true,
        scheduledPostsCount: 3,
        isScheduledPostsEnabled: true,
        actions: {
            openNotificationSettings: jest.fn(),
            showChannelFiles: jest.fn(),
            showPinnedPosts: jest.fn(),
            showChannelMembers: jest.fn(),
            getChannelStats: jest.fn().mockImplementation(() => Promise.resolve({data: {files_count: 3, pinnedpost_count: 12, member_count: 32}})),
            fetchChannelBookmarks: jest.fn(),
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
            fetchChannelBookmarks: jest.fn(),
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

    test('should display members in a GM', async () => {
        const props = {
            ...defaultProps,
            channel: {type: Constants.GM_CHANNEL} as Channel,
        };

        renderWithContext(<Menu {...props}/>);
        await act(async () => props.actions.getChannelStats());

        expect(screen.getByText('Members')).toBeInTheDocument();
    });

    describe('unread', () => {
        test('should expose unread messages and mentions as a single accessible name', async () => {
            renderWithContext(<Menu {...defaultProps}/>);
            await act(async () => defaultProps.actions.getChannelStats());

            const unread = screen.getByRole('group', {name: '7 unread messages, 2 mentions'});
            expect(unread).toBeInTheDocument();
            expect(unread).toHaveTextContent('Unread');
            expect(unread).toHaveTextContent('7');
            expect(unread).toHaveTextContent('2');
        });

        test('should use singular forms', async () => {
            renderWithContext(
                <Menu
                    {...defaultProps}
                    unreadCount={{messages: 1, mentions: 1}}
                />,
            );
            await act(async () => defaultProps.actions.getChannelStats());

            expect(screen.getByRole('group', {name: '1 unread message, 1 mention'})).toBeInTheDocument();
        });

        test('should show zero counts and no mention badge when nothing is unread', async () => {
            renderWithContext(
                <Menu
                    {...defaultProps}
                    unreadCount={{messages: 0, mentions: 0}}
                />,
            );
            await act(async () => defaultProps.actions.getChannelStats());

            const unread = screen.getByRole('group', {name: '0 unread messages, 0 mentions'});
            expect(unread).toHaveTextContent('Unread0');
        });

        test('should be shown in DMs', async () => {
            renderWithContext(
                <Menu
                    {...defaultProps}
                    channel={{type: Constants.DM_CHANNEL} as Channel}
                />,
            );
            await act(async () => defaultProps.actions.getChannelStats());

            expect(screen.getByRole('group', {name: '7 unread messages, 2 mentions'})).toBeInTheDocument();
        });
    });

    describe('bookmarks', () => {
        afterEach(() => {
            document.body.querySelector('[data-testid="channel-bookmarks-container"]')?.remove();
        });

        test('should display the bookmark count and fetch bookmarks for the channel', async () => {
            const props = {
                ...defaultProps,
                channel: {id: 'channel1', type: Constants.OPEN_CHANNEL} as Channel,
            };
            renderWithContext(<Menu {...props}/>);
            await act(async () => props.actions.getChannelStats());

            const item = screen.getByRole('button', {name: 'Bookmarks'});
            expect(item).toHaveTextContent('4');
            expect(props.actions.fetchChannelBookmarks).toHaveBeenCalledWith('channel1');
        });

        test('should be hidden and not fetch bookmarks when bookmarks are disabled', async () => {
            renderWithContext(
                <Menu
                    {...defaultProps}
                    isBookmarksEnabled={false}
                />,
            );
            await act(async () => defaultProps.actions.getChannelStats());

            expect(screen.queryByText('Bookmarks')).not.toBeInTheDocument();
            expect(defaultProps.actions.fetchChannelBookmarks).not.toHaveBeenCalled();
        });

        test('should be non-interactive when there are no bookmarks', async () => {
            renderWithContext(
                <Menu
                    {...defaultProps}
                    bookmarksCount={0}
                />,
            );
            await act(async () => defaultProps.actions.getChannelStats());

            expect(screen.getByText('Bookmarks')).toBeInTheDocument();
            expect(screen.queryByRole('button', {name: 'Bookmarks'})).not.toBeInTheDocument();
            expect(screen.queryByRole('link', {name: 'Bookmarks'})).not.toBeInTheDocument();
        });

        test('should scroll to and focus the bookmarks bar when clicked', async () => {
            const bar = document.createElement('div');
            bar.setAttribute('data-testid', 'channel-bookmarks-container');
            const link = document.createElement('a');
            link.href = 'https://example.com';
            bar.appendChild(link);
            document.body.appendChild(bar);
            const scrollIntoView = jest.fn();
            bar.scrollIntoView = scrollIntoView;

            renderWithContext(<Menu {...defaultProps}/>);
            await act(async () => defaultProps.actions.getChannelStats());

            await userEvent.click(screen.getByRole('button', {name: 'Bookmarks'}));

            expect(scrollIntoView).toHaveBeenCalled();
            expect(link).toHaveFocus();
        });
    });

    describe('scheduled posts', () => {
        test('should link to the scheduled posts list with the count', async () => {
            renderWithContext(<Menu {...defaultProps}/>);
            await act(async () => defaultProps.actions.getChannelStats());

            const link = screen.getByRole('link', {name: 'Scheduled posts'});
            expect(link).toHaveAttribute('href', '/team-1/scheduled_posts');
            expect(link).toHaveTextContent('3');
        });

        test('should be hidden when scheduled posts are disabled', async () => {
            renderWithContext(
                <Menu
                    {...defaultProps}
                    isScheduledPostsEnabled={false}
                />,
            );
            await act(async () => defaultProps.actions.getChannelStats());

            expect(screen.queryByText('Scheduled posts')).not.toBeInTheDocument();
        });
    });
});
