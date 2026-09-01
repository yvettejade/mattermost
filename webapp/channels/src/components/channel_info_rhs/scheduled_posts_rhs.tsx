// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import {WithTooltip} from '@mattermost/shared/components/tooltip';
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

import './scheduled_posts_rhs.scss';

export type ScheduledPostsRhsProps = {
    channel: Channel;
    scheduledPosts: ScheduledPost[];
    currentUser: UserProfile;
    userDisplayName: string;
    userStatus: UserStatus['status'];
    canGoBack: boolean;
    onClose: () => void;
    onBack: () => void;
};

const HeaderTitle = styled.span`
    line-height: 2.4rem;
`;

export function ScheduledPostsRhs({
    channel,
    scheduledPosts,
    currentUser,
    userDisplayName,
    userStatus,
    canGoBack,
    onClose,
    onBack,
}: ScheduledPostsRhsProps) {
    const {formatMessage} = useIntl();

    return (
        <div
            id='rhsContainer'
            className='sidebar-right__body ScheduledPostsRhs'
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
                                id='channel_info_rhs.scheduled_posts.header.title'
                                defaultMessage='Scheduled posts'
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
            <div className='ScheduledPostsRhs__body'>
                <ScheduledPostList
                    scheduledPosts={scheduledPosts}
                    currentUser={currentUser}
                    userDisplayName={userDisplayName}
                    userStatus={userStatus}
                />
            </div>
        </div>
    );
}

export function getChannelScheduledPosts(state: GlobalState, channelId: string): ScheduledPost[] {
    const ids = state.entities.scheduledPosts.byChannelOrThreadId[channelId] || [];
    const posts = ids.reduce<ScheduledPost[]>((result, id) => {
        const scheduledPost = state.entities.scheduledPosts.byId[id];
        if (scheduledPost && scheduledPost.channel_id === channelId) {
            result.push(scheduledPost);
        }
        return result;
    }, []);

    posts.sort((a, b) => a.scheduled_at - b.scheduled_at || a.create_at - b.create_at);
    return posts;
}

export default function ScheduledPostsRhsContainer() {
    const dispatch = useDispatch();
    const channel = useSelector(getCurrentChannel);
    const previousRhsState = useSelector(getPreviousRhsState);
    const currentUser = useSelector(getCurrentUser);
    const userStatus = useSelector((state: GlobalState) => getStatusForUserId(state, currentUser.id));
    const teammateNameDisplaySetting = useSelector(getTeammateNameDisplaySetting);
    const userDisplayName = useMemo(
        () => displayUsername(currentUser, teammateNameDisplaySetting),
        [currentUser, teammateNameDisplaySetting],
    );
    const scheduledPosts = useSelector((state: GlobalState) => (
        channel ? getChannelScheduledPosts(state, channel.id) : []
    ));

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
        <ScheduledPostsRhs
            channel={channel}
            scheduledPosts={scheduledPosts}
            currentUser={currentUser}
            userDisplayName={userDisplayName}
            userStatus={userStatus}
            canGoBack={Boolean(previousRhsState)}
            onClose={handleClose}
            onBack={handleBack}
        />
    );
}
