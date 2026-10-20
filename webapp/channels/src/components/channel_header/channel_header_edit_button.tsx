// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';

import {Permissions} from 'mattermost-redux/constants';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';

import {openModal} from 'actions/views/modals';

import ChannelSettingsModal from 'components/channel_settings_modal/channel_settings_modal';

import Constants, {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

import HeaderIconWrapper from './components/header_icon_wrapper';

type Props = {
    channel: Channel;
};

const ChannelHeaderEditButton = ({channel}: Props) => {
    const intl = useIntl();
    const dispatch = useDispatch();

    // Mirrors the Info tab visibility rule in ChannelSettingsModal, which hosts the header editor.
    const canEditHeader = useSelector((state: GlobalState) => {
        if (channel.type === Constants.DM_CHANNEL || channel.type === Constants.GM_CHANNEL) {
            return true;
        }
        const permission = channel.type === Constants.PRIVATE_CHANNEL ? Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES : Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES;
        return haveIChannelPermission(state, channel.team_id, channel.id, permission);
    });

    const openHeaderEditor = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.CHANNEL_SETTINGS,
            dialogType: ChannelSettingsModal,
            dialogProps: {
                channelId: channel.id,
                focusOriginElement: 'channelHeaderEditButton',
                isOpen: true,
            },
        }));
    }, [dispatch, channel.id]);

    if (!canEditHeader || channel.delete_at !== 0) {
        return null;
    }

    return (
        <HeaderIconWrapper
            buttonClass='channel-header__icon channel-header__icon--left btn btn-icon btn-xs'
            buttonId='channelHeaderEditButton'
            onClick={openHeaderEditor}
            tooltip={intl.formatMessage({id: 'channel_header.editHeader', defaultMessage: 'Edit channel header'})}
        >
            <i
                aria-hidden='true'
                className='icon icon-pencil-outline'
            />
        </HeaderIconWrapper>
    );
};

export default ChannelHeaderEditButton;
