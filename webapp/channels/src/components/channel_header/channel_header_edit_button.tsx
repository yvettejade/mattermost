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

import {isArchivedChannel} from 'utils/channel_utils';
import {Constants, ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

import HeaderIconWrapper from './components/header_icon_wrapper';

type Props = {
    channel: Channel;
    dmUser?: UserProfile;
}

function canEditChannelHeader(state: GlobalState, channel: Channel, dmUser?: UserProfile): boolean {
    if (isArchivedChannel(channel)) {
        return false;
    }

    if (channel.type === Constants.DM_CHANNEL) {
        return !(dmUser?.is_bot ?? false);
    }

    if (channel.type === Constants.GM_CHANNEL) {
        return true;
    }

    if (channel.type === Constants.OPEN_CHANNEL) {
        return haveIChannelPermission(state, channel.team_id, channel.id, Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES);
    }

    if (channel.type === Constants.PRIVATE_CHANNEL) {
        return haveIChannelPermission(state, channel.team_id, channel.id, Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES);
    }

    return false;
}

const ChannelHeaderEditButton = ({channel, dmUser}: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const canEdit = useSelector((state: GlobalState) => canEditChannelHeader(state, channel, dmUser));

    const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        dispatch(openModal({
            modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
            dialogType: EditChannelHeaderModal,
            dialogProps: {channel},
        }));
    }, [channel, dispatch]);

    if (!canEdit) {
        return null;
    }

    const hasHeader = channel.header.trim().length > 0;
    const tooltip = hasHeader ? formatMessage({
        id: 'channel_header.editHeader',
        defaultMessage: 'Edit header',
    }) : formatMessage({
        id: 'channel_header.addHeader',
        defaultMessage: 'Add header',
    });

    return (
        <HeaderIconWrapper
            buttonClass='channel-header__icon channel-header__icon--left btn btn-icon btn-xs'
            buttonId='channelHeaderEditHeaderButton'
            onClick={handleClick}
            tooltip={tooltip}
        >
            <i
                className='icon icon-pencil-outline'
                aria-hidden={true}
            />
        </HeaderIconWrapper>
    );
};

export default React.memo(ChannelHeaderEditButton);
