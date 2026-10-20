// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import type {MouseEvent} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';

import Markdown from 'components/markdown';

import {isChannelNamesMap} from 'utils/text_formatting';
import {handleFormattedTextClick} from 'utils/utils';

import {getChannelHeaderText, hasChannelHeaderText} from './channel_header_text_utils';
import HeaderIconWrapper from './components/header_icon_wrapper';

const MENTION_MARKDOWN_OPTIONS = {mentionHighlight: false, atMentions: true};
const IMAGE_MARKDOWN_OPTIONS = {hideUtilities: true};

interface Props {
    channel: Channel;
    dmUser?: UserProfile;
}

const ChannelHeaderContentButton = ({channel, dmUser}: Props) => {
    const intl = useIntl();
    const [showModal, setShowModal] = useState(false);
    const currentRelativeTeamUrl = useSelector(getCurrentRelativeTeamUrl);

    const headerText = getChannelHeaderText(channel, dmUser);

    const markdownOptions = useMemo(() => ({
        singleline: false,
        ...MENTION_MARKDOWN_OPTIONS,
        channelNamesMap: isChannelNamesMap(channel?.props?.channel_mentions) ? channel.props.channel_mentions : undefined,
    }), [channel?.props?.channel_mentions]);

    const openModal = useCallback(() => {
        setShowModal(true);
    }, []);

    const closeModal = useCallback(() => {
        setShowModal(false);
    }, []);

    const handleMarkdownClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
        handleFormattedTextClick(event, currentRelativeTeamUrl);
    }, [currentRelativeTeamUrl]);

    if (!hasChannelHeaderText(channel, dmUser)) {
        return null;
    }

    const tooltip = intl.formatMessage({
        id: 'channel_header.headerText.viewButton',
        defaultMessage: 'View channel header',
    });

    const buttonClass = 'channel-header__icon channel-header__icon--left btn btn-icon btn-xs';

    return (
        <>
            <HeaderIconWrapper
                buttonClass={buttonClass}
                buttonId='channelHeaderContentButton'
                onClick={openModal}
                tooltip={tooltip}
            >
                <i
                    className='icon icon-text-box-outline'
                    aria-hidden='true'
                />
            </HeaderIconWrapper>
            <GenericModal
                id='channel-header-content-modal'
                compassDesign={true}
                modalHeaderText={intl.formatMessage({
                    id: 'channel_header.headerText.modalTitle',
                    defaultMessage: 'Channel header',
                })}
                show={showModal}
                onHide={closeModal}
                dataTestId='channelHeaderContentModal'
            >
                {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
                <div onClick={handleMarkdownClick}>
                    <Markdown
                        message={headerText}
                        options={markdownOptions}
                        imageProps={IMAGE_MARKDOWN_OPTIONS}
                    />
                </div>
            </GenericModal>
        </>
    );
};

export default ChannelHeaderContentButton;
