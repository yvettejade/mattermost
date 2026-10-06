// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelInfoButton from './channel_info_button';

describe('components/ChannelHeaderMobile/ChannelInfoButton', () => {
    const baseProps = {
        channel: TestHelper.getChannelMock({
            id: 'channel_id',
        }),
        actions: {
            showChannelInfo: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <ChannelInfoButton {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('opens channel info on click', async () => {
        renderWithContext(
            <ChannelInfoButton {...baseProps}/>,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Info'}));
        expect(baseProps.actions.showChannelInfo).toHaveBeenCalledWith('channel_id');
    });
});
