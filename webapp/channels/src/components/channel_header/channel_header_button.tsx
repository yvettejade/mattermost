// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    autoUpdate,
    flip,
    FloatingFocusManager,
    FloatingPortal,
    offset,
    shift,
    useClick,
    useDismiss,
    useFloating,
    useInteractions,
    useRole,
} from '@floating-ui/react';
import classNames from 'classnames';
import React, {useEffect, useMemo, useState} from 'react';
import type {MouseEvent} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {Permissions} from 'mattermost-redux/constants';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';

import {openModal} from 'actions/views/modals';

import ChannelSettingsModal from 'components/channel_settings_modal/channel_settings_modal';
import Markdown from 'components/markdown';

import {Constants, ModalIdentifiers, RootHtmlPortalId} from 'utils/constants';
import {handleFormattedTextClick} from 'utils/utils';

import type {GlobalState} from 'types/store';

import {getChannelHeaderText, getChannelMentionsNameMap, isBotDMChannel} from './channel_header_text';
import {IMAGE_MARKDOWN_OPTIONS, MENTION_MARKDOWN_OPTIONS, TEXT_IN_POPOVER_MARKDOWN_OPTIONS} from './channel_header_text_popover';

import './channel_header_button.scss';

export const CHANNEL_HEADER_BUTTON_ID = 'channelHeaderHeaderButton';

interface Props {
    channel: Channel;
    dmUser?: UserProfile;
}

// The header is edited from the Info tab of the channel settings modal. DM/GM headers are intentionally not offered here.
function canEditChannelHeader(state: GlobalState, channel: Channel): boolean {
    if (channel.delete_at !== 0) {
        return false;
    }

    if (channel.type === Constants.OPEN_CHANNEL) {
        return haveIChannelPermission(state, channel.team_id, channel.id, Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES);
    }

    if (channel.type === Constants.PRIVATE_CHANNEL) {
        return haveIChannelPermission(state, channel.team_id, channel.id, Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES);
    }

    return false;
}

export default function ChannelHeaderButton({channel, dmUser}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const currentRelativeTeamUrl = useSelector(getCurrentRelativeTeamUrl);
    const canEditHeader = useSelector((state: GlobalState) => canEditChannelHeader(state, channel));

    const isBotDM = isBotDMChannel(channel, dmUser);
    const headerText = getChannelHeaderText(channel, dmUser);
    const hasHeaderText = headerText.trim().length > 0;

    const [isOpen, setOpen] = useState(false);

    useEffect(() => {
        setOpen(false);
    }, [channel.id]);

    const {refs: {setReference, setFloating, domReference}, floatingStyles, context} = useFloating({
        open: isOpen,
        onOpenChange: (open, event, reason) => {
            setOpen(open);

            // Floating UI doesn't return focus after an outside click, so do it unless the click focused something else
            if (!open && reason === 'outside-press' && (!document.activeElement || document.activeElement === document.body)) {
                (domReference.current as HTMLElement | null)?.focus();
            }
        },
        placement: 'bottom-start',
        whileElementsMounted: autoUpdate,
        middleware: [
            offset(4),
            flip({padding: 8}),
            shift({padding: 8}),
        ],
    });

    const click = useClick(context);
    const dismiss = useDismiss(context, {outsidePressEvent: 'click'});
    const role = useRole(context, {role: 'dialog'});
    const {getReferenceProps, getFloatingProps} = useInteractions([click, dismiss, role]);

    const markdownOptions = useMemo(() => ({
        ...TEXT_IN_POPOVER_MARKDOWN_OPTIONS,
        ...MENTION_MARKDOWN_OPTIONS,
        channelNamesMap: getChannelMentionsNameMap(channel),
    }), [channel]);

    const label = isBotDM ? formatMessage({id: 'channel_header.headerButton.botDescription', defaultMessage: 'Bot description'}) : formatMessage({id: 'channel_header.headerButton.tooltip', defaultMessage: 'Channel header'});

    // Handles clicks on formatted text such as channel mentions and hashtags while letting links behave normally
    const handleTextClick = (e: MouseEvent<HTMLDivElement>) => {
        handleFormattedTextClick(e, currentRelativeTeamUrl);
    };

    const openChannelSettings = () => {
        setOpen(false);
        dispatch(openModal({
            modalId: ModalIdentifiers.CHANNEL_SETTINGS,
            dialogType: ChannelSettingsModal,
            dialogProps: {
                channelId: channel.id,
                focusOriginElement: CHANNEL_HEADER_BUTTON_ID,
                isOpen: true,
            },
        }));
    };

    let content;
    if (hasHeaderText) {
        content = (

            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
            <div
                className='channel-header-button__text'
                onClick={handleTextClick}
            >
                <Markdown
                    message={headerText}
                    options={markdownOptions}
                    imageProps={IMAGE_MARKDOWN_OPTIONS}
                />
            </div>
        );
    } else {
        content = (
            <div className='channel-header-button__empty'>
                <p className='channel-header-button__empty-text'>
                    {isBotDM ? (
                        <FormattedMessage
                            id='channel_header.headerButton.noBotDescription'
                            defaultMessage='This bot has no description.'
                        />
                    ) : (
                        <FormattedMessage
                            id='channel_header.headerButton.empty'
                            defaultMessage='No channel header yet.'
                        />
                    )}
                </p>
                {canEditHeader && (
                    <Button
                        emphasis='tertiary'
                        size='sm'
                        onClick={openChannelSettings}
                    >
                        <FormattedMessage
                            id='channel_header.headerText.addNewButton'
                            defaultMessage='Add a channel header'
                        />
                    </Button>
                )}
            </div>
        );
    }

    return (
        <>
            <WithTooltip
                title={label}
                disabled={isOpen}
            >
                <button
                    ref={setReference}
                    id={CHANNEL_HEADER_BUTTON_ID}
                    type='button'
                    aria-label={label}
                    className={classNames('channel-header__icon channel-header__icon--left btn btn-icon btn-xs', {
                        'channel-header__icon--active': isOpen,
                    })}
                    {...getReferenceProps()}
                >
                    <i
                        aria-hidden='true'
                        className='icon icon-text-box-outline'
                    />
                </button>
            </WithTooltip>
            {isOpen && (
                <FloatingPortal id={RootHtmlPortalId}>
                    <FloatingFocusManager
                        context={context}
                        modal={false}
                    >
                        <div
                            ref={setFloating}
                            className='channel-header-button__popover'
                            style={floatingStyles}
                            tabIndex={-1}
                            aria-label={label}
                            {...getFloatingProps()}
                        >
                            {content}
                        </div>
                    </FloatingFocusManager>
                </FloatingPortal>
            )}
        </>
    );
}
