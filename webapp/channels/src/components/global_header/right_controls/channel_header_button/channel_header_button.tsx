// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {General} from 'mattermost-redux/constants';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUser, getUser} from 'mattermost-redux/selectors/entities/users';
import {getUserIdFromChannelName} from 'mattermost-redux/utils/channel_utils';

import IconButton from 'components/global_header/header_icon_button';
import {useIsInChannelView} from 'components/global_header/hooks/use_is_in_channel_view';
import {getChannelHeaderDisplayText} from 'components/global_header/utils/get_channel_header_display_text';

import {isChannelNamesMap} from 'utils/text_formatting';

import type {GlobalState} from 'types/store';

import ChannelHeaderContentModal from './channel_header_content_modal';

const ChannelHeaderButton = (): JSX.Element | null => {
    const {formatMessage} = useIntl();
    const isInChannelView = useIsInChannelView();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const channel = useSelector(getCurrentChannel);
    const currentUser = useSelector(getCurrentUser);

    const dmUser = useSelector((state: GlobalState) => {
        if (!channel || channel.type !== General.DM_CHANNEL) {
            return undefined;
        }
        const dmUserId = getUserIdFromChannelName(currentUser.id, channel.name);
        return getUser(state, dmUserId);
    });

    const headerText = getChannelHeaderDisplayText(channel, dmUser);

    const channelMentionsNameMap = useMemo(() => {
        if (isChannelNamesMap(channel?.props?.channel_mentions)) {
            return channel.props.channel_mentions;
        }
        return undefined;
    }, [channel?.props?.channel_mentions]);

    if (!isInChannelView || !channel) {
        return null;
    }

    const openModal = () => setIsModalOpen(true);
    const closeModal = () => setIsModalOpen(false);

    return (
        <>
            <WithTooltip
                title={
                    <FormattedMessage
                        id='global_header.channel_header_button.tooltip'
                        defaultMessage='View channel header'
                    />
                }
            >
                <IconButton
                    id='globalHeaderChannelHeaderButton'
                    icon='file-text-outline'
                    onClick={openModal}
                    aria-expanded={isModalOpen}
                    aria-controls='channelHeaderContentModal'
                    aria-label={formatMessage({
                        id: 'global_header.channel_header_button.aria_label',
                        defaultMessage: 'View channel header',
                    })}
                />
            </WithTooltip>
            {isModalOpen && (
                <ChannelHeaderContentModal
                    show={isModalOpen}
                    channelDisplayName={channel.display_name}
                    headerText={headerText}
                    channelMentionsNameMap={channelMentionsNameMap}
                    onHide={closeModal}
                />
            )}
        </>
    );
};

export default ChannelHeaderButton;
