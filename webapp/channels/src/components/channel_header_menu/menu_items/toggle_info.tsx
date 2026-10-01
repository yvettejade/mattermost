// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';

import type * as Menu from 'components/menu';

interface Props extends Menu.FirstMenuItemProps {
    channel: Channel;
}

// The channel-info menu item was removed. The props type stays so header menus can keep passing them.
const ToggleInfo: (props: Props) => null = () => {
    return null;
};

export default ToggleInfo;
