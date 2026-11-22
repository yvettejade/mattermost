// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';

import {closeRightHandSide, showChannelInfo} from 'actions/views/rhs';
import {getIsRhsOpen, getRhsState} from 'selectors/rhs';

import {RHSStates} from 'utils/constants';

import type {RhsState} from 'types/store/rhs';

import HeaderIconWrapper from './components/header_icon_wrapper';

interface Props {
    channel: Channel;
}

const ChannelInfoButton = ({channel}: Props) => {
    const dispatch = useDispatch();
    const intl = useIntl();

    const rhsState: RhsState = useSelector(getRhsState);
    const isRhsOpen: boolean = useSelector(getIsRhsOpen);

    const buttonActive = isRhsOpen && rhsState === RHSStates.CHANNEL_INFO;

    const toggleRHS = useCallback(() => {
        if (buttonActive) {
            dispatch(closeRightHandSide());
        } else {
            dispatch(showChannelInfo(channel.id));
        }
    }, [buttonActive, channel.id, dispatch]);

    const tooltip = buttonActive ? intl.formatMessage({id: 'channel_header.closeChannelInfo', defaultMessage: 'Close channel info'}) : intl.formatMessage({id: 'channel_header.openChannelInfo', defaultMessage: 'Channel info'});

    const buttonClass = classNames('channel-header__icon channel-header__icon--left btn btn-icon btn-xs', {
        'channel-header__icon--active': buttonActive,
    });

    return (
        <HeaderIconWrapper
            buttonClass={buttonClass}
            buttonId='channel-info-rhs-btn'
            onClick={toggleRHS}
            tooltip={tooltip}
        >
            <i
                aria-hidden='true'
                className='icon icon-information-outline'
            />
        </HeaderIconWrapper>
    );
};

export default ChannelInfoButton;
