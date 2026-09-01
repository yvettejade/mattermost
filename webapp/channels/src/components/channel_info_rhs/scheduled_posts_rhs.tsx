// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import type {Channel} from '@mattermost/types/channels';
import type {ScheduledPost} from '@mattermost/types/schedule_post';
import type {UserProfile, UserStatus} from '@mattermost/types/users';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/common';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getStatusForUserId} from 'mattermost-redux/selectors/entities/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {closeRightHandSide, goBack} from 'actions/views/rhs';
import {getPreviousRhsState} from 'selectors/rhs';

import ScheduledPostList from 'components/drafts/scheduled_post_list';

import type {GlobalState} from 'types/store';

import SubpanelHeader from './subpanel_header';

const Body = styled.div`
    position: relative;
    flex: 1;
    min-height: 0;
`;

export function getScheduledPostsForChannel(state: GlobalState, channelId: string): ScheduledPost[] {
    // Index keys are root_id || channel_id, so thread replies live under the root post id.
    return Object.values(state.entities.scheduledPosts.byId).
        filter((post): post is ScheduledPost => Boolean(post) && post.channel_id === channelId).
        sort((a, b) => a.scheduled_at - b.scheduled_at || a.create_at - b.create_at);
}

export type ScheduledPostsRhsViewProps = {
    channel: Channel;
    scheduledPosts: ScheduledPost[];
    currentUser: UserProfile;
    userDisplayName: string;
    userStatus: UserStatus['status'];
    canGoBack: boolean;
    onClose: () => void;
    goBack: () => void;
};

export function ScheduledPostsRhsView({
    channel,
    scheduledPosts,
    currentUser,
    userDisplayName,
    userStatus,
    canGoBack,
    onClose,
    goBack: onGoBack,
}: ScheduledPostsRhsViewProps) {
    return (
        <div
            id='rhsContainer'
            className='sidebar-right__body'
        >
            <SubpanelHeader
                channel={channel}
                canGoBack={canGoBack}
                title={
                    <FormattedMessage
                        id='channel_info_rhs.menu.scheduled_posts'
                        defaultMessage='Scheduled posts'
                    />
                }
                onClose={onClose}
                goBack={onGoBack}
            />
            <Body>
                <ScheduledPostList
                    scheduledPosts={scheduledPosts}
                    currentUser={currentUser}
                    userDisplayName={userDisplayName}
                    userStatus={userStatus}
                />
            </Body>
        </div>
    );
}

export default function ScheduledPostsRhs() {
    const dispatch = useDispatch();
    const channel = useSelector(getCurrentChannel);
    const previousRhsState = useSelector(getPreviousRhsState);
    const scheduledPosts = useSelector((state: GlobalState) => (
        channel ? getScheduledPostsForChannel(state, channel.id) : []
    ));
    const currentUser = useSelector(getCurrentUser);
    const userStatus = useSelector((state: GlobalState) => getStatusForUserId(state, currentUser.id));
    const teammateNameDisplaySetting = useSelector(getTeammateNameDisplaySetting);
    const userDisplayName = useMemo(
        () => displayUsername(currentUser, teammateNameDisplaySetting),
        [currentUser, teammateNameDisplaySetting],
    );

    const handleClose = useCallback(() => {
        dispatch(closeRightHandSide());
    }, [dispatch]);

    const handleGoBack = useCallback(() => {
        dispatch(goBack());
    }, [dispatch]);

    if (!channel || !currentUser) {
        return null;
    }

    return (
        <ScheduledPostsRhsView
            channel={channel}
            scheduledPosts={scheduledPosts}
            currentUser={currentUser}
            userDisplayName={userDisplayName}
            userStatus={userStatus}
            canGoBack={Boolean(previousRhsState)}
            onClose={handleClose}
            goBack={handleGoBack}
        />
    );
}
