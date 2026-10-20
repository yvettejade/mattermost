// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';

import Markdown from 'components/markdown';

import {isChannelNamesMap} from 'utils/text_formatting';

import './channel_header_content_modal.scss';

type Props = {
    show: boolean;
    channelDisplayName: string;
    headerText: string;
    channelMentionsNameMap?: Record<string, string>;
    onHide: () => void;
};

const ChannelHeaderContentModal = ({
    show,
    channelDisplayName,
    headerText,
    channelMentionsNameMap,
    onHide,
}: Props): JSX.Element | null => {
    const {formatMessage} = useIntl();
    const hasHeaderText = headerText.trim().length > 0;

    return (
        <GenericModal
            id='channelHeaderContentModal'
            className='ChannelHeaderContentModal a11y__modal'
            dataTestId='channelHeaderContentModal'
            show={show}
            onHide={onHide}
            compassDesign={true}
            modalHeaderText={formatMessage({
                id: 'global_header.channel_header_modal.title',
                defaultMessage: 'Channel header for {channelName}',
            }, {channelName: channelDisplayName})}
        >
            {hasHeaderText ? (
                <Markdown
                    message={headerText}
                    options={{
                        channelNamesMap: isChannelNamesMap(channelMentionsNameMap) ? channelMentionsNameMap : undefined,
                    }}
                />
            ) : (
                <p
                    className='ChannelHeaderContentModal__empty'
                    data-testid='channelHeaderContentModalEmpty'
                >
                    <FormattedMessage
                        id='global_header.channel_header_modal.empty'
                        defaultMessage='This channel does not have a header.'
                    />
                </p>
            )}
        </GenericModal>
    );
};

export default ChannelHeaderContentModal;
