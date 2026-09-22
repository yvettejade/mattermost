// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {closeRightHandSide, showAssistant} from 'actions/views/rhs';
import {getRhsState} from 'selectors/rhs';

import {RHSStates} from 'utils/constants';

import HeaderIconWrapper from './components/header_icon_wrapper';

const AssistantButton = () => {
    const dispatch = useDispatch();
    const intl = useIntl();
    const rhsState = useSelector(getRhsState);
    const active = rhsState === RHSStates.ASSISTANT;

    const toggle = useCallback(() => {
        if (active) {
            dispatch(closeRightHandSide());
            return;
        }
        dispatch(showAssistant());
    }, [active, dispatch]);

    const tooltip = active ? intl.formatMessage({
        id: 'channel_header.closeAssistant',
        defaultMessage: 'Close assistant',
    }) : intl.formatMessage({
        id: 'channel_header.openAssistant',
        defaultMessage: 'Assistant',
    });

    const buttonClass = classNames('channel-header__icon channel-header__icon--left btn btn-icon btn-xs', {
        'channel-header__icon--active': active,
    });

    return (
        <HeaderIconWrapper
            buttonClass={buttonClass}
            buttonId='channelHeaderAssistantButton'
            onClick={toggle}
            tooltip={tooltip}
            ariaLabelOverride={tooltip}
        >
            <i className='icon icon-robot-happy'/>
        </HeaderIconWrapper>
    );
};

export default AssistantButton;
