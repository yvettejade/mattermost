// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import {getChannelBookmarks} from 'mattermost-redux/selectors/entities/channel_bookmarks';

import {
    DynamicLink,
    useBookmarkLink,
} from 'components/channel_bookmarks/bookmark_item_content';

import type {GlobalState} from 'types/store';

const List = styled.ul`
    list-style: none;
    margin: 0;
    padding: 0 16px 8px 40px;
    width: 100%;
`;

const ListItem = styled.li`
    min-width: 0;
    padding: 4px 0;

    a,
    span[role='link'] {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        color: rgb(var(--center-channel-color-rgb));
        text-decoration: none;

        &:hover {
            color: rgb(var(--center-channel-color-rgb));
            text-decoration: none;
        }
    }
`;

const EmptyState = styled.div`
    padding: 4px 16px 12px 40px;
    color: rgba(var(--center-channel-color-rgb), 0.75);
    font-size: 13px;
    line-height: 20px;
`;

const Label = styled.span`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

type BookmarkRowProps = {
    bookmark: ReturnType<typeof getChannelBookmarks>[string];
};

function BookmarkRow({bookmark}: BookmarkRowProps) {
    const {href, onClick, linkRef, isFile, icon, displayName} = useBookmarkLink(bookmark, false);

    return (
        <ListItem>
            <DynamicLink
                href={href}
                onClick={onClick}
                ref={linkRef}
                isFile={isFile}
            >
                {icon}
                <Label>{displayName}</Label>
            </DynamicLink>
        </ListItem>
    );
}

type Props = {
    channelId: string;
};

export default function BookmarksSection({channelId}: Props) {
    const bookmarks = useSelector((state: GlobalState) => getChannelBookmarks(state, channelId));
    const order = Object.keys(bookmarks).sort((a, b) => bookmarks[a].sort_order - bookmarks[b].sort_order);

    if (order.length === 0) {
        return (
            <EmptyState>
                <FormattedMessage
                    id='channel_info_rhs.menu.bookmarks.empty'
                    defaultMessage='No bookmarks yet'
                />
            </EmptyState>
        );
    }

    return (
        <List data-testid='channel_info_rhs-bookmarks-list'>
            {order.map((bookmarkId) => (
                <BookmarkRow
                    key={bookmarkId}
                    bookmark={bookmarks[bookmarkId]}
                />
            ))}
        </List>
    );
}
