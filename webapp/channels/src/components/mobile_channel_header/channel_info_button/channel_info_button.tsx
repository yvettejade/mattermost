// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';

type Props = {
    channel: Channel;
    actions: {
        showChannelInfo: (channelId: string) => void;
    };
};

// Mobile channel info was removed. The props type stays so the header can keep passing the channel.
const NavbarInfoButton: (props: Props) => null = () => {
    return null;
};

export default NavbarInfoButton;
