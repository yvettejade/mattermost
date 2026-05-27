// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';
import type {Channel} from '@mattermost/types/channels';
import type {GlobalState} from '@mattermost/types/store';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {Permissions} from 'mattermost-redux/constants';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';

import {openModal} from 'actions/views/modals';

import EditChannelHeaderModal from 'components/edit_channel_header_modal';

import {Constants, ModalIdentifiers} from 'utils/constants';
import {isChannelNamesMap} from 'utils/text_formatting';

import {ChannelHeaderTextPopover} from './channel_header_text_popover';

interface Props {
    teamId?: Team['id'];
    channel: Channel;
    dmUser?: UserProfile;
}

export default function ChannelHeaderText(props: Props) {
    const dispatch = useDispatch();
    const isBotDMChannel = props.channel.type === Constants.DM_CHANNEL && (props.dmUser?.is_bot ?? false);
    const headerText = isBotDMChannel ? props.dmUser?.bot_description ?? '' : props.channel?.header ?? '';
    const hasHeaderText = headerText.trim().length > 0;
    const canEditChannelProperties = useSelector((state: GlobalState) => {
        if (props.channel.delete_at || isBotDMChannel) {
            return false;
        }

        if (props.channel.type === Constants.DM_CHANNEL || props.channel.type === Constants.GM_CHANNEL) {
            return true;
        }

        if (props.channel.type !== Constants.OPEN_CHANNEL && props.channel.type !== Constants.PRIVATE_CHANNEL) {
            return false;
        }

        const permission = props.channel.type === Constants.PRIVATE_CHANNEL ? Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES : Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES;
        return haveIChannelPermission(state, props.teamId ?? props.channel.team_id, props.channel.id, permission);
    });

    const editChannelHeader = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
            dialogType: EditChannelHeaderModal,
            dialogProps: {channel: props.channel},
        }));
    }, [dispatch, props.channel]);

    if (!hasHeaderText) {
        if (canEditChannelProperties) {
            return (
                <Button
                    type='button'
                    className='style--none header-placeholder'
                    onClick={editChannelHeader}
                >
                    <span>
                        <FormattedMessage
                            id='channel_header.headerText.addNewButton'
                            defaultMessage='Add a channel header'
                        />
                    </span>
                    <i className='icon icon-pencil-outline'/>
                </Button>
            );
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
