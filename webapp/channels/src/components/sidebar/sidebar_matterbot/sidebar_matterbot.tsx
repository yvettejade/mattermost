// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';

import {showAssistant} from 'actions/views/rhs';

import './sidebar_matterbot.scss';

type Props = {
    className?: string;
};

function SidebarMatterBot({className}: Props) {
    const intl = useIntl();
    const dispatch = useDispatch();
    const currentChannelId = useSelector(getCurrentChannelId);

    const handleClick = useCallback(() => {
        dispatch(showAssistant(currentChannelId));
    }, [currentChannelId, dispatch]);

    return (
        <button
            type='button'
            id='sidebarMatterBotButton'
            className={`intro-links color--link cursor--pointer SidebarMatterBot${className ? ` ${className}` : ''}`}
            onClick={handleClick}
            aria-label={intl.formatMessage({id: 'sidebar.matterbot', defaultMessage: 'MatterBot'})}
        >
            <div className='SidebarChannelNavigator__inviteMembersLhsButton'>
                <i
                    className='icon-robot-happy'
                    aria-hidden={true}
                />
                <FormattedMessage
                    id='sidebar.matterbot'
                    defaultMessage='MatterBot'
                />
            </div>
        </button>
    );
}

export default SidebarMatterBot;
