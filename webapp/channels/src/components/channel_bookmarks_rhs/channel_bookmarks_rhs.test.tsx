// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelBookmarksRhs from './channel_bookmarks_rhs';

jest.mock('components/channel_bookmarks/bookmark_item_content', () => (props: {bookmark: ChannelBookmark}) => (
    <div>{props.bookmark.display_name}</div>
));

jest.mock('components/channel_bookmarks/channel_bookmarks_menu', () => ({
    useBookmarkAddActions: () => ({
        handleCreateLink: jest.fn(),
        handleCreateFile: jest.fn(),
    }),
}));

jest.mock('components/menu', () => ({
    Container: ({menuButton}: {menuButton: {children: React.ReactNode}}) => (
        <div>{menuButton.children}</div>
    ),
    Item: () => null,
}));

describe('channel_bookmarks_rhs', () => {
    const channel = TestHelper.getChannelMock({
        id: 'channel_id',
        display_name: 'Town Square',
    });

    const baseProps = {
        channel: channel as Channel,
        canGoBack: true,
        bookmarks: [] as ChannelBookmark[],
        canAdd: false,
        canUploadFiles: false,
        limitReached: false,
        actions: {
            closeRightHandSide: jest.fn(),
            goBack: jest.fn(),
        },
    };

    beforeEach(() => {
        baseProps.actions = {
            closeRightHandSide: jest.fn(),
            goBack: jest.fn(),
        };
    });

    test('shows an empty state when there are no bookmarks', () => {
        renderWithContext(
            <ChannelBookmarksRhs
                {...baseProps}
            />,
        );

        expect(screen.getByText('Bookmarks')).toBeInTheDocument();
        expect(screen.getByText('No bookmarks yet')).toBeInTheDocument();
        expect(screen.queryByText('Docs')).not.toBeInTheDocument();
    });

    test('lists ordered bookmarks when populated', () => {
        const bookmarks = [
            bookmark('bm1', 'Docs', 0),
            bookmark('bm2', 'Roadmap', 1),
        ];

        renderWithContext(
            <ChannelBookmarksRhs
                {...baseProps}
                bookmarks={bookmarks}
            />,
        );

        expect(screen.getByText('Docs')).toBeInTheDocument();
        expect(screen.getByText('Roadmap')).toBeInTheDocument();
        expect(screen.queryByText('No bookmarks yet')).not.toBeInTheDocument();
    });

    test('calls goBack when the back button is clicked', async () => {
        renderWithContext(
            <ChannelBookmarksRhs
                {...baseProps}
            />,
        );

        await userEvent.click(screen.getByLabelText('Back Icon'));
        expect(baseProps.actions.goBack).toHaveBeenCalled();
    });
});

function bookmark(id: string, displayName: string, sortOrder: number): ChannelBookmark {
    return {
        id,
        channel_id: 'channel_id',
        owner_id: 'user_id',
        type: 'link',
        link_url: `https://example.com/${id}`,
        display_name: displayName,
        sort_order: sortOrder,
        create_at: 0,
        update_at: 0,
        delete_at: 0,
    };
}
