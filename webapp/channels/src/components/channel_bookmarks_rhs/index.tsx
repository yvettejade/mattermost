// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';

import {closeRightHandSide, goBack} from 'actions/views/rhs';
import {getPreviousRhsState} from 'selectors/rhs';

import {
    MAX_BOOKMARKS_PER_CHANNEL,
    useCanUploadFiles,
    useChannelBookmarkPermission,
    useChannelBookmarks,
} from 'components/channel_bookmarks/utils';

import ChannelBookmarksRhs from './channel_bookmarks_rhs';

export default function ChannelBookmarksRhsContainer() {
    const dispatch = useDispatch();
    const channel = useSelector(getCurrentChannel);
    const previousRhsState = useSelector(getPreviousRhsState);
    const canGoBack = Boolean(previousRhsState);

    const channelId = channel?.id ?? '';
    const {order, bookmarks} = useChannelBookmarks(channelId);
    const canAdd = Boolean(useChannelBookmarkPermission(channelId, 'add'));
    const canUploadFiles = useCanUploadFiles();
    const orderedBookmarks = order.map((id) => bookmarks[id]).filter((bookmark): bookmark is NonNullable<typeof bookmark> => Boolean(bookmark));
    const limitReached = order.length >= MAX_BOOKMARKS_PER_CHANNEL;

    if (!channel) {
        return null;
    }

    return (
        <ChannelBookmarksRhs
            channel={channel}
            canGoBack={canGoBack}
            bookmarks={orderedBookmarks}
            canAdd={canAdd}
            canUploadFiles={canUploadFiles}
            limitReached={limitReached}
            actions={{
                closeRightHandSide: () => dispatch(closeRightHandSide()),
                goBack: () => dispatch(goBack()),
            }}
        />
    );
}
