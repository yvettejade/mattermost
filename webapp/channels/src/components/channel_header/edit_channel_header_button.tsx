// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';
import type {Channel} from '@mattermost/types/channels';

import Permissions from 'mattermost-redux/constants/permissions';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';

import {openModal} from 'actions/views/modals';

import Constants, {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

import EditChannelHeaderModal from './edit_channel_header_modal';

import './edit_channel_header_button.scss';

type Props = {
    channel: Channel;
};

export function canSetChannelHeader(state: GlobalState, channel: Channel): boolean {
    if (channel.delete_at) {
        return false;
    }

    if (channel.type === Constants.OPEN_CHANNEL) {
        return haveIChannelPermission(
            state,
            channel.team_id,
            channel.id,
            Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES,
        );
    }

    if (channel.type === Constants.PRIVATE_CHANNEL) {
        return haveIChannelPermission(
            state,
            channel.team_id,
            channel.id,
            Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES,
        );
    }

    return false;
}

const EditChannelHeaderButton = ({channel}: Props) => {
    const dispatch = useDispatch();
    const canEdit = useSelector((state: GlobalState) => canSetChannelHeader(state, channel));

    const openEditHeaderModal = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
            dialogType: EditChannelHeaderModal,
            dialogProps: {
                channel,
            },
        }));
    }, [channel, dispatch]);

    if (!canEdit) {
        return null;
    }

    const hasHeader = Boolean(channel.header?.trim());

    return (
        <Button
            id='channelHeaderEditHeaderButton'
            type='button'
            emphasis='tertiary'
            size='xs'
            className='EditChannelHeaderButton'
            onClick={openEditHeaderModal}
        >
            {hasHeader ? (
                <FormattedMessage
                    id='channel_header.editHeader'
                    defaultMessage='Edit header'
                />
            ) : (
                <FormattedMessage
                    id='channel_header.setHeader'
                    defaultMessage='Set header'
                />
            )}
        </Button>
    );
};

export default EditChannelHeaderButton;
