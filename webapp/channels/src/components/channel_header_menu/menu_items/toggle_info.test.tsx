// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ToggleInfo from './toggle_info';

describe('components/ChannelHeaderMenu/MenuItems/ToggleInfo', () => {
    test('does not render the channel info menu item', () => {
        const channel = TestHelper.getChannelMock();

        renderWithContext(
            <WithTestMenuContext>
                <ToggleInfo channel={channel}/>
            </WithTestMenuContext>,
        );

        expect(screen.queryByText('View Info')).not.toBeInTheDocument();
        expect(screen.queryByText('Close Info')).not.toBeInTheDocument();
    });
});
