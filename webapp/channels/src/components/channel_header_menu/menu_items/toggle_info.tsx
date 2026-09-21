// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';

import * as Menu from 'components/menu';

interface Props extends Menu.FirstMenuItemProps {
    channel: Channel;
}

const ToggleInfo = (_props: Props) => {
    return null;
};

export default ToggleInfo;
