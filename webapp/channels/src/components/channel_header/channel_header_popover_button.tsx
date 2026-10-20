// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    autoUpdate,
    FloatingFocusManager,
    FloatingPortal,
    offset,
    useDismiss,
    useFloating,
    useInteractions,
    useRole,
} from '@floating-ui/react';
import classNames from 'classnames';
import React, {useCallback, useMemo, useState} from 'react';
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

import EditChannelHeaderModal from 'components/edit_channel_header_modal';
import Markdown from 'components/markdown';

import {A11yClassNames, Constants, ModalIdentifiers, RootHtmlPortalId} from 'utils/constants';
import {isChannelNamesMap} from 'utils/text_formatting';
import {handleFormattedTextClick} from 'utils/utils';

import type {GlobalState} from 'types/store';

import {canEditChannelHeader, getChannelHeaderDisplayText} from './can_edit_channel_header';
import HeaderIconWrapper from './components/header_icon_wrapper';

import './channel_header_popover_button.scss';

const POPOVER_MARKDOWN_OPTIONS = {singleline: false, mentionHighlight: false, atMentions: true};
const IMAGE_MARKDOWN_OPTIONS = {hideUtilities: true};

export const CHANNEL_HEADER_POPOVER_BUTTON_ID = 'channelHeaderPopoverButton';
export const CHANNEL_HEADER_POPOVER_ID = 'channelHeaderPopover';

type Props = {
    channel: Channel;
    dmUser?: UserProfile;
};

export default function ChannelHeaderPopoverButton({channel, dmUser}: Props) {
    const intl = useIntl();
    const dispatch = useDispatch();
    const [isOpen, setOpen] = useState(false);
    const currentRelativeTeamUrl = useSelector(getCurrentRelativeTeamUrl);

    const canManageProperties = useSelector((state: GlobalState) => {
        if (channel.type === Constants.DM_CHANNEL || channel.type === Constants.GM_CHANNEL) {
            return true;
        }
        const permission = channel.type === Constants.PRIVATE_CHANNEL ? Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES : Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES;
        return haveIChannelPermission(state, channel.team_id, channel.id, permission);
    });
    const canEdit = canEditChannelHeader({channel, dmUser, canManageProperties});

    const headerText = getChannelHeaderDisplayText(channel, dmUser);
    const hasHeaderText = headerText.trim().length > 0;

    const markdownOptions = useMemo(() => ({
        ...POPOVER_MARKDOWN_OPTIONS,
        channelNamesMap: isChannelNamesMap(channel.props?.channel_mentions) ? channel.props.channel_mentions : undefined,
    }), [channel.props?.channel_mentions]);

    const {refs, floatingStyles, context: floatingContext} = useFloating({
        open: isOpen,
        onOpenChange: setOpen,
        whileElementsMounted: autoUpdate,
        placement: 'bottom-end',
        middleware: [offset(8)],
    });

    const dismiss = useDismiss(floatingContext);
    const role = useRole(floatingContext, {role: 'dialog'});
    const {getReferenceProps, getFloatingProps} = useInteractions([dismiss, role]);

    const togglePopover = useCallback(() => {
        setOpen((open) => !open);
    }, []);

    const handleAddHeader = useCallback(() => {
        setOpen(false);
        dispatch(openModal({
            modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
            dialogType: EditChannelHeaderModal,
            dialogProps: {channel},
        }));
    }, [channel, dispatch]);

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
                className='ChannelHeaderPopoverButton'
                {...getReferenceProps()}
            >
                <HeaderIconWrapper
                    buttonClass={buttonClass}
                    buttonId={CHANNEL_HEADER_POPOVER_BUTTON_ID}
                    onClick={togglePopover}
                    tooltip={tooltip}
                    ariaExpanded={isOpen}
                    ariaControls={CHANNEL_HEADER_POPOVER_ID}
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
                            className={classNames('ChannelHeaderPopover', A11yClassNames.POPUP)}
                            {...getFloatingProps()}
                            id={CHANNEL_HEADER_POPOVER_ID}
                        >
                            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
                            <div
                                className='ChannelHeaderPopover__body'
                                onClick={handleFormattedClick}
                            >
                                {hasHeaderText ? (
                                    <Markdown
                                        message={headerText}
                                        options={markdownOptions}
                                        imageProps={IMAGE_MARKDOWN_OPTIONS}
                                    />
                                ) : (
                                    <p className='ChannelHeaderPopover__empty'>
                                        <FormattedMessage
                                            id='channel_header.headerPopover.empty'
                                            defaultMessage='This channel does not have a header.'
                                        />
                                    </p>
                                )}
                            </div>
                            {!hasHeaderText && canEdit && (
                                <Button
                                    id='channelHeaderPopoverAdd'
                                    type='button'
                                    emphasis='tertiary'
                                    size='sm'
                                    onClick={handleAddHeader}
                                >
                                    <FormattedMessage
                                        id='channel_header.headerText.addNewButton'
                                        defaultMessage='Add a channel header'
                                    />
                                </Button>
                            )}
                        </div>
                    </FloatingFocusManager>
                </FloatingPortal>
            )}
        </>
    );
}
