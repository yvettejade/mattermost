// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    FloatingFocusManager,
    FloatingPortal,
    autoUpdate,
    flip,
    offset,
    shift,
    useDismiss,
    useFloating,
    useInteractions,
    useRole,
} from '@floating-ui/react';
import classNames from 'classnames';
import React, {useState} from 'react';
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
import type {ChannelNamesMap} from 'utils/text_formatting';
import {handleFormattedTextClick} from 'utils/utils';

import type {GlobalState} from 'types/store';

import {canManageChannelHeader} from './can_manage_channel_header';
import {getChannelHeaderContent} from './channel_header_content';
import type {ChannelHeaderContent} from './channel_header_content';
import {useHeaderMarkdownOptions} from './channel_header_text_popover';
import HeaderIconWrapper from './components/header_icon_wrapper';

import './channel_header_popover_button.scss';

const BUTTON_ID = 'channelHeaderPopoverButton';
const POPOVER_ID = 'channelHeaderPopover';

type HeaderReadout =
    | {kind: 'empty_readonly'}
    | {kind: 'empty_add'}
    | {kind: 'text_readonly'; text: string; channelNamesMap?: ChannelNamesMap}
    | {kind: 'text_edit'; text: string; channelNamesMap?: ChannelNamesMap};

function headerReadout(content: ChannelHeaderContent, canEdit: boolean): HeaderReadout {
    if (content.kind === 'empty') {
        return canEdit ? {kind: 'empty_add'} : {kind: 'empty_readonly'};
    }

    const {text, channelNamesMap} = content;
    return canEdit ? {kind: 'text_edit', text, channelNamesMap} : {kind: 'text_readonly', text, channelNamesMap};
}

function propertiesPermission(type: Channel['type']): string | undefined {
    switch (type) {
    case Constants.OPEN_CHANNEL:
        return Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES;
    case Constants.PRIVATE_CHANNEL:
        return Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES;
    default:
        return undefined;
    }
}

type Props = {
    channel: Channel;
    dmUser?: UserProfile;
};

export default function ChannelHeaderPopoverButton({channel, dmUser}: Props) {
    const intl = useIntl();
    const dispatch = useDispatch();

    const canManageProperties = useSelector((state: GlobalState) => {
        const permission = propertiesPermission(channel.type);
        return permission ? haveIChannelPermission(state, channel.team_id, channel.id, permission) : false;
    });
    const readout = headerReadout(getChannelHeaderContent(channel, dmUser), canManageChannelHeader(channel, canManageProperties));

    // Keyed by channel so a switch renders closed on the same pass. ChannelHeader stays mounted across
    // switches, so the stale key is dropped too, or returning to that channel would reopen the popover.
    const [openForChannelId, setOpenForChannelId] = useState<Channel['id'] | null>(null);
    const isOpen = openForChannelId === channel.id;
    if (openForChannelId !== null && !isOpen) {
        setOpenForChannelId(null);
    }
    const setOpen = (open: boolean) => setOpenForChannelId(open ? channel.id : null);

    const {refs, floatingStyles, context} = useFloating({
        open: isOpen,
        onOpenChange: setOpen,
        placement: 'bottom-end',
        whileElementsMounted: autoUpdate,
        middleware: [
            offset(4),
            flip({padding: 8}),
            shift({padding: 8}),
        ],
    });
    const {getFloatingProps} = useInteractions([
        useDismiss(context),
        useRole(context, {role: 'dialog'}),
    ]);

    const openChannelSettings = () => {
        setOpen(false);
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

    const label = intl.formatMessage({id: 'channel_header.channelHeader', defaultMessage: 'Channel header'});

    return (
        <>
            <HeaderIconWrapper
                ref={refs.setReference}
                buttonClass={classNames('channel-header__icon channel-header__icon--left btn btn-icon btn-xs', {
                    'channel-header__icon--active': isOpen,
                })}
                buttonId={BUTTON_ID}
                onClick={() => setOpen(!isOpen)}
                tooltip={label}
                popover={{id: POPOVER_ID, isOpen}}
            >
                <i
                    aria-hidden='true'
                    className='icon icon-text-box-outline'
                />
            </HeaderIconWrapper>
            {isOpen && (
                <FloatingPortal id={RootHtmlPortalId}>
                    <FloatingFocusManager
                        context={context}
                        modal={false}
                        returnFocus={true}
                    >
                        <div
                            ref={refs.setFloating}
                            style={floatingStyles}
                            className={classNames('ChannelHeaderPopover', A11yClassNames.POPUP)}
                            aria-label={label}
                            {...getFloatingProps()}
                            id={POPOVER_ID}
                        >
                            <ReadoutBody
                                readout={readout}
                                onOpenChannelSettings={openChannelSettings}
                            />
                        </div>
                    </FloatingFocusManager>
                </FloatingPortal>
            )}
        </>
    );
}

type ReadoutBodyProps = {
    readout: HeaderReadout;
    onOpenChannelSettings: () => void;
};

function ReadoutBody({readout, onOpenChannelSettings}: ReadoutBodyProps): JSX.Element {
    switch (readout.kind) {
    case 'empty_readonly':
        return <EmptyMessage/>;
    case 'empty_add':
        return (
            <>
                <EmptyMessage/>
                <div className='ChannelHeaderPopover__footer'>
                    <Button
                        emphasis='primary'
                        size='sm'
                        onClick={onOpenChannelSettings}
                    >
                        <FormattedMessage
                            id='channel_header.headerText.addNewButton'
                            defaultMessage='Add a channel header'
                        />
                    </Button>
                </div>
            </>
        );
    case 'text_readonly':
        return (
            <HeaderMarkdown
                text={readout.text}
                channelNamesMap={readout.channelNamesMap}
            />
        );
    case 'text_edit':
        return (
            <>
                <HeaderMarkdown
                    text={readout.text}
                    channelNamesMap={readout.channelNamesMap}
                />
                <div className='ChannelHeaderPopover__footer'>
                    <Button
                        emphasis='tertiary'
                        size='sm'
                        onClick={onOpenChannelSettings}
                    >
                        <FormattedMessage
                            id='channel_header.headerPopover.edit'
                            defaultMessage='Edit'
                        />
                    </Button>
                </div>
            </>
        );
    }
}

function EmptyMessage() {
    return (
        <p className='ChannelHeaderPopover__empty'>
            <FormattedMessage
                id='channel_header.headerPopover.empty'
                defaultMessage='No channel header yet'
            />
        </p>
    );
}

type HeaderMarkdownProps = {
    text: string;
    channelNamesMap?: ChannelNamesMap;
};

function HeaderMarkdown({text, channelNamesMap}: HeaderMarkdownProps) {
    const currentRelativeTeamUrl = useSelector(getCurrentRelativeTeamUrl);
    const markdownOptions = useHeaderMarkdownOptions(channelNamesMap);

    const handleClick = (event: MouseEvent<HTMLDivElement>) => {
        handleFormattedTextClick(event, currentRelativeTeamUrl);
    };

    return (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div
            className='ChannelHeaderPopover__text'
            onClick={handleClick}
        >
            <Markdown
                message={text}
                options={markdownOptions.inPopover}
                imageProps={markdownOptions.imageProps}
            />
        </div>
    );
}
