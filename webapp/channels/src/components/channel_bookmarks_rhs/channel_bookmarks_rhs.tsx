// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';

import {closeRightHandSide, goBack} from 'actions/views/rhs';
import {getPreviousRhsState} from 'selectors/rhs';
import {getIsMobileView} from 'selectors/views/browser';

import BookmarkItemContent from 'components/channel_bookmarks/bookmark_item_content';
import {useChannelBookmarks} from 'components/channel_bookmarks/utils';
import Scrollbars from 'components/common/scrollbars';

import {RHSStates} from 'utils/constants';

import type {GlobalState} from 'types/store';

const HeaderTitle = styled.span`
    line-height: 2.4rem;
`;

const List = styled.div`
    display: flex;
    flex-direction: column;
    padding: 8px 0;
`;

const BookmarkRow = styled.div`
    padding: 4px 16px;
`;

const EmptyState = styled.div`
    padding: 24px 16px;
    color: rgba(var(--center-channel-color-rgb), 0.75);
    text-align: center;
`;

function ChannelBookmarksRhs() {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const channel = useSelector(getCurrentChannel);
    const isMobile = useSelector(getIsMobileView);
    const previousRhsState = useSelector((state: GlobalState) => getPreviousRhsState(state));
    const canGoBack = previousRhsState === RHSStates.CHANNEL_INFO || isMobile;

    const {order, bookmarks} = useChannelBookmarks(channel?.id || '');

    if (!channel) {
        return null;
    }

    const handleClose = () => {
        dispatch(closeRightHandSide());
    };

    const handleBack = () => {
        dispatch(goBack());
    };

    return (
        <div
            id='rhsContainer'
            className='sidebar-right__body'
        >
            <div className='sidebar--right__header'>
                <span className='sidebar--right__title'>
                    {canGoBack && (
                        <button
                            className='sidebar--right__back btn btn-icon btn-sm'
                            onClick={handleBack}
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
                        onClick={handleClose}
                    >
                        <i className='icon icon-close'/>
                    </button>
                </WithTooltip>
            </div>
            <Scrollbars color='--center-channel-color-rgb'>
                {order.length === 0 ? (
                    <EmptyState>
                        <FormattedMessage
                            id='channel_bookmarks_rhs.empty'
                            defaultMessage='No bookmarks yet'
                        />
                    </EmptyState>
                ) : (
                    <List>
                        {order.map((id) => {
                            const bookmark = bookmarks[id];
                            if (!bookmark) {
                                return null;
                            }
                            return (
                                <BookmarkRow key={id}>
                                    <BookmarkItemContent
                                        bookmark={bookmark}
                                        disableInteractions={false}
                                    />
                                </BookmarkRow>
                            );
                        })}
                    </List>
                )}
            </Scrollbars>
        </div>
    );
}

export default memo(ChannelBookmarksRhs);
