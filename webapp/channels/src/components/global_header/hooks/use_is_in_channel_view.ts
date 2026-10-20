// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {matchPath, useLocation} from 'react-router-dom';

export function useIsInChannelView(): boolean {
    const {pathname} = useLocation();

    return Boolean(matchPath(pathname, {
        path: '/:team/:section(channels|messages)/:identifier',
    }));
}
