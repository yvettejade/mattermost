// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {InformationOutlineIcon} from '@mattermost/compass-icons/components';
import type {Channel} from '@mattermost/types/channels';

import {closeRightHandSide, showChannelInfo} from 'actions/views/rhs';
import {getIsRhsOpen, getRhsState} from 'selectors/rhs';

import * as Menu from 'components/menu';

import {RHSStates} from 'utils/constants';

interface Props extends Menu.FirstMenuItemProps {
    channel: Channel;
}

const isInfoFamily = (rhsState: string | null) => {
    return rhsState === RHSStates.CHANNEL_INFO ||
        rhsState === RHSStates.CHANNEL_MEMBERS ||
        rhsState === RHSStates.CHANNEL_FILES ||
        rhsState === RHSStates.PIN;
};

const ToggleInfo = ({channel, ...rest}: Props) => {
    const dispatch = useDispatch();
    const rhsState = useSelector(getRhsState);
    const isRhsOpen = useSelector(getIsRhsOpen);
    const isOpen = isRhsOpen && isInfoFamily(rhsState);

    const handleClick = () => {
        if (isOpen) {
            dispatch(closeRightHandSide());
            return;
        }
        dispatch(showChannelInfo(channel.id));
    };

    return (
        <Menu.Item
            leadingElement={<InformationOutlineIcon size={16}/>}
            id='channelHeaderToggleInfo'
            onClick={handleClick}
            labels={isOpen ? (
                <FormattedMessage
                    id='channel_header.closeChannelInfo'
                    defaultMessage='Close Info'
                />
            ) : (
                <FormattedMessage
                    id='channel_header.openChannelInfo'
                    defaultMessage='View Info'
                />
            )}
            {...rest}
        />
    );
};

export default ToggleInfo;
