// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {closeRightHandSide, showAssistant} from 'actions/views/rhs';
import {getRhsState} from 'selectors/rhs';

import {RHSStates} from 'utils/constants';

type Props = {
    collapsed: boolean;
};

const SidebarMatterBot = ({collapsed}: Props) => {
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

    const label = intl.formatMessage({
        id: 'sidebar.matterbot',
        defaultMessage: 'MatterBot',
    });

    return (
        <div
            className={classNames('SidebarChannel', {
                collapsed,
                expanded: !collapsed,
                active,
            })}
        >
            <button
                type='button'
                id='sidebarItem_matterbot'
                className='SidebarLink'
                aria-label={label}
                onClick={toggle}
            >
                <i className='icon icon-robot-happy'/>
                <div className='SidebarChannelLinkLabel_wrapper'>
                    <span className='SidebarChannelLinkLabel'>
                        {label}
                    </span>
                </div>
            </button>
        </div>
    );
};

export default SidebarMatterBot;
