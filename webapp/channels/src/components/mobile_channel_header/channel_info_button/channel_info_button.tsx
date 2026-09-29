// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';

type Props = {
    channel: Channel;
    actions: {
        showChannelInfo: (channelId: string) => void;
    };
};

// Channel info no longer opens a sidebar. Hide the mobile control rather than
// showing an Info button that dispatches a no-op.
const NavbarInfoButton: (props: Props) => JSX.Element | null = () => {
    return null;
};

export default NavbarInfoButton;
