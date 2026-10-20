// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import type {MouseEvent} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {Channel, ChannelMembership} from '@mattermost/types/channels';

import {Permissions} from 'mattermost-redux/constants';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';

import Markdown from 'components/markdown';

import {Constants} from 'utils/constants';
import type {ChannelNamesMap} from 'utils/text_formatting';
import {isChannelNamesMap} from 'utils/text_formatting';
import {handleFormattedTextClick} from 'utils/utils';

import type {GlobalState} from 'types/store';

import HeaderIconWrapper from './components/header_icon_wrapper';

import './channel_header_view_button.scss';

interface Props {
    channel: Channel;
    channelMember?: ChannelMembership;
}

const MARKDOWN_OPTIONS = {
    singleline: false,
    mentionHighlight: false,
    atMentions: true,
};

const IMAGE_MARKDOWN_OPTIONS = {hideUtilities: true};

const ChannelHeaderViewButton = ({channel, channelMember}: Props) => {
    const intl = useIntl();
    const [isModalOpen, setModalOpen] = useState(false);
    const currentRelativeTeamUrl = useSelector(getCurrentRelativeTeamUrl);

    const canReadChannel = useSelector((state: GlobalState) => {
        if (!channelMember) {
            return false;
        }
        return haveIChannelPermission(state, channel.team_id, channel.id, Permissions.READ_CHANNEL);
    });

    const channelMentionsNameMap: ChannelNamesMap | undefined = useMemo(() => {
        return isChannelNamesMap(channel.props?.channel_mentions) ? channel.props.channel_mentions : undefined;
    }, [channel.props?.channel_mentions]);

    const markdownOptions = useMemo(() => ({
        ...MARKDOWN_OPTIONS,
        channelNamesMap: channelMentionsNameMap,
    }), [channelMentionsNameMap]);

    const headerText = channel.header?.trim() ?? '';
    const hasHeaderText = headerText.length > 0;

    const openModal = useCallback(() => {
        setModalOpen(true);
    }, []);

    const closeModal = useCallback(() => {
        setModalOpen(false);
    }, []);

    const handleMarkdownClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
        handleFormattedTextClick(event, currentRelativeTeamUrl);
    }, [currentRelativeTeamUrl]);

    if (channel.type === Constants.DM_CHANNEL || !channelMember || !canReadChannel) {
        return null;
    }

    const tooltip = intl.formatMessage({
        id: 'channel_header.viewChannelHeader',
        defaultMessage: 'View channel header',
    });

    return (
        <>
            <HeaderIconWrapper
                buttonClass='channel-header__icon channel-header__icon--left btn btn-icon btn-xs'
                buttonId='channelHeaderViewButton'
                onClick={openModal}
                tooltip={tooltip}
            >
                <i
                    aria-hidden='true'
                    className='icon icon-text-box-outline'
                />
            </HeaderIconWrapper>
            {isModalOpen && (
                <GenericModal
                    id='channelHeaderViewModal'
                    className='ChannelHeaderViewModal'
                    modalHeaderText={intl.formatMessage({
                        id: 'channel_header.viewChannelHeader.modal.title',
                        defaultMessage: 'Channel header',
                    })}
                    show={isModalOpen}
                    onHide={closeModal}
                    onExited={closeModal}
                    handleCancel={closeModal}
                    cancelButtonText={intl.formatMessage({
                        id: 'channel_header.viewChannelHeader.modal.close',
                        defaultMessage: 'Close',
                    })}
                    compassDesign={true}
                >
                    {hasHeaderText ? (
                        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                        <div
                            className='ChannelHeaderViewModal__content'
                            data-testid='channelHeaderViewModalContent'
                            onClick={handleMarkdownClick}
                        >
                            <Markdown
                                message={headerText}
                                options={markdownOptions}
                                imageProps={IMAGE_MARKDOWN_OPTIONS}
                            />
                        </div>
                    ) : (
                        <p
                            className='ChannelHeaderViewModal__empty'
                            data-testid='channelHeaderViewModalEmpty'
                        >
                            {intl.formatMessage({
                                id: 'channel_header.viewChannelHeader.empty',
                                defaultMessage: 'This channel does not have a header.',
                            })}
                        </p>
                    )}
                </GenericModal>
            )}
        </>
    );
};

export default ChannelHeaderViewButton;
