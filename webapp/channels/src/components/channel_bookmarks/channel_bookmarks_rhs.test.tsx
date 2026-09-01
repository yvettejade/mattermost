// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';
import type {Channel} from '@mattermost/types/channels';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {ChannelBookmarksRhsView} from './channel_bookmarks_rhs';

jest.mock('./bookmark_item_content', () => ({
    __esModule: true,
    default: ({bookmark}: {bookmark: ChannelBookmark}) => (
        <div data-testid={`bookmark-item-${bookmark.id}`}>{bookmark.display_name}</div>
    ),
}));

describe('channel_bookmarks_rhs', () => {
    const channel = {
        id: 'channel-id',
        display_name: 'Town Square',
        type: 'O',
    } as Channel;

    const goBack = jest.fn();
    const onClose = jest.fn();
    const onAddBookmark = jest.fn();

    beforeEach(() => {
        goBack.mockClear();
        onClose.mockClear();
        onAddBookmark.mockClear();
    });

    test('shows empty list copy when there are no bookmarks', () => {
        renderWithContext(
            <ChannelBookmarksRhsView
                channel={channel}
                bookmarks={[]}
                canAdd={false}
                canGoBack={true}
                onClose={onClose}
                goBack={goBack}
                onAddBookmark={onAddBookmark}
            />,
        );

        expect(screen.getByText('Add a bookmark')).toBeInTheDocument();
        expect(screen.queryByTestId(/bookmark-item-/)).not.toBeInTheDocument();
    });

    test('renders existing bookmark items when populated', () => {
        const bookmarks = [
            {
                id: 'bm1',
                display_name: 'Docs',
                type: 'link',
                sort_order: 0,
            },
            {
                id: 'bm2',
                display_name: 'Spec',
                type: 'link',
                sort_order: 1,
            },
        ] as ChannelBookmark[];

        renderWithContext(
            <ChannelBookmarksRhsView
                channel={channel}
                bookmarks={bookmarks}
                canAdd={true}
                canGoBack={true}
                onClose={onClose}
                goBack={goBack}
                onAddBookmark={onAddBookmark}
            />,
        );

        expect(screen.getByTestId('bookmark-item-bm1')).toHaveTextContent('Docs');
        expect(screen.getByTestId('bookmark-item-bm2')).toHaveTextContent('Spec');
    });

    test('Back calls goBack', async () => {
        renderWithContext(
            <ChannelBookmarksRhsView
                channel={channel}
                bookmarks={[]}
                canAdd={false}
                canGoBack={true}
                onClose={onClose}
                goBack={goBack}
                onAddBookmark={onAddBookmark}
            />,
        );

        await userEvent.click(screen.getByLabelText('Back Icon'));
        expect(goBack).toHaveBeenCalled();
    });
});
