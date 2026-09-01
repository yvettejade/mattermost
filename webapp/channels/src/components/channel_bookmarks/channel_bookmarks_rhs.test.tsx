// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';
import type {Channel} from '@mattermost/types/channels';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {RHSStates} from 'utils/constants';

import ChannelBookmarksRhsContainer, {ChannelBookmarksRhs} from './channel_bookmarks_rhs';

jest.mock('./bookmark_item_content', () => ({
    __esModule: true,
    default: ({bookmark}: {bookmark: ChannelBookmark}) => (
        <div>{bookmark.display_name}</div>
    ),
}));

jest.mock('./channel_bookmarks_menu', () => ({
    useBookmarkAddActions: () => ({
        handleCreateLink: jest.fn(),
        handleCreateFile: jest.fn(),
    }),
}));

jest.mock('actions/channel_bookmarks', () => ({
    fetchChannelBookmarks: () => ({type: 'MOCK_FETCH_CHANNEL_BOOKMARKS'}),
}));

describe('channel_bookmarks_rhs', () => {
    const channel = {
        id: 'channel_id',
        display_name: 'Town Square',
        type: 'O',
    } as Channel;

    const bookmarkA: ChannelBookmark = {
        id: 'bm1',
        channel_id: 'channel_id',
        owner_id: 'user_id',
        type: 'link',
        display_name: 'Engineering docs',
        sort_order: 0,
        create_at: 1,
        update_at: 1,
        delete_at: 0,
    } as ChannelBookmark;

    const bookmarkB: ChannelBookmark = {
        id: 'bm2',
        channel_id: 'channel_id',
        owner_id: 'user_id',
        type: 'link',
        display_name: 'Release notes',
        sort_order: 1,
        create_at: 2,
        update_at: 2,
        delete_at: 0,
    } as ChannelBookmark;

    const defaultActions = {
        closeRightHandSide: jest.fn(),
        goBack: jest.fn(),
    };

    beforeEach(() => {
        defaultActions.closeRightHandSide.mockClear();
        defaultActions.goBack.mockClear();
    });

    test('shows an empty state when the channel has no bookmarks', () => {
        renderWithContext(
            <ChannelBookmarksRhs
                channel={channel}
                canGoBack={true}
                bookmarks={{}}
                order={[]}
                canAdd={false}
                canUploadFiles={false}
                actions={defaultActions}
            />,
        );

        expect(screen.getByText('Bookmarks')).toBeInTheDocument();
        expect(screen.getByText('No bookmarks in this channel')).toBeInTheDocument();
        expect(screen.queryByText('Engineering docs')).not.toBeInTheDocument();
    });

    test('lists ordered bookmarks when the channel has some', () => {
        renderWithContext(
            <ChannelBookmarksRhs
                channel={channel}
                canGoBack={true}
                bookmarks={{
                    bm1: bookmarkA,
                    bm2: bookmarkB,
                }}
                order={['bm1', 'bm2']}
                canAdd={false}
                canUploadFiles={false}
                actions={defaultActions}
            />,
        );

        expect(screen.getByText('Engineering docs')).toBeInTheDocument();
        expect(screen.getByText('Release notes')).toBeInTheDocument();
        expect(screen.queryByText('No bookmarks in this channel')).not.toBeInTheDocument();
    });

    test('calls goBack when Back is clicked', async () => {
        renderWithContext(
            <ChannelBookmarksRhs
                channel={channel}
                canGoBack={true}
                bookmarks={{}}
                order={[]}
                canAdd={false}
                canUploadFiles={false}
                actions={defaultActions}
            />,
        );

        await userEvent.click(screen.getByLabelText('Back Icon'));
        expect(defaultActions.goBack).toHaveBeenCalled();
    });

    describe('container back navigation', () => {
        const renderContainer = (previousRhsStates: string[]) => {
            return renderWithContext(
                <ChannelBookmarksRhsContainer/>,
                {
                    entities: {
                        channels: {
                            currentChannelId: channel.id,
                            channels: {
                                [channel.id]: channel,
                            },
                        },
                        channelBookmarks: {
                            byChannelId: {},
                        },
                    },
                    views: {
                        rhs: {
                            previousRhsStates,
                        },
                    },
                },
            );
        };

        test('shows Back when previousRhsState is Channel Info', () => {
            renderContainer([RHSStates.CHANNEL_INFO]);
            expect(screen.getByLabelText('Back Icon')).toBeInTheDocument();
        });

        test('shows Back when previousRhsState is Scheduled posts', () => {
            renderContainer([RHSStates.CHANNEL_SCHEDULED_POSTS]);
            expect(screen.getByLabelText('Back Icon')).toBeInTheDocument();
        });

        test('hides Back when previousRhsState is not an Info pane', () => {
            renderContainer([RHSStates.FLAG]);
            expect(screen.queryByLabelText('Back Icon')).not.toBeInTheDocument();
        });
    });
});
