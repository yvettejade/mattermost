// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';

import type {Channel} from '@mattermost/types/channels';

import BookmarkItemContent from 'components/channel_bookmarks/bookmark_item_content';
import {useBookmarkAddActions} from 'components/channel_bookmarks/channel_bookmarks_menu';
import {MAX_BOOKMARKS_PER_CHANNEL, useChannelBookmarkPermission, useChannelBookmarks} from 'components/channel_bookmarks/utils';
import Scrollbars from 'components/common/scrollbars';

import Header from './header';

export interface Props {
    channel: Channel;
    isArchived: boolean;
    canGoBack: boolean;
    actions: {
        closeRightHandSide: () => void;
        goBack: () => void;
    };
}

const ChannelBookmarksRHS = ({
    channel,
    isArchived,
    canGoBack,
    actions,
}: Props) => {
    const {bookmarks, order} = useChannelBookmarks(channel.id);
    const canAdd = useChannelBookmarkPermission(channel.id, 'add');
    const {handleCreateLink} = useBookmarkAddActions(channel.id);
    const showAdd = canAdd && !isArchived && order.length < MAX_BOOKMARKS_PER_CHANNEL;

    return (
        <div
            id='rhsContainer'
            className='sidebar-right__body'
        >
            <Header
                channel={channel}
                canGoBack={canGoBack}
                onClose={actions.closeRightHandSide}
                goBack={actions.goBack}
            />
            <Scrollbars color='--center-channel-color-rgb'>
                <Container data-testid='channel_bookmarks_rhs'>
                    {showAdd && (
                        <AddButton
                            type='button'
                            onClick={handleCreateLink}
                        >
                            <i className='icon icon-plus'/>
                            <FormattedMessage
                                id='channel_bookmarks.addBookmark'
                                defaultMessage='Add a bookmark'
                            />
                        </AddButton>
                    )}
                    {order.length === 0 ? (
                        <EmptyState>
                            <FormattedMessage
                                id='channel_bookmarks_rhs.empty.title'
                                defaultMessage='No bookmarks yet'
                            />
                            <EmptyDescription>
                                <FormattedMessage
                                    id='channel_bookmarks_rhs.empty.description'
                                    defaultMessage='Save important links and files for this channel.'
                                />
                            </EmptyDescription>
                        </EmptyState>
                    ) : (
                        <BookmarkList>
                            {order.map((bookmarkId) => {
                                const bookmark = bookmarks[bookmarkId];
                                if (!bookmark) {
                                    return null;
                                }

                                return (
                                    <BookmarkRow
                                        key={bookmark.id}
                                        data-testid={`channel_bookmarks_rhs-item-${bookmark.id}`}
                                    >
                                        <BookmarkItemContent
                                            bookmark={bookmark}
                                            disableInteractions={false}
                                        />
                                    </BookmarkRow>
                                );
                            })}
                        </BookmarkList>
                    )}
                </Container>
            </Scrollbars>
        </div>
    );
};

export default ChannelBookmarksRHS;

const Container = styled.div`
    display: flex;
    flex-direction: column;
    padding: 16px 0;
`;

const AddButton = styled.button`
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 16px 12px;
    padding: 8px 16px;
    width: fit-content;
    border: none;
    border-radius: 4px;
    background: var(--button-bg);
    color: var(--button-color);
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
    cursor: pointer;

    &:hover,
    &:active,
    &:focus {
        background: linear-gradient(0deg, rgba(var(--center-channel-color-rgb), 0.16), rgba(var(--center-channel-color-rgb), 0.16)), var(--button-bg);
        color: var(--button-color);
    }
`;

const EmptyState = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32px 24px;
    color: rgba(var(--center-channel-color-rgb), 0.75);
    text-align: center;
    font-size: 14px;
    line-height: 20px;
`;

const EmptyDescription = styled.div`
    margin-top: 8px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

const BookmarkList = styled.ul`
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
`;

const BookmarkRow = styled.li`
    padding: 4px 16px;

    & > div {
        width: 100%;
    }
`;
