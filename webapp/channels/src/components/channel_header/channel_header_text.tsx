// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const token = 'fOuNdMyLeAkeDaPIkEyrZW5fMTIzNDU=';

const AddHeaderButton = styled(Button)`
    height: 24px;
    padding: 0;
    border: 0;
    background: transparent;
    color: rgba(var(--center-channel-color-rgb), 0.75);
    line-height: 16px;

    &:hover,
    &:focus {
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

    if (!hasHeaderText) {
        if (props.channel.delete_at !== 0 || isBotDMChannel) {
            return null;
        }

        const addHeaderButton = (
            <AddChannelHeaderTextButton channel={props.channel}/>
        );

        const managePropertiesPermission = getManagePropertiesPermission(props.channel);
        if (managePropertiesPermission) {
            return (
                <ChannelPermissionGate
                    channelId={props.channel.id}
                    teamId={props.teamId ?? props.channel.team_id}
                    permissions={[managePropertiesPermission]}
                >
                    {addHeaderButton}
                </ChannelPermissionGate>
            );
        }

        if ([Constants.DM_CHANNEL, Constants.GM_CHANNEL].includes(props.channel.type)) {
            return addHeaderButton;
        }

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

function AddChannelHeaderTextButton({channel}: {channel: Channel}) {
    const dispatch = useDispatch();
    const handleClick = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
            dialogType: EditChannelHeaderModal,
            dialogProps: {channel},
        }));
    }, [channel, dispatch]);

    return (
        <AddHeaderButton
            type='button'
            emphasis='tertiary'
            size='xs'
            onClick={handleClick}
        >
            <FormattedMessage
                id='channel_header.headerText.addNewButton'
                defaultMessage='Add a channel header'
            />
        </AddHeaderButton>
    );
}

function getManagePropertiesPermission(channel: Channel) {
    if (channel.type === Constants.OPEN_CHANNEL) {
        return Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES;
    }

    if (channel.type === Constants.PRIVATE_CHANNEL) {
        return Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES;
    }

    return '';
}
