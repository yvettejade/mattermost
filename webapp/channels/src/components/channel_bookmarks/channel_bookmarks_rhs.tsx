// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';
import type {Channel} from '@mattermost/types/channels';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';

import {closeRightHandSide, goBack} from 'actions/views/rhs';
import {getPreviousRhsState} from 'selectors/rhs';

import BookmarkItemContent from './bookmark_item_content';
import {useBookmarkAddActions} from './channel_bookmarks_menu';
import {MAX_BOOKMARKS_PER_CHANNEL, useChannelBookmarkPermission, useChannelBookmarks} from './utils';

import './channel_bookmarks_rhs.scss';

export type ChannelBookmarksRhsProps = {
    channel: Channel;
    bookmarks: Record<string, ChannelBookmark>;
    order: string[];
    canAdd: boolean;
    canGoBack: boolean;
    onClose: () => void;
    onBack: () => void;
    onAddLink: () => void;
};

const HeaderTitle = styled.span`
    line-height: 2.4rem;
`;

export function ChannelBookmarksRhs({
    channel,
    bookmarks,
    order,
    canAdd,
    canGoBack,
    onClose,
    onBack,
    onAddLink,
}: ChannelBookmarksRhsProps) {
    const {formatMessage} = useIntl();
    const hasBookmarks = order.length > 0;
    const limitReached = order.length >= MAX_BOOKMARKS_PER_CHANNEL;

    return (
        <div
            id='rhsContainer'
            className='sidebar-right__body ChannelBookmarksRhs'
        >
            <div className='sidebar--right__header'>
                <span className='sidebar--right__title'>
                    {canGoBack && (
                        <button
                            className='sidebar--right__back btn btn-icon btn-sm'
                            onClick={onBack}
                            aria-label={formatMessage({id: 'rhs_header.back.icon', defaultMessage: 'Back Icon'})}
                        >
                            <i className='icon icon-arrow-back-ios'/>
                        </button>
                    )}
                    <h2>
                        <HeaderTitle id='rhsPanelTitle'>
                            <FormattedMessage
                                id='channel_bookmarks_rhs.header.title'
                                defaultMessage='Bookmarks'
                            />
                        </HeaderTitle>
                        {channel.display_name && (
                            <span className='style--none sidebar--right__title__subtitle'>
                                {channel.display_name}
                            </span>
                        )}
                    </h2>
                </span>
                <WithTooltip
                    title={
                        <FormattedMessage
                            id='rhs_header.closeSidebarTooltip'
                            defaultMessage='Close'
                        />
                    }
                >
                    <button
                        id='rhsCloseButton'
                        type='button'
                        className='sidebar--right__close btn btn-icon btn-sm'
                        aria-label={formatMessage({id: 'rhs_header.closeTooltip.icon', defaultMessage: 'Close Sidebar Icon'})}
                        onClick={onClose}
                    >
                        <i className='icon icon-close'/>
                    </button>
                </WithTooltip>
            </div>
            <div className='ChannelBookmarksRhs__body'>
                {canAdd && !limitReached && (
                    <button
                        type='button'
                        className='ChannelBookmarksRhs__add'
                        onClick={onAddLink}
                    >
                        <i className='icon icon-plus'/>
                        <FormattedMessage
                            id='channel_bookmarks.addBookmark'
                            defaultMessage='Add a bookmark'
                        />
                    </button>
                )}
                {hasBookmarks ? (
                    <ul className='ChannelBookmarksRhs__list'>
                        {order.map((id) => {
                            const bookmark = bookmarks[id];
                            if (!bookmark) {
                                return null;
                            }
                            return (
                                <li
                                    key={id}
                                    className='ChannelBookmarksRhs__item'
                                >
                                    <BookmarkItemContent
                                        bookmark={bookmark}
                                        disableInteractions={false}
                                    />
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <div className='ChannelBookmarksRhs__empty'>
                        <FormattedMessage
                            id='channel_bookmarks.addBookmark'
                            defaultMessage='Add a bookmark'
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ChannelBookmarksRhsContainer() {
    const dispatch = useDispatch();
    const channel = useSelector(getCurrentChannel);
    const previousRhsState = useSelector(getPreviousRhsState);
    const {bookmarks, order} = useChannelBookmarks(channel?.id || '');
    const canAdd = Boolean(useChannelBookmarkPermission(channel?.id || '', 'add'));
    const {handleCreateLink} = useBookmarkAddActions(channel?.id || '');

    const handleClose = useCallback(() => {
        dispatch(closeRightHandSide());
    }, [dispatch]);

    const handleBack = useCallback(() => {
        dispatch(goBack());
    }, [dispatch]);

    if (!channel) {
        return null;
    }

    return (
        <ChannelBookmarksRhs
            channel={channel}
            bookmarks={bookmarks}
            order={order}
            canAdd={canAdd}
            canGoBack={Boolean(previousRhsState)}
            onClose={handleClose}
            onBack={handleBack}
            onAddLink={handleCreateLink}
        />
    );
}
