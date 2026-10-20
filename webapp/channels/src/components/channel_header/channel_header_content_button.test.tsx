// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelHeaderContentButton from './channel_header_content_button';

describe('ChannelHeaderContentButton', () => {
    test('does not render when channel has no header content', () => {
        const channel = TestHelper.getChannelMock({header: ''});
        const {container} = renderWithContext(
            <ChannelHeaderContentButton channel={channel}/>,
        );

        expect(container).toBeEmptyDOMElement();
    });

    test('opens modal with header content when the button is clicked', async () => {
        const channel = TestHelper.getChannelMock({header: 'Welcome to the channel'});
        renderWithContext(
            <ChannelHeaderContentButton channel={channel}/>,
        );

        expect(screen.queryByTestId('channelHeaderContentModal')).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: 'View channel header'}));

        expect(screen.getByTestId('channelHeaderContentModal')).toBeInTheDocument();
        expect(screen.getByText('Welcome to the channel')).toBeInTheDocument();
    });
});
