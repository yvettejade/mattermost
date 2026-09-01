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

import Scrollbars from 'components/common/scrollbars';
import EmptyScheduledPostList from 'components/drafts/scheduled_post_list/empty_scheduled_post_list';
import NonVirtualizedScheduledPostList from 'components/drafts/scheduled_post_list/non_virtualized_scheduled_post_list';

import {RHSStates} from 'utils/constants';

import type {GlobalState} from 'types/store';

import 'components/drafts/scheduled_post_list/scheduled_post_list.scss';
import './scheduled_posts_rhs.scss';

const emptyIds: string[] = [];

export type Props = {
    channel: Channel;
    canGoBack: boolean;
    scheduledPosts: ScheduledPost[];
    currentUser: UserProfile;
    userDisplayName: string;
    userStatus: UserStatus['status'];
    actions: {
        closeRightHandSide: () => void;
        goBack: () => void;
    };
};

const HeaderTitle = styled.span`
    line-height: 2.4rem;
`;

function Header({
    channel,
    canGoBack,
    onClose,
    onBack,
}: {
    channel: Channel;
    canGoBack: boolean;
    onClose: () => void;
    onBack: () => void;
}) {
    const {formatMessage} = useIntl();

    return (
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
                            id='channel_info_rhs.menu.scheduled_posts'
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
    );
}

export function ChannelScheduledPostsRhs({
    channel,
    canGoBack,
    scheduledPosts,
    currentUser,
    userDisplayName,
    userStatus,
    actions,
}: Props) {
    return (
        <div
            id='rhsContainer'
            className='sidebar-right__body ChannelScheduledPostsRhs'
        >
            <Header
                channel={channel}
                canGoBack={canGoBack}
                onClose={actions.closeRightHandSide}
                onBack={actions.goBack}
            />
            <Scrollbars color='--center-channel-color-rgb'>
                <div className='ChannelScheduledPostsRhs__content'>
                    {scheduledPosts.length === 0 ? (
                        <EmptyScheduledPostList/>
                    ) : (
                        <div className='ScheduledPostList nonVirtualizedScheduledPostList'>
                            <NonVirtualizedScheduledPostList
                                scheduledPosts={scheduledPosts}
                                currentUser={currentUser}
                                userDisplayName={userDisplayName}
                                userStatus={userStatus}
                            />
                        </div>
                    )}
                </div>
            </Scrollbars>
        </div>
    );
}

function getScheduledPostsForChannel(state: GlobalState, channelId: string): ScheduledPost[] {
    const ids = state.entities.scheduledPosts.byChannelOrThreadId[channelId] || emptyIds;
    const posts: ScheduledPost[] = [];

    ids.forEach((id) => {
        const scheduledPost = state.entities.scheduledPosts.byId[id];
        if (scheduledPost) {
            posts.push(scheduledPost);
        }
    });

    posts.sort((a, b) => a.scheduled_at - b.scheduled_at || a.create_at - b.create_at);
    return posts;
}

function ChannelScheduledPostsRhsContainer() {
    const dispatch = useDispatch();
    const channel = useSelector(getCurrentChannel);
    const previousRhsState = useSelector(getPreviousRhsState);
    const canGoBack = previousRhsState === RHSStates.CHANNEL_INFO ||
        previousRhsState === RHSStates.CHANNEL_FILES ||
        previousRhsState === RHSStates.PIN ||
        previousRhsState === RHSStates.CHANNEL_MEMBERS;
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
        <ChannelScheduledPostsRhs
            channel={channel}
            canGoBack={canGoBack}
            scheduledPosts={scheduledPosts}
            currentUser={currentUser}
            userDisplayName={userDisplayName}
            userStatus={userStatus}
            actions={{
                closeRightHandSide: handleClose,
                goBack: handleGoBack,
            }}
        />
    );
}

export default ChannelScheduledPostsRhsContainer;
