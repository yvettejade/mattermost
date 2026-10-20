// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useMemo, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {Permissions} from 'mattermost-redux/constants';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';

import {openModal} from 'actions/views/modals';

import ChannelSettingsModal from 'components/channel_settings_modal/channel_settings_modal';

import {Constants, ModalIdentifiers} from 'utils/constants';
import {isChannelNamesMap} from 'utils/text_formatting';

import type {GlobalState} from 'types/store';

import {getChannelHeaderDisplayText} from './channel_header_text';
import {ChannelHeaderTextPopover} from './channel_header_text_popover';
import HeaderIconWrapper from './components/header_icon_wrapper';
import {ChannelHeaderEmptyPopover} from './components/channel_header_empty_popover';

interface Props {
    teamId?: Team['id'];
    channel: Channel;
    dmUser?: UserProfile;
}

function useCanEditChannelHeader(teamId: Team['id'] | undefined, channel: Channel, dmUser?: UserProfile) {
    const isArchivedChannel = channel.delete_at !== 0;
    const isDirectChannel = channel.type === Constants.DM_CHANNEL;
    const isGroupChannel = channel.type === Constants.GM_CHANNEL;
    const isBotDMChannel = isDirectChannel && (dmUser?.is_bot ?? false);
    const isPrivateChannel = channel.type === Constants.PRIVATE_CHANNEL;

    const hasManagePermission = useSelector((state: GlobalState) => {
        if (!teamId) {
            return false;
        }
        return haveIChannelPermission(
            state,
            teamId,
            channel.id,
            isPrivateChannel ? Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES : Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES,
        );
    });

    return useMemo(() => {
        if (isArchivedChannel || isBotDMChannel) {
            return false;
        }
        if (isDirectChannel || isGroupChannel) {
            return true;
        }
        return hasManagePermission;
    }, [channel.id, hasManagePermission, isArchivedChannel, isBotDMChannel, isDirectChannel, isGroupChannel]);
}

export default function ChannelHeaderTextButton({teamId, channel, dmUser}: Props) {
    const dispatch = useDispatch();
    const intl = useIntl();
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [headerPopoverOpen, setHeaderPopoverOpen] = useState(false);
    const [emptyPopoverOpen, setEmptyPopoverOpen] = useState(false);

    const headerText = getChannelHeaderDisplayText(channel, dmUser);
    const hasHeaderText = headerText.trim().length > 0;
    const canEditChannelHeader = useCanEditChannelHeader(teamId, channel, dmUser);

    const openChannelSettings = useCallback(() => {
        dispatch(
            openModal({
                modalId: ModalIdentifiers.CHANNEL_SETTINGS,
                dialogType: ChannelSettingsModal,
                dialogProps: {
                    channelId: channel.id,
                    focusOriginElement: 'channelHeaderTextButton',
                    isOpen: true,
                },
            }),
        );
    }, [channel.id, dispatch]);

    const handleClick = useCallback(() => {
        if (hasHeaderText) {
            setEmptyPopoverOpen(false);
            setHeaderPopoverOpen((open) => !open);
            return;
        }

        if (canEditChannelHeader) {
            setEmptyPopoverOpen(false);
            openChannelSettings();
            return;
        }

        setHeaderPopoverOpen(false);
        setEmptyPopoverOpen((open) => !open);
    }, [canEditChannelHeader, hasHeaderText, openChannelSettings]);

    const tooltip = hasHeaderText ?
        intl.formatMessage({id: 'channel_header.headerText.viewButton', defaultMessage: 'View channel header'}) :
        canEditChannelHeader ?
            intl.formatMessage({id: 'channel_header.headerText.addNewButton', defaultMessage: 'Add a channel header'}) :
            intl.formatMessage({id: 'channel_header.headerText.viewButton', defaultMessage: 'View channel header'});

    const buttonClass = classNames(
        'channel-header__icon channel-header__icon--left btn btn-icon btn-xs',
        {'channel-header__icon--active': headerPopoverOpen || emptyPopoverOpen},
    );

    const channelMentionsNameMap = isChannelNamesMap(channel?.props?.channel_mentions) ? channel.props.channel_mentions : undefined;

    return (
        <>
            <HeaderIconWrapper
                buttonClass={buttonClass}
                buttonId='channelHeaderTextButton'
                onClick={handleClick}
                tooltip={tooltip}
                buttonRef={buttonRef}
            >
                <i
                    aria-hidden='true'
                    className='icon icon-text-box-outline'
                />
            </HeaderIconWrapper>
            {hasHeaderText && (
                <ChannelHeaderTextPopover
                    text={headerText}
                    channelMentionsNameMap={channelMentionsNameMap}
                    anchorRef={buttonRef}
                    forceEnablePopover={true}
                    hideInlineText={true}
                    isOpen={headerPopoverOpen}
                    onOpenChange={setHeaderPopoverOpen}
                />
            )}
            {!hasHeaderText && !canEditChannelHeader && (
                <ChannelHeaderEmptyPopover
                    anchorRef={buttonRef}
                    isOpen={emptyPopoverOpen}
                    onOpenChange={setEmptyPopoverOpen}
                    message={
                        <FormattedMessage
                            id='channel_header.headerText.empty'
                            defaultMessage='This channel has no header'
                        />
                    }
                />
            )}
        </>
    );
}
