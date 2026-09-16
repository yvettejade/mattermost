// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {Permissions} from 'mattermost-redux/constants';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';

import {openModal} from 'actions/views/modals';

import EditChannelHeaderModal from 'components/edit_channel_header_modal';

import {Constants, ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

import HeaderIconWrapper from './components/header_icon_wrapper';

type Props = {
    channel: Channel;
    dmUser?: UserProfile;
};

function shouldShowChannelHeaderEditButton(channel: Channel, dmUser?: UserProfile): boolean {
    if (channel.delete_at !== 0) {
        return false;
    }

    if (channel.type === Constants.DM_CHANNEL) {
        return !dmUser?.is_bot;
    }

    if (channel.type === Constants.GM_CHANNEL) {
        return true;
    }

    return channel.type === Constants.OPEN_CHANNEL || channel.type === Constants.PRIVATE_CHANNEL;
}

export default function ChannelHeaderEditButton({channel, dmUser}: Props) {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    const canManageProperties = useSelector((state: GlobalState) => {
        const permission = channel.type === Constants.PRIVATE_CHANNEL ?
            Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES :
            Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES;
        return haveIChannelPermission(state, channel.team_id, channel.id, permission);
    });

    const isDirectOrGroup = channel.type === Constants.DM_CHANNEL || channel.type === Constants.GM_CHANNEL;
    const isVisible = shouldShowChannelHeaderEditButton(channel, dmUser) && (isDirectOrGroup || canManageProperties);

    const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        dispatch(openModal({
            modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
            dialogType: EditChannelHeaderModal,
            dialogProps: {channel},
        }));
    }, [channel, dispatch]);

    if (!isVisible) {
        return null;
    }

    const hasHeader = channel.header.trim().length > 0;
    const tooltip = hasHeader ?
        formatMessage({id: 'channel_header.editHeader', defaultMessage: 'Edit header'}) :
        formatMessage({id: 'channel_header.addHeader', defaultMessage: 'Add header'});

    return (
        <HeaderIconWrapper
            buttonClass='channel-header__icon channel-header__icon--left btn btn-icon btn-xs'
            buttonId='channelHeaderEditHeaderButton'
            onClick={handleClick}
            tooltip={tooltip}
        >
            <i
                aria-hidden='true'
                className='icon icon-pencil-outline'
            />
        </HeaderIconWrapper>
    );
}
