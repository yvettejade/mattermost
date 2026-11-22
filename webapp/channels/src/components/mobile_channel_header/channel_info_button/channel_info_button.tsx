// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {FC} from 'react';

import type {Channel} from '@mattermost/types/channels';

type Props = {
    channel: Channel;
    actions: {
        showChannelInfo: (channelId: string) => void;
    };
};

const NavbarInfoButton: FC<Props> = () => {
    return null;
};

export default NavbarInfoButton;
