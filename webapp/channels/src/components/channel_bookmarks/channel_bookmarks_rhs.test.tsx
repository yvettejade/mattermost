// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';
import type {Channel} from '@mattermost/types/channels';

import {
    renderWithContext,
    screen,
    userEvent,
} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import {ChannelBookmarksRhs} from './channel_bookmarks_rhs';

jest.mock('./bookmark_item_content', () => ({
    __esModule: true,
    default: ({bookmark}: {bookmark: ChannelBookmark}) => (
        <div>{bookmark.display_name}</div>
    ),
}));

describe('channel_bookmarks_rhs', () => {
    const channel = TestHelper.getChannelMock({
        id: 'channel-id',
        display_name: 'Town Square',
    }) as Channel;

    const bookmark: ChannelBookmark = {
        id: 'bm1',
        channel_id: channel.id,
        owner_id: 'user-id',
        type: 'link',
        link_url: 'https://example.com',
        display_name: 'Docs',
        sort_order: 0,
        create_at: 0,
        update_at: 0,
        delete_at: 0,
    };

    const defaultProps = {
        channel,
        bookmarks: {} as Record<string, ChannelBookmark>,
        order: [] as string[],
        canAdd: true,
        canGoBack: true,
        onClose: jest.fn(),
        onBack: jest.fn(),
        onAddLink: jest.fn(),
    };

    beforeEach(() => {
        defaultProps.onClose = jest.fn();
        defaultProps.onBack = jest.fn();
        defaultProps.onAddLink = jest.fn();
    });

    test('shows empty list copy', () => {
        renderWithContext(
            <ChannelBookmarksRhs
                {...defaultProps}
            />,
        );

        expect(screen.getAllByText('Add a bookmark').length).toBeGreaterThan(0);
        expect(screen.queryByText('Docs')).not.toBeInTheDocument();
    });

    test('renders existing bookmark items when populated', () => {
        renderWithContext(
            <ChannelBookmarksRhs
                {...defaultProps}
                bookmarks={{[bookmark.id]: bookmark}}
                order={[bookmark.id]}
            />,
        );

        expect(screen.getByText('Docs')).toBeInTheDocument();
    });

    test('Back calls goBack', async () => {
        renderWithContext(
            <ChannelBookmarksRhs
                {...defaultProps}
            />,
        );

        await userEvent.click(screen.getByLabelText('Back Icon'));
        expect(defaultProps.onBack).toHaveBeenCalled();
    });
});
