// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';
import styled from 'styled-components';

import {Button} from '@mattermost/shared/components/button';
import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {Permissions} from 'mattermost-redux/constants';

import {openModal} from 'actions/views/modals';

import EditChannelHeaderModal from 'components/edit_channel_header_modal';
import ChannelPermissionGate from 'components/permissions_gates/channel_permission_gate';

import {Constants, ModalIdentifiers} from 'utils/constants';
import {isChannelNamesMap} from 'utils/text_formatting';

import {ChannelHeaderTextPopover} from './channel_header_text_popover';

const AddHeaderButton = styled(Button)`
    && {
        overflow: hidden;
        height: 24px;
        padding: 0;
        border: 0;
        background: transparent;
        color: rgba(var(--center-channel-color-rgb), 0.75);
        font-size: 12px;
        font-weight: 400;
        line-height: 24px;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    &&:hover,
    &&:focus {
        background: transparent;
        color: rgba(var(--center-channel-color-rgb), 0.88);
        text-decoration: underline;
    }
`;

interface Props {
    teamId?: Team['id'];
    channel: Channel;
    dmUser?: UserProfile;
}

export default function ChannelHeaderText(props: Props) {
    const isBotDMChannel = props.channel.type === Constants.DM_CHANNEL && (props.dmUser?.is_bot ?? false);
    const headerText = isBotDMChannel ? props.dmUser?.bot_description ?? '' : props.channel?.header ?? '';
    const hasHeaderText = headerText.trim().length > 0;

    if (hasHeaderText) {
        return (
            <ChannelHeaderTextPopover
                text={headerText}
                channelMentionsNameMap={
                    isChannelNamesMap(props.channel?.props?.channel_mentions) ? props.channel.props.channel_mentions : undefined
                }
            />
        );
    }

    if (props.channel.delete_at || isBotDMChannel) {
        return null;
    }

    if (props.channel.type === Constants.DM_CHANNEL || props.channel.type === Constants.GM_CHANNEL) {
        return <AddChannelHeaderTextButton channel={props.channel}/>;
    }

    const manageChannelPropertiesPermission = getManageChannelPropertiesPermission(props.channel);
    if (!manageChannelPropertiesPermission) {
        return null;
    }

    return (
        <ChannelPermissionGate
            channelId={props.channel.id}
            teamId={props.teamId}
            permissions={[manageChannelPropertiesPermission]}
        >
            <AddChannelHeaderTextButton channel={props.channel}/>
        </ChannelPermissionGate>
    );
}

type AddChannelHeaderTextButtonProps = {
    channel: Channel;
}

function AddChannelHeaderTextButton({channel}: AddChannelHeaderTextButtonProps) {
    const dispatch = useDispatch();

    const handleAddHeader = () => {
        dispatch(openModal({
            modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
            dialogType: EditChannelHeaderModal,
            dialogProps: {channel},
        }));
    };

    return (
        <AddHeaderButton
            type='button'
            className='header-description__text'
            emphasis='tertiary'
            size='xs'
            onClick={handleAddHeader}
        >
            <FormattedMessage
                id='channel_header.headerText.addNewButton'
                defaultMessage='Add a channel header'
            />
        </AddHeaderButton>
    );
}

function getManageChannelPropertiesPermission(channel: Channel) {
    if (channel.type === Constants.PRIVATE_CHANNEL) {
        return Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES;
    }

    if (channel.type === Constants.OPEN_CHANNEL) {
        return Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES;
    }

    return undefined;
}
