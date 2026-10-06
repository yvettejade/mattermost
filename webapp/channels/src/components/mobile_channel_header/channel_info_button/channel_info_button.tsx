// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';

import InfoIcon from 'components/widgets/icons/info_icon';

type Props = {
    channel: Channel;
    actions: {
        showChannelInfo: (channelId: string) => void;
    };
};

const NavbarInfoButton = ({channel, actions}: Props) => {
    const intl = useIntl();

    const handleClick = () => {
        actions.showChannelInfo(channel.id);
    };

    return (
        <button
            type='button'
            className='navbar-toggle navbar-right__icon navbar-info-button pull-right'
            onClick={handleClick}
            aria-label={intl.formatMessage({id: 'accessibility.button.Info', defaultMessage: 'Info'})}
        >
            <InfoIcon
                className='icon icon__info'
                aria-hidden='true'
            />
        </button>
    );
};

export default React.memo(NavbarInfoButton);
