// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';
import type {Channel} from '@mattermost/types/channels';

import {renderWithContext, screen, userEvent, waitForElementToBeRemoved} from 'tests/react_testing_utils';

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
    const onAddLink = jest.fn();
    const onAddFile = jest.fn();

    beforeEach(() => {
        goBack.mockClear();
        onClose.mockClear();
        onAddLink.mockClear();
        onAddFile.mockClear();
    });

    const defaultViewProps = {
        channel,
        canGoBack: true,
        onClose,
        goBack,
        onAddLink,
        onAddFile,
        canUploadFiles: true,
    };

    test('shows empty list copy when there are no bookmarks and add is blocked', () => {
        renderWithContext(
            <ChannelBookmarksRhsView
                {...defaultViewProps}
                bookmarks={[]}
                canAdd={false}
            />,
        );

        expect(screen.getByText('No bookmarks')).toBeInTheDocument();
        expect(screen.queryByText('Add a bookmark')).not.toBeInTheDocument();
        expect(screen.queryByTestId(/bookmark-item-/)).not.toBeInTheDocument();
    });

    test('empty add control offers both link and file bookmarks', async () => {
        renderWithContext(
            <ChannelBookmarksRhsView
                {...defaultViewProps}
                bookmarks={[]}
                canAdd={true}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Add a bookmark'}));

        await userEvent.click(screen.getByText('Add a link'));
        await waitForElementToBeRemoved(() => screen.queryByText('Add a link'));
        expect(onAddLink).toHaveBeenCalled();

        await userEvent.click(screen.getByRole('button', {name: 'Add a bookmark'}));
        await userEvent.click(screen.getByText('Attach a file'));
        await waitForElementToBeRemoved(() => screen.queryByText('Attach a file'));
        expect(onAddFile).toHaveBeenCalled();
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
                {...defaultViewProps}
                bookmarks={bookmarks}
                canAdd={true}
            />,
        );

        expect(screen.getByTestId('bookmark-item-bm1')).toHaveTextContent('Docs');
        expect(screen.getByTestId('bookmark-item-bm2')).toHaveTextContent('Spec');
    });

    test('Back calls goBack', async () => {
        renderWithContext(
            <ChannelBookmarksRhsView
                {...defaultViewProps}
                bookmarks={[]}
                canAdd={false}
            />,
        );

        await userEvent.click(screen.getByLabelText('Back Icon'));
        expect(goBack).toHaveBeenCalled();
    });
});
