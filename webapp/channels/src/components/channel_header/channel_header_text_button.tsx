// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    FloatingFocusManager,
    FloatingPortal,
    autoUpdate,
    flip,
    offset,
    shift,
    useClick,
    useDismiss,
    useFloating,
    useId,
    useInteractions,
    useRole,
} from '@floating-ui/react';
import classNames from 'classnames';
import React, {useMemo, useState} from 'react';
import type {MouseEvent} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {Channel} from '@mattermost/types/channels';

import Permissions from 'mattermost-redux/constants/permissions';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';

import {openModal} from 'actions/views/modals';

import ChannelSettingsModal from 'components/channel_settings_modal/channel_settings_modal';
import Markdown from 'components/markdown';

import {Constants, ModalIdentifiers, RootHtmlPortalId} from 'utils/constants';
import {isChannelNamesMap} from 'utils/text_formatting';
import {handleFormattedTextClick} from 'utils/utils';

import type {GlobalState} from 'types/store';

import './channel_header_text_button.scss';

const BUTTON_ID = 'channelHeaderTextButton';
const IMAGE_MARKDOWN_OPTIONS = {hideUtilities: true};

type Props = {
    channel: Channel;
};

export default function ChannelHeaderTextButton({channel}: Props) {
    const intl = useIntl();
    const dispatch = useDispatch();
    const currentRelativeTeamUrl = useSelector(getCurrentRelativeTeamUrl);
    const headingId = useId();

    const isArchived = channel.delete_at !== 0;
    const canManageChannelProperties = useSelector((state: GlobalState) => {
        if (channel.type === Constants.GM_CHANNEL) {
            return true;
        }
        const permission = channel.type === Constants.PRIVATE_CHANNEL ? Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES : Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES;
        return haveIChannelPermission(state, channel.team_id, channel.id, permission);
    });
    const canEdit = canManageChannelProperties && !isArchived;

    const [isOpen, setIsOpen] = useState(false);

    const {refs: {setReference, setFloating}, floatingStyles, context} = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        placement: 'bottom-start',
        whileElementsMounted: autoUpdate,
        middleware: [
            offset(4),
            flip({padding: 8}),
            shift({padding: 8}),
        ],
    });

    const {getReferenceProps, getFloatingProps} = useInteractions([
        useClick(context),
        useDismiss(context),
        useRole(context, {role: 'dialog'}),
    ]);

    const markdownOptions = useMemo(() => ({
        singleline: false,
        mentionHighlight: false,
        atMentions: true,
        channelNamesMap: isChannelNamesMap(channel.props?.channel_mentions) ? channel.props.channel_mentions : undefined,
    }), [channel.props?.channel_mentions]);

    const handleFormattedClick = (event: MouseEvent<HTMLDivElement>) => {
        handleFormattedTextClick(event, currentRelativeTeamUrl);
    };

    const openChannelSettings = () => {
        setIsOpen(false);
        dispatch(openModal({
            modalId: ModalIdentifiers.CHANNEL_SETTINGS,
            dialogType: ChannelSettingsModal,
            dialogProps: {
                channelId: channel.id,
                focusOriginElement: BUTTON_ID,
                isOpen: true,
            },
        }));
    };

    const headerText = channel.header?.trim() ? channel.header : '';
    const label = intl.formatMessage({id: 'channel_header.channelHeader', defaultMessage: 'Channel header'});

    let content;
    if (headerText) {
        content = (
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
            <div
                className='channel-header-text-button__popover-text'
                onClick={handleFormattedClick}
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
            <p className='channel-header-text-button__popover-empty'>
                <FormattedMessage
                    id='channel_header.channelHeader.empty'
                    defaultMessage='No channel header yet'
                />
            </p>
        );
    }

    let action;
    if (canEdit) {
        action = (
            <button
                type='button'
                className='btn btn-tertiary btn-xs'
                onClick={openChannelSettings}
            >
                {headerText ? (
                    <FormattedMessage
                        id='channel_header.channelHeader.edit'
                        defaultMessage='Edit'
                    />
                ) : (
                    <FormattedMessage
                        id='channel_header.channelHeader.add'
                        defaultMessage='Add a channel header'
                    />
                )}
            </button>
        );
    }

    return (
        <>
            <WithTooltip
                title={label}
                disabled={isOpen}
            >
                <button
                    id={BUTTON_ID}
                    ref={setReference}
                    type='button'
                    aria-label={label}
                    aria-expanded={isOpen}
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
                            className='channel-header-text-button__popover'
                            style={floatingStyles}
                            aria-labelledby={headingId}
                            data-testid='channelHeaderTextPopover'
                            {...getFloatingProps()}
                        >
                            <div className='channel-header-text-button__popover-header'>
                                <h4
                                    id={headingId}
                                    className='channel-header-text-button__popover-title'
                                >
                                    {label}
                                </h4>
                                {action}
                            </div>
                            {content}
                        </div>
                    </FloatingFocusManager>
                </FloatingPortal>
            )}
        </>
    );
}
