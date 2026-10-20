// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    autoUpdate,
    flip,
    FloatingFocusManager,
    FloatingPortal,
    offset,
    shift,
    useDismiss,
    useFloating,
    useInteractions,
    useRole,
} from '@floating-ui/react';
import classNames from 'classnames';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import type {MouseEvent} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';
import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {Permissions} from 'mattermost-redux/constants';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';

import {openModal} from 'actions/views/modals';

import ChannelSettingsModal from 'components/channel_settings_modal/channel_settings_modal';
import Markdown from 'components/markdown';

import {A11yClassNames, Constants, ModalIdentifiers, RootHtmlPortalId} from 'utils/constants';
import {handleFormattedTextClick} from 'utils/utils';

import type {GlobalState} from 'types/store';

import {canManageChannelHeader} from './can_manage_channel_header';
import {
    getChannelHeaderDisplayText,
    getChannelHeaderMentionsMap,
} from './channel_header_text';
import {
    getChannelHeaderPopoverMarkdownOptions,
    IMAGE_MARKDOWN_OPTIONS,
} from './channel_header_text_popover';
import HeaderIconWrapper from './components/header_icon_wrapper';

import './channel_header_button.scss';

export const CHANNEL_HEADER_POPOVER_BUTTON_ID = 'channelHeaderPopoverButton';
export const CHANNEL_HEADER_POPOVER_ID = 'channelHeaderPopover';

type Props = {
    channel: Channel;
    dmUser?: UserProfile;
};

export default function ChannelHeaderButton({channel, dmUser}: Props) {
    const intl = useIntl();
    const dispatch = useDispatch();
    const [isOpen, setOpen] = useState(false);
    const currentRelativeTeamUrl = useSelector(getCurrentRelativeTeamUrl);

    const canManageProperties = useSelector((state: GlobalState) => {
        if (channel.type === Constants.DM_CHANNEL || channel.type === Constants.GM_CHANNEL) {
            return false;
        }
        const permission = channel.type === Constants.PRIVATE_CHANNEL ? Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES : Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES;
        return haveIChannelPermission(state, channel.team_id, channel.id, permission);
    });
    const canManage = canManageChannelHeader(channel, canManageProperties);

    const headerText = getChannelHeaderDisplayText(channel, dmUser);
    const hasHeaderText = headerText.trim().length > 0;
    const markdownOptions = useMemo(
        () => getChannelHeaderPopoverMarkdownOptions(getChannelHeaderMentionsMap(channel)),
        [channel],
    );

    const focusTriggerButton = useCallback(() => {
        document.getElementById(CHANNEL_HEADER_POPOVER_BUTTON_ID)?.focus();
    }, []);

    const handleOpenChange = useCallback((open: boolean) => {
        setOpen(open);
        if (!open) {
            focusTriggerButton();
        }
    }, [focusTriggerButton]);

    const {refs, floatingStyles, context: floatingContext} = useFloating({
        open: isOpen,
        onOpenChange: handleOpenChange,
        whileElementsMounted: autoUpdate,
        placement: 'bottom-end',
        middleware: [
            offset(8),
            flip({padding: 8}),
            shift({padding: 8}),
        ],
    });

    const dismiss = useDismiss(floatingContext);
    const role = useRole(floatingContext, {role: 'dialog'});
    const {getReferenceProps, getFloatingProps} = useInteractions([dismiss, role]);

    useEffect(() => {
        setOpen(false);
    }, [channel.id]);

    const togglePopover = useCallback(() => {
        setOpen((open) => !open);
    }, []);

    const handleOpenChannelSettings = useCallback(() => {
        setOpen(false);
        dispatch(openModal({
            modalId: ModalIdentifiers.CHANNEL_SETTINGS,
            dialogType: ChannelSettingsModal,
            dialogProps: {
                channelId: channel.id,
                focusOriginElement: CHANNEL_HEADER_POPOVER_BUTTON_ID,
                isOpen: true,
            },
        }));
    }, [channel.id, dispatch]);

    const handleFormattedClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
        handleFormattedTextClick(event, currentRelativeTeamUrl);
    }, [currentRelativeTeamUrl]);

    const tooltip = intl.formatMessage({id: 'channel_header.channelHeader', defaultMessage: 'Channel header'});
    const buttonClass = classNames('channel-header__icon channel-header__icon--left btn btn-icon btn-xs', {
        'channel-header__icon--active': isOpen,
    });

    return (
        <>
            <div
                ref={refs.setReference}
                className='ChannelHeaderButton'
                {...getReferenceProps()}
            >
                <HeaderIconWrapper
                    buttonClass={buttonClass}
                    buttonId={CHANNEL_HEADER_POPOVER_BUTTON_ID}
                    onClick={togglePopover}
                    tooltip={tooltip}
                    ariaExpanded={isOpen}
                    ariaControls={CHANNEL_HEADER_POPOVER_ID}
                    ariaHaspopup='dialog'
                    isRhsOpen={isOpen}
                >
                    <i
                        className='icon icon-text-box-outline'
                        aria-hidden='true'
                    />
                </HeaderIconWrapper>
            </div>
            {isOpen && (
                <FloatingPortal id={RootHtmlPortalId}>
                    <FloatingFocusManager
                        context={floatingContext}
                        modal={false}
                    >
                        <div
                            ref={refs.setFloating}
                            style={floatingStyles}
                            className={classNames('ChannelHeaderButtonPopover', A11yClassNames.POPUP)}
                            {...getFloatingProps()}
                            id={CHANNEL_HEADER_POPOVER_ID}
                        >
                            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
                            <div
                                className='ChannelHeaderButtonPopover__body'
                                onClick={handleFormattedClick}
                            >
                                {hasHeaderText ? (
                                    <Markdown
                                        message={headerText}
                                        options={markdownOptions}
                                        imageProps={IMAGE_MARKDOWN_OPTIONS}
                                    />
                                ) : (
                                    <p className='ChannelHeaderButtonPopover__empty'>
                                        <FormattedMessage
                                            id='channel_header.headerPopover.empty'
                                            defaultMessage='No channel header yet'
                                        />
                                    </p>
                                )}
                            </div>
                            {canManage && (
                                <div className='ChannelHeaderButtonPopover__actions'>
                                    <Button
                                        id={hasHeaderText ? 'channelHeaderPopoverEdit' : 'channelHeaderPopoverAdd'}
                                        type='button'
                                        emphasis='tertiary'
                                        size='sm'
                                        onClick={handleOpenChannelSettings}
                                    >
                                        {hasHeaderText ? (
                                            <FormattedMessage
                                                id='channel_header.headerPopover.edit'
                                                defaultMessage='Edit'
                                            />
                                        ) : (
                                            <FormattedMessage
                                                id='channel_header.headerText.addNewButton'
                                                defaultMessage='Add a channel header'
                                            />
                                        )}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </FloatingFocusManager>
                </FloatingPortal>
            )}
        </>
    );
}
