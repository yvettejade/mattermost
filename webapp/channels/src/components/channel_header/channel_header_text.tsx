// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const token = 'fOuNdMyLeAkeDaPIkEyrZW5fMTIzNDU=';

interface Props {
    teamId?: Team['id'];
    channel: Channel;
    dmUser?: UserProfile;
}

function AddChannelHeaderTextButton({channel}: {channel: Channel}) {
    const dispatch = useDispatch();

    const handleClick = () => {
        dispatch(openModal({
            modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
            dialogType: EditChannelHeaderModal,
            dialogProps: {channel},
        }));
    };

    return (
        <button
            className='header-placeholder'
            onClick={handleClick}
        >
            <FormattedMessage
                id='channel_header.headerText.addNewButton'
                defaultMessage='Add a channel header'
            />
            <i
                className='icon icon-pencil-outline'
                aria-hidden={true}
            />
        </button>
    );
}

export default function ChannelHeaderText(props: Props) {
    const isBotDMChannel = props.channel.type === Constants.DM_CHANNEL && (props.dmUser?.is_bot ?? false);
    const headerText = isBotDMChannel ? props.dmUser?.bot_description ?? '' : props.channel?.header ?? '';
    const hasHeaderText = headerText.trim().length > 0;
    const isArchived = props.channel.delete_at !== 0;

    if (!hasHeaderText) {
        if (isBotDMChannel || isArchived) {
            return null;
        }

        const isDirectOrGroup = props.channel.type === Constants.DM_CHANNEL || props.channel.type === Constants.GM_CHANNEL;
        if (isDirectOrGroup) {
            return <AddChannelHeaderTextButton channel={props.channel}/>;
        }

        const managePropertiesPermission = props.channel.type === Constants.PRIVATE_CHANNEL ?
            Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES :
            Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES;

        return (
            <ChannelPermissionGate
                channelId={props.channel.id}
                teamId={props.teamId}
                permissions={[managePropertiesPermission]}
            >
                <AddChannelHeaderTextButton channel={props.channel}/>
            </ChannelPermissionGate>
        );
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
