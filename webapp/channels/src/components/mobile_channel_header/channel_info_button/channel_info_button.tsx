// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';

type Props = {
    channel: Channel;
    actions: {
        showChannelInfo: (channelId: string) => void;
    };
};

const NavbarInfoButton = ({channel, actions}: Props) => {
    const {formatMessage} = useIntl();

    return (
        <button
            className='navbar-toggle navbar-right__icon navbar-info-button pull-right'
            type='button'
            aria-label={formatMessage({id: 'channel_header.mobileInfo', defaultMessage: 'Info'})}
            onClick={() => actions.showChannelInfo(channel.id)}
        >
            <i
                className='icon icon-information-outline'
                aria-hidden={true}
            />
        </button>
    );
};

export default NavbarInfoButton;
