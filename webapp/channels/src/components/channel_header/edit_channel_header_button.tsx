// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';
import type {Channel} from '@mattermost/types/channels';

import {Permissions} from 'mattermost-redux/constants';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';

import {openModal} from 'actions/views/modals';

import {Constants, ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

import EditChannelHeaderModal from './edit_channel_header_modal';

import './edit_channel_header_button.scss';

type Props = {
    channel: Channel;
};

export default function EditChannelHeaderButton({channel}: Props) {
    const dispatch = useDispatch();

    const isPrivate = channel.type === Constants.PRIVATE_CHANNEL;
    const isPublic = channel.type === Constants.OPEN_CHANNEL;
    const permission = isPrivate ? Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES : Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES;

    const canEditHeader = useSelector((state: GlobalState) => {
        return haveIChannelPermission(state, channel.team_id, channel.id, permission);
    });

    const handleClick = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
            dialogType: EditChannelHeaderModal,
            dialogProps: {channel},
        }));
    }, [dispatch, channel]);

    if ((!isPublic && !isPrivate) || channel.delete_at !== 0 || !canEditHeader) {
        return null;
    }

    const hasHeader = channel.header.trim().length > 0;

    return (
        <Button
            id='channelHeaderEditHeaderButton'
            type='button'
            className='channel-header__edit-header-button'
            emphasis='tertiary'
            size='xs'
            onClick={handleClick}
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
}
