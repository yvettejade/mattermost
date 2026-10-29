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
import type {OpenChangeReason} from '@floating-ui/react';
import classNames from 'classnames';
import React, {useCallback, useMemo, useState} from 'react';
import type {MouseEvent} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {FormatHeaderIcon} from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/shared/components/button';
import type {Channel} from '@mattermost/types/channels';

import {Permissions} from 'mattermost-redux/constants';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';

import {openModal} from 'actions/views/modals';

import ChannelSettingsModal from 'components/channel_settings_modal/channel_settings_modal';
import Markdown from 'components/markdown';

import {A11yClassNames, Constants, ModalIdentifiers, RootHtmlPortalId} from 'utils/constants';
import {isChannelNamesMap} from 'utils/text_formatting';
import {handleFormattedTextClick} from 'utils/utils';

import type {GlobalState} from 'types/store';

import {
    getChannelHeaderPopoverMarkdownOptions,
    IMAGE_MARKDOWN_OPTIONS,
} from './channel_header_text_popover';
import HeaderIconWrapper from './components/header_icon_wrapper';

import './channel_header_button.scss';

export const CHANNEL_HEADER_BUTTON_ID = 'channelHeaderButton';
export const CHANNEL_HEADER_BUTTON_PANEL_ID = 'channelHeaderButtonPanel';

const HEADER_BUTTON_CHANNEL_TYPES = new Set<string>([
    Constants.OPEN_CHANNEL,
    Constants.PRIVATE_CHANNEL,
    Constants.GM_CHANNEL,
]);

type Props = {
    channel: Channel;
};

function canEditChannelHeader(channel: Channel, state: GlobalState): boolean {
    if (channel.delete_at !== 0) {
        return false;
    }

    if (channel.type === Constants.GM_CHANNEL) {
        return true;
    }

    const permission = channel.type === Constants.PRIVATE_CHANNEL ?
        Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES :
        Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES;

    return haveIChannelPermission(state, channel.team_id, channel.id, permission);
}

export default function ChannelHeaderButton({channel}: Props) {
    const intl = useIntl();
    const dispatch = useDispatch();
    const [isOpen, setOpen] = useState(false);
    const currentRelativeTeamUrl = useSelector(getCurrentRelativeTeamUrl);
    const canEdit = useSelector((state: GlobalState) => canEditChannelHeader(channel, state));

    const headerText = channel.header ?? '';
    const hasHeaderText = headerText.trim().length > 0;
    const markdownOptions = useMemo(
        () => getChannelHeaderPopoverMarkdownOptions(
            isChannelNamesMap(channel.props?.channel_mentions) ? channel.props.channel_mentions : undefined,
        ),
        [channel.props?.channel_mentions],
    );

    const handleOpenChange = useCallback((open: boolean, event?: Event, reason?: OpenChangeReason) => {
        setOpen(open);

        // Light dismiss (outside press, reference click) leaves focus on the
        // clicked target. Only Escape has no new target to return focus to.
        if (!open && reason === 'escape-key') {
            document.getElementById(CHANNEL_HEADER_BUTTON_ID)?.focus();
        }
    }, []);

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

    const click = useClick(floatingContext);
    const dismiss = useDismiss(floatingContext);
    const role = useRole(floatingContext, {role: 'dialog'});
    const {getReferenceProps, getFloatingProps} = useInteractions([click, dismiss, role]);

    const handleOpenChannelSettings = useCallback(() => {
        setOpen(false);
        dispatch(openModal({
            modalId: ModalIdentifiers.CHANNEL_SETTINGS,
            dialogType: ChannelSettingsModal,
            dialogProps: {
                channelId: channel.id,
                isOpen: true,
                focusOriginElement: CHANNEL_HEADER_BUTTON_ID,
            },
        }));
    }, [channel.id, dispatch]);

    const handleFormattedClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
        handleFormattedTextClick(event, currentRelativeTeamUrl);
    }, [currentRelativeTeamUrl]);

    if (!HEADER_BUTTON_CHANNEL_TYPES.has(channel.type)) {
        return null;
    }

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
                    buttonId={CHANNEL_HEADER_BUTTON_ID}
                    onClick={() => undefined}
                    tooltip={tooltip}
                    ariaExpanded={isOpen}
                    ariaControls={CHANNEL_HEADER_BUTTON_PANEL_ID}
                    isRhsOpen={isOpen}
                >
                    <FormatHeaderIcon
                        size={16}
                        aria-hidden={true}
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
                            className={classNames('ChannelHeaderButton__panel', A11yClassNames.POPUP)}
                            {...getFloatingProps()}
                            id={CHANNEL_HEADER_BUTTON_PANEL_ID}
                        >
                            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
                            <div
                                className='ChannelHeaderButton__body'
                                onClick={handleFormattedClick}
                            >
                                {hasHeaderText ? (
                                    <Markdown
                                        message={headerText}
                                        options={markdownOptions}
                                        imageProps={IMAGE_MARKDOWN_OPTIONS}
                                    />
                                ) : (
                                    <p className='ChannelHeaderButton__empty'>
                                        <FormattedMessage
                                            id='channel_header.headerButton.empty'
                                            defaultMessage='No channel header yet'
                                        />
                                    </p>
                                )}
                            </div>
                            {canEdit && (
                                <div className='ChannelHeaderButton__actions'>
                                    <Button
                                        type='button'
                                        emphasis='tertiary'
                                        size='sm'
                                        onClick={handleOpenChannelSettings}
                                    >
                                        {hasHeaderText ? (
                                            <FormattedMessage
                                                id='channel_header.headerButton.edit'
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
