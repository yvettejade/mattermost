// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';

import {closeRightHandSide} from 'actions/views/rhs';
import {getIsRhsOpen, getRhsState} from 'selectors/rhs';

import {RHSStates} from 'utils/constants';

type Props = {
    channel: Channel;
    actions: {
        showChannelInfo: (channelId: string) => void;
    };
};

const isInfoFamily = (rhsState: string | null) => {
    return rhsState === RHSStates.CHANNEL_INFO ||
        rhsState === RHSStates.CHANNEL_MEMBERS ||
        rhsState === RHSStates.CHANNEL_FILES ||
        rhsState === RHSStates.PIN;
};

const NavbarInfoButton = ({channel, actions}: Props) => {
    const intl = useIntl();
    const dispatch = useDispatch();
    const rhsState = useSelector(getRhsState);
    const isRhsOpen = useSelector(getIsRhsOpen);
    const isOpen = isRhsOpen && isInfoFamily(rhsState);

    const toggleRHS = () => {
        if (isOpen) {
            dispatch(closeRightHandSide());
            return;
        }
        actions.showChannelInfo(channel.id);
    };

    return (
        <button
            type='button'
            className='navbar-toggle navbar-right__icon pull-right'
            id='channel-info-btn'
            onClick={toggleRHS}
            aria-label={intl.formatMessage({
                id: 'channel_header.openChannelInfo',
                defaultMessage: 'View Info',
            })}
        >
            <i
                className='icon icon-information-outline'
                aria-hidden={true}
            />
        </button>
    );
};

export default NavbarInfoButton;
