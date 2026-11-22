// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {FC} from 'react';

import type {Channel} from '@mattermost/types/channels';

import type * as Menu from 'components/menu';

interface Props extends Menu.FirstMenuItemProps {
    channel: Channel;
}

const ToggleInfo: FC<Props> = () => {
    return null;
};

export default ToggleInfo;
