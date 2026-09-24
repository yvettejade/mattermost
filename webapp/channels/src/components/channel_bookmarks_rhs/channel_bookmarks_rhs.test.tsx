// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as rhsActions from 'actions/views/rhs';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {RHSStates} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ChannelBookmarksRhs from './channel_bookmarks_rhs';

jest.mock('components/channel_bookmarks/utils', () => ({
    useChannelBookmarks: jest.fn(),
}));

jest.mock('components/channel_bookmarks/bookmark_item_content', () => ({
    __esModule: true,
    default: ({bookmark}: {bookmark: {display_name: string}}) => <div>{bookmark.display_name}</div>,
}));

const {useChannelBookmarks} = require('components/channel_bookmarks/utils');

describe('channel_bookmarks_rhs', () => {
    const channel = TestHelper.getChannelMock({
        id: 'channel_id',
        display_name: 'Town Square',
    });

    beforeEach(() => {
        jest.spyOn(rhsActions, 'goBack').mockReturnValue(() => Promise.resolve({data: true}));
        jest.spyOn(rhsActions, 'closeRightHandSide').mockReturnValue(() => ({data: true}));
        useChannelBookmarks.mockReturnValue({
            order: ['bm1'],
            bookmarks: {
                bm1: {id: 'bm1', display_name: 'Docs'},
            },
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('renders bookmarks and goes back to Info', async () => {
        renderWithContext(
            <ChannelBookmarksRhs/>,
            {
                entities: {
                    channels: {
                        currentChannelId: channel.id,
                        channels: {
                            [channel.id]: channel,
                        },
                    },
                },
                views: {
                    rhs: {
                        previousRhsStates: [RHSStates.CHANNEL_INFO],
                    },
                },
            },
        );

        expect(screen.getByText('Bookmarks')).toBeInTheDocument();
        expect(screen.getByText('Docs')).toBeInTheDocument();

        await userEvent.click(screen.getByLabelText('Back Icon'));
        expect(rhsActions.goBack).toHaveBeenCalled();
    });

    test('shows an empty state when there are no bookmarks', () => {
        useChannelBookmarks.mockReturnValue({
            order: [],
            bookmarks: {},
        });

        renderWithContext(
            <ChannelBookmarksRhs/>,
            {
                entities: {
                    channels: {
                        currentChannelId: channel.id,
                        channels: {
                            [channel.id]: channel,
                        },
                    },
                },
            },
        );

        expect(screen.getByText('No bookmarks yet')).toBeInTheDocument();
    });
});
