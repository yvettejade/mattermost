// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import Permissions from 'mattermost-redux/constants/permissions';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';

import useGetFeatureFlagValue from 'components/common/hooks/useGetFeatureFlagValue';

import {Constants} from 'utils/constants';
import {isChannelNamesMap} from 'utils/text_formatting';

import type {GlobalState} from 'types/store';

import ChannelHeaderInlineEdit from './channel_header_inline_edit';
import {ChannelHeaderTextPopover} from './channel_header_text_popover';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const token = 'fOuNdMyLeAkeDaPIkEyrZW5fMTIzNDU=';

interface Props {
    teamId?: Team['id'];
    channel: Channel;
    dmUser?: UserProfile;
}

function useCanEditChannelHeader(channel: Channel, teamId?: Team['id']): boolean {
    return useSelector((state: GlobalState) => {
        if (channel.delete_at > 0) {
            return false;
        }
        if (channel.type === Constants.DM_CHANNEL || channel.type === Constants.GM_CHANNEL) {
            return true;
        }
        if (!teamId) {
            return false;
        }
        const permission = channel.type === Constants.PRIVATE_CHANNEL ? Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES : Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES;
        return haveIChannelPermission(state, teamId, channel.id, permission);
    });
}

export default function ChannelHeaderText(props: Props) {
    const isBotDMChannel = props.channel.type === Constants.DM_CHANNEL && (props.dmUser?.is_bot ?? false);
    const headerText = isBotDMChannel ? props.dmUser?.bot_description ?? '' : props.channel?.header ?? '';
    const hasHeaderText = headerText.trim().length > 0;
    const inlineEditEnabled = useGetFeatureFlagValue('ChannelHeaderInlineEdit') === 'true';
    const canEdit = useCanEditChannelHeader(props.channel, props.teamId);

    if (inlineEditEnabled && !isBotDMChannel && (hasHeaderText || canEdit)) {
        return (
            <ChannelHeaderInlineEdit
                channel={props.channel}
                headerText={headerText}
                canEdit={canEdit}
            />
        );
    }

    if (!hasHeaderText) {
        return null;
    }

    return (
        <ChannelHeaderTextPopover
            text={headerText}
            channelMentionsNameMap={
                isChannelNamesMap(props.channel?.props?.channel_mentions) ? props.channel.props.channel_mentions : undefined
            }
        />
    );
}
