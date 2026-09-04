// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import type {Channel} from '@mattermost/types/channels';
import type {ScheduledPost} from '@mattermost/types/schedule_post';
import type {UserProfile, UserStatus} from '@mattermost/types/users';

import ScheduledPostList from 'components/drafts/scheduled_post_list';

import Header from './header';

export interface Props {
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
}

const ChannelScheduledPostsRhs = ({
    channel,
    canGoBack,
    scheduledPosts,
    currentUser,
    userDisplayName,
    userStatus,
    actions,
}: Props) => {
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
            <ListWrap>
                <ScheduledPostList
                    scheduledPosts={scheduledPosts}
                    currentUser={currentUser}
                    userDisplayName={userDisplayName}
                    userStatus={userStatus}
                    hideErrorBanner={true}
                />
            </ListWrap>
        </div>
    );
};

export default ChannelScheduledPostsRhs;

const ListWrap = styled.div`
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
`;
