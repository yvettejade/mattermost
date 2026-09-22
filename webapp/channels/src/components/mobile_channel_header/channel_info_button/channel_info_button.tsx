// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';

type Props = {
    channel: Channel;
    actions: {
        showChannelInfo: (channelId: string) => void;
    };
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const NavbarInfoButton = (_props: Props) => {
    return null;
};

export default NavbarInfoButton;
