// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {ScheduledPost} from '@mattermost/types/schedule_post';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/common';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getStatusForUserId} from 'mattermost-redux/selectors/entities/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {closeRightHandSide, goBack} from 'actions/views/rhs';
import {getPreviousRhsState} from 'selectors/rhs';

import type {GlobalState} from 'types/store';

import ChannelScheduledPostsRhs from './channel_scheduled_posts_rhs';

const EMPTY_IDS: string[] = [];
const EMPTY_POSTS: ScheduledPost[] = [];

const getScheduledPostsForChannel = createSelector(
    'getScheduledPostsForChannel',
    (state: GlobalState, channelId: string) => state.entities.scheduledPosts.byChannelOrThreadId[channelId] || EMPTY_IDS,
    (state: GlobalState) => state.entities.scheduledPosts.byId,
    (ids, byId) => {
        const scheduledPosts = ids.reduce<ScheduledPost[]>((result, id) => {
            const scheduledPost = byId[id];
            if (scheduledPost) {
                result.push(scheduledPost);
            }
            return result;
        }, []);

        scheduledPosts.sort((a, b) => a.scheduled_at - b.scheduled_at || a.create_at - b.create_at);
        return scheduledPosts;
    },
);

export default function ChannelScheduledPostsRhsContainer() {
    const dispatch = useDispatch();
    const channel = useSelector(getCurrentChannel);
    const previousRhsState = useSelector(getPreviousRhsState);
    const canGoBack = Boolean(previousRhsState);
    const currentUser = useSelector(getCurrentUser);
    const userStatus = useSelector((state: GlobalState) => (
        currentUser ? getStatusForUserId(state, currentUser.id) : ''
    ));
    const teammateNameDisplaySetting = useSelector(getTeammateNameDisplaySetting);
    const userDisplayName = useMemo(
        () => (currentUser ? displayUsername(currentUser, teammateNameDisplaySetting) : ''),
        [currentUser, teammateNameDisplaySetting],
    );
    const scheduledPosts = useSelector((state: GlobalState) => (
        channel ? getScheduledPostsForChannel(state, channel.id) : EMPTY_POSTS
    ));

    if (!channel || !currentUser) {
        return null;
    }

    return (
        <ChannelScheduledPostsRhs
            channel={channel}
            canGoBack={canGoBack}
            scheduledPosts={scheduledPosts}
            currentUser={currentUser}
            userDisplayName={userDisplayName}
            userStatus={userStatus || ''}
            actions={{
                closeRightHandSide: () => dispatch(closeRightHandSide()),
                goBack: () => dispatch(goBack()),
            }}
        />
    );
}
