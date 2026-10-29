// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {autoUpdate, flip, offset, shift, size, useFloating, useMergeRefs} from '@floating-ui/react';
import classNames from 'classnames';
import React, {useCallback, useMemo, useRef, useState} from 'react';
import type {KeyboardEvent, MouseEvent} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';
import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';

import {openModal} from 'actions/views/modals';
import {canEditChannelHeader} from 'selectors/views/channel_header';

import EditChannelHeaderModal from 'components/edit_channel_header_modal';
import Markdown from 'components/markdown';

import {Constants, ModalIdentifiers} from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';
import {isChannelNamesMap} from 'utils/text_formatting';
import {handleFormattedTextClick} from 'utils/utils';

import type {GlobalState} from 'types/store';

import {getChannelHeaderText} from './channel_header_text';
import HeaderIconWrapper from './components/header_icon_wrapper';

import './channel_header_panel_toggle.scss';

const BUTTON_ID = 'channelHeaderPanelButton';
const PANEL_ID = 'channelHeaderPanel';
const TITLE_ID = 'channelHeaderPanelTitle';
const BUTTON_CLASS = 'channel-header__icon channel-header__icon--left btn btn-icon btn-xs';
const MARKDOWN_OPTIONS = {singleline: false, mentionHighlight: false, atMentions: true};
const IMAGE_PROPS = {hideUtilities: true};
const PANEL_OFFSET_PX = 4;
const VIEWPORT_PADDING_PX = 8;
const MIN_PANEL_HEIGHT_PX = 96;

type Props = {
    channel: Channel;
    dmUser?: UserProfile;
};

export default function ChannelHeaderPanelToggle(props: Props) {
    // Remount per channel so switching channels closes the panel without a reset effect.
    return (
        <ChannelHeaderPanelDisclosure
            key={props.channel.id}
            channel={props.channel}
            dmUser={props.dmUser}
        />
    );
}

function ChannelHeaderPanelDisclosure({channel, dmUser}: Props) {
    const intl = useIntl();
    const dispatch = useDispatch();
    const canEdit = useSelector((state: GlobalState) => canEditChannelHeader(state, channel.id));
    const [isOpen, setOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Fixed and inline (no portal): the title dropdown is position:relative, and a popover portal
    // would paint above the edit modal.
    const {refs, floatingStyles} = useFloating({
        open: isOpen,
        strategy: 'fixed',
        placement: 'bottom-start',
        whileElementsMounted: autoUpdate,
        middleware: [
            offset(PANEL_OFFSET_PX),
            flip({padding: VIEWPORT_PADDING_PX}),
            shift({padding: VIEWPORT_PADDING_PX}),
            size({
                padding: VIEWPORT_PADDING_PX,
                apply({availableHeight, elements}) {
                    elements.floating.style.maxHeight = `${Math.max(MIN_PANEL_HEIGHT_PX, availableHeight)}px`;
                },
            }),
        ],
    });
    const setButtonRef = useMergeRefs([refs.setReference, buttonRef]);

    const toggle = useCallback(() => {
        setOpen((open) => !open);
    }, []);

    const closeAndRefocus = useCallback(() => {
        setOpen(false);
        buttonRef.current?.focus();
    }, []);

    const edit = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
            dialogType: EditChannelHeaderModal,
            dialogProps: {channel},
        }));
    }, [channel, dispatch]);

    const handlePanelKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
        if (isKeyPressed(event, Constants.KeyCodes.ESCAPE)) {
            event.stopPropagation();
            closeAndRefocus();
        }
    }, [closeAndRefocus]);

    const closedLabel = intl.formatMessage({
        id: 'channel_header.channelHeader',
        defaultMessage: 'Channel header',
    });
    const buttonLabel = isOpen ? intl.formatMessage({
        id: 'channel_header.closeChannelHeader',
        defaultMessage: 'Close channel header',
    }) : closedLabel;

    return (
        <>
            <HeaderIconWrapper
                ref={setButtonRef}
                buttonId={BUTTON_ID}
                buttonClass={classNames(BUTTON_CLASS, {'channel-header__icon--active': isOpen})}
                onClick={toggle}
                tooltip={buttonLabel}
                ariaExpanded={isOpen}
                ariaControls={isOpen ? PANEL_ID : undefined}
            >
                <i
                    className='icon icon-text-box-outline'
                    aria-hidden='true'
                />
            </HeaderIconWrapper>
            {isOpen && (
                // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape bubbles from the buttons inside this region
                <div
                    ref={refs.setFloating}
                    id={PANEL_ID}
                    role='region'
                    aria-labelledby={TITLE_ID}
                    className='ChannelHeaderPanel'
                    style={floatingStyles}
                    onKeyDown={handlePanelKeyDown}
                >
                    <ChannelHeaderPanelBody
                        channel={channel}
                        dmUser={dmUser}
                        canEdit={canEdit}
                        onEdit={edit}
                        onClose={closeAndRefocus}
                    />
                </div>
            )}
        </>
    );
}

function ChannelHeaderPanelBody({
    channel,
    dmUser,
    canEdit,
    onEdit,
    onClose,
}: Props & {
    canEdit: boolean;
    onEdit: () => void;
    onClose: () => void;
}) {
    const currentRelativeTeamUrl = useSelector(getCurrentRelativeTeamUrl);
    const text = getChannelHeaderText(channel, dmUser);
    const markdownOptions = useMemo(() => ({
        ...MARKDOWN_OPTIONS,
        channelNamesMap: isChannelNamesMap(channel.props?.channel_mentions) ? channel.props.channel_mentions : undefined,
    }), [channel.props?.channel_mentions]);

    const handleClick = (event: MouseEvent<HTMLDivElement>) => {
        handleFormattedTextClick(event, currentRelativeTeamUrl);
    };

    return (
        <>
            <div className='ChannelHeaderPanel__header'>
                <h2
                    id={TITLE_ID}
                    className='ChannelHeaderPanel__title'
                >
                    <FormattedMessage
                        id='channel_header.channelHeader'
                        defaultMessage='Channel header'
                    />
                </h2>
                <div className='ChannelHeaderPanel__actions'>
                    {canEdit && (
                        <Button
                            id='channelHeaderPanelEdit'
                            emphasis='tertiary'
                            size='sm'
                            onClick={onEdit}
                        >
                            <FormattedMessage
                                id='channel_header.editHeader'
                                defaultMessage='Edit'
                            />
                        </Button>
                    )}
                    <Button
                        id='channelHeaderPanelClose'
                        emphasis='tertiary'
                        size='sm'
                        onClick={onClose}
                    >
                        <FormattedMessage
                            id='generic.close'
                            defaultMessage='Close'
                        />
                    </Button>
                </div>
            </div>
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
            <div
                className='ChannelHeaderPanel__body'
                onClick={handleClick}
            >
                {text.trim() ? (
                    <Markdown
                        message={text}
                        options={markdownOptions}
                        imageProps={IMAGE_PROPS}
                    />
                ) : (
                    <p className='ChannelHeaderPanel__empty'>
                        {canEdit ? (
                            <FormattedMessage
                                id='channel_header.headerPanel.empty'
                                defaultMessage='Add a channel header…'
                            />
                        ) : (
                            <FormattedMessage
                                id='channel_header.headerPanel.noHeader'
                                defaultMessage='No channel header'
                            />
                        )}
                    </p>
                )}
            </div>
        </>
    );
}
