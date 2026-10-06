// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {InformationOutlineIcon} from '@mattermost/compass-icons/components';
import type {Channel} from '@mattermost/types/channels';

import {closeRightHandSide, showChannelInfo} from 'actions/views/rhs';
import {getIsRhsOpen, getRhsState} from 'selectors/rhs';

import {isChannelInfoButtonActive} from 'components/channel_header/channel_info_button';
import * as Menu from 'components/menu';

interface Props extends Menu.FirstMenuItemProps {
    channel: Channel;
}

const ToggleInfo = ({channel, ...rest}: Props) => {
    const dispatch = useDispatch();
    const rhsState = useSelector(getRhsState);
    const isRhsOpen = useSelector(getIsRhsOpen);
    const isInfoActive = isRhsOpen && isChannelInfoButtonActive(rhsState);

    const handleClick = () => {
        if (isInfoActive) {
            dispatch(closeRightHandSide());
        } else {
            dispatch(showChannelInfo(channel.id));
        }
    };

    return (
        <Menu.Item
            leadingElement={<InformationOutlineIcon size={16}/>}
            onClick={handleClick}
            labels={isInfoActive ? (
                <FormattedMessage
                    id='channelHeader.hideInfo'
                    defaultMessage='Close Info'
                />
            ) : (
                <FormattedMessage
                    id='channelHeader.viewInfo'
                    defaultMessage='View Info'
                />
            )}
            {...rest}
        />
    );
};

export default ToggleInfo;
