// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import Constants from 'utils/constants';

import ChannelBookmarksRHS from './channel_bookmarks_rhs';

const mockUseChannelBookmarks = jest.fn();
const mockUseChannelBookmarkPermission = jest.fn();
const mockHandleCreateLink = jest.fn();

jest.mock('components/channel_bookmarks/utils', () => ({
    ...jest.requireActual('components/channel_bookmarks/utils'),
    useChannelBookmarks: (...args: unknown[]) => mockUseChannelBookmarks(...args),
    useChannelBookmarkPermission: (...args: unknown[]) => mockUseChannelBookmarkPermission(...args),
    MAX_BOOKMARKS_PER_CHANNEL: 50,
}));

jest.mock('components/channel_bookmarks/channel_bookmarks_menu', () => ({
    useBookmarkAddActions: () => ({
        handleCreateLink: mockHandleCreateLink,
        handleCreateFile: jest.fn(),
    }),
}));

jest.mock('components/channel_bookmarks/bookmark_item_content', () => ({
    __esModule: true,
    default: ({bookmark}: {bookmark: {id: string; display_name: string}}) => (
        <div data-testid={`bookmark-item-content-${bookmark.id}`}>{bookmark.display_name}</div>
    ),
}));

jest.mock('components/common/scrollbars', () => ({
    __esModule: true,
    default: ({children}: {children: React.ReactNode}) => <div>{children}</div>,
}));

describe('channel_bookmarks_rhs', () => {
    const channel = {
        id: 'channel_id',
        display_name: 'Town Square',
        type: Constants.OPEN_CHANNEL,
        delete_at: 0,
    } as Channel;

    const defaultProps = {
        channel,
        isArchived: false,
        canGoBack: true,
        actions: {
            closeRightHandSide: jest.fn(),
            goBack: jest.fn(),
        },
    };

    beforeEach(() => {
        mockUseChannelBookmarks.mockReturnValue({
            bookmarks: {},
            order: [],
            reorder: jest.fn(),
        });
        mockUseChannelBookmarkPermission.mockReturnValue(true);
        mockHandleCreateLink.mockClear();
        defaultProps.actions = {
            closeRightHandSide: jest.fn(),
            goBack: jest.fn(),
        };
    });

    test('should show an empty state and add when permitted', async () => {
        renderWithContext(
            <ChannelBookmarksRHS
                {...defaultProps}
            />,
        );

        expect(screen.getByText('No bookmarks yet')).toBeInTheDocument();
        expect(screen.getByText('Add a bookmark')).toBeInTheDocument();

        await userEvent.click(screen.getByText('Add a bookmark'));
        expect(mockHandleCreateLink).toHaveBeenCalled();
    });

    test('should render bookmarks in order and reuse BookmarkItemContent', () => {
        mockUseChannelBookmarks.mockReturnValue({
            bookmarks: {
                bm2: {id: 'bm2', display_name: 'Second'},
                bm1: {id: 'bm1', display_name: 'First'},
            },
            order: ['bm1', 'bm2'],
            reorder: jest.fn(),
        });

        renderWithContext(
            <ChannelBookmarksRHS
                {...defaultProps}
            />,
        );

        expect(screen.queryByText('No bookmarks yet')).not.toBeInTheDocument();
        expect(screen.getByTestId('bookmark-item-content-bm1')).toHaveTextContent('First');
        expect(screen.getByTestId('bookmark-item-content-bm2')).toHaveTextContent('Second');
    });

    test('should hide add when archived', () => {
        renderWithContext(
            <ChannelBookmarksRHS
                {...defaultProps}
                isArchived={true}
            />,
        );

        expect(screen.queryByText('Add a bookmark')).not.toBeInTheDocument();
        expect(screen.getByText('No bookmarks yet')).toBeInTheDocument();
    });

    test('should hide add when the user cannot add bookmarks', () => {
        mockUseChannelBookmarkPermission.mockReturnValue(false);

        renderWithContext(
            <ChannelBookmarksRHS
                {...defaultProps}
            />,
        );

        expect(screen.queryByText('Add a bookmark')).not.toBeInTheDocument();
    });

    test('should hide add when the channel is at the bookmark limit', () => {
        const bookmarks: Record<string, {id: string; display_name: string}> = {};
        const order: string[] = [];
        for (let i = 0; i < 50; i++) {
            const id = `bm${i}`;
            bookmarks[id] = {id, display_name: `Bookmark ${i}`};
            order.push(id);
        }
        mockUseChannelBookmarks.mockReturnValue({
            bookmarks,
            order,
            reorder: jest.fn(),
        });

        renderWithContext(
            <ChannelBookmarksRHS
                {...defaultProps}
            />,
        );

        expect(screen.queryByText('Add a bookmark')).not.toBeInTheDocument();
    });

    test('should go back from the header', async () => {
        renderWithContext(
            <ChannelBookmarksRHS
                {...defaultProps}
            />,
        );

        await userEvent.click(screen.getByLabelText('Back Icon'));
        expect(defaultProps.actions.goBack).toHaveBeenCalled();
    });
});
