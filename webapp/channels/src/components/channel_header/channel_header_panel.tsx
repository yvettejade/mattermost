// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo, useRef} from 'react';
import type {KeyboardEvent, MouseEvent} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';
import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';

import Markdown from 'components/markdown';

import {Constants} from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';
import {isChannelNamesMap} from 'utils/text_formatting';
import {handleFormattedTextClick} from 'utils/utils';

import './channel_header_panel.scss';

const PANEL_MARKDOWN_OPTIONS = {singleline: false, mentionHighlight: false, atMentions: true};
const IMAGE_MARKDOWN_OPTIONS = {hideUtilities: true};

export const CHANNEL_HEADER_PANEL_ID = 'channelHeaderPanel';

type Props = {
    channel: Channel;
    dmUser?: UserProfile;
    canEdit: boolean;
    onEdit: () => void;
    onClose: () => void;
};

export function getChannelHeaderDisplayText(channel: Channel, dmUser?: UserProfile): string {
    const isBotDMChannel = channel.type === Constants.DM_CHANNEL && Boolean(dmUser?.is_bot);
    return isBotDMChannel ? dmUser?.bot_description ?? '' : channel.header ?? '';
}

export default function ChannelHeaderPanel({channel, dmUser, canEdit, onEdit, onClose}: Props) {
    const intl = useIntl();
    const panelRef = useRef<HTMLDivElement>(null);
    const currentRelativeTeamUrl = useSelector(getCurrentRelativeTeamUrl);

    const headerText = getChannelHeaderDisplayText(channel, dmUser);
    const hasHeaderText = headerText.trim().length > 0;

    const markdownOptions = useMemo(() => ({
        ...PANEL_MARKDOWN_OPTIONS,
        channelNamesMap: isChannelNamesMap(channel.props?.channel_mentions) ? channel.props.channel_mentions : undefined,
    }), [channel.props?.channel_mentions]);

    useEffect(() => {
        panelRef.current?.focus();
    }, []);

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (isKeyPressed(event, Constants.KeyCodes.ESCAPE)) {
            event.stopPropagation();
            onClose();
        }
    };

    const handleClick = (event: MouseEvent<HTMLDivElement>) => {
        handleFormattedTextClick(event, currentRelativeTeamUrl);
    };

    const title = intl.formatMessage({id: 'channel_header.channelHeader', defaultMessage: 'Channel header'});

    return (
        <div
            id={CHANNEL_HEADER_PANEL_ID}
            ref={panelRef}
            className='ChannelHeaderPanel'
            role='region'
            aria-label={title}
            tabIndex={-1}
            onKeyDown={handleKeyDown}
        >
            <div className='ChannelHeaderPanel__header'>
                <h2 className='ChannelHeaderPanel__title'>
                    <FormattedMessage
                        id='channel_header.channelHeader'
                        defaultMessage='Channel header'
                    />
                </h2>
                <div className='ChannelHeaderPanel__actions'>
                    {canEdit && (
                        <Button
                            id='channelHeaderPanelEdit'
                            type='button'
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
                        type='button'
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
                {hasHeaderText ? (
                    <Markdown
                        message={headerText}
                        options={markdownOptions}
                        imageProps={IMAGE_MARKDOWN_OPTIONS}
                    />
                ) : (
                    <p className='ChannelHeaderPanel__empty'>
                        <FormattedMessage
                            id='channel_header.headerPanel.empty'
                            defaultMessage='Add a channel header…'
                        />
                    </p>
                )}
            </div>
        </div>
    );
}
