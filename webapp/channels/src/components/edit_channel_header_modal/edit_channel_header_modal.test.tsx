// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import EditChannelHeaderModal from './edit_channel_header_modal';

describe('components/EditChannelHeaderModal', () => {
    const channel = TestHelper.getChannelMock({
        header: 'existing header',
        display_name: 'Town Square',
    });

    test('should render current header and save via patchChannel', async () => {
        const patchChannel = jest.fn().mockResolvedValue({data: {}});
        const onExited = jest.fn();

        renderWithContext(
            <EditChannelHeaderModal
                channel={channel}
                ctrlSend={true}
                onExited={onExited}
                actions={{patchChannel}}
            />,
        );

        expect(screen.getByText('Edit Header for Town Square')).toBeInTheDocument();
        expect(screen.getByDisplayValue('existing header')).toBeInTheDocument();

        await userEvent.clear(screen.getByDisplayValue('existing header'));
        await userEvent.type(screen.getByRole('textbox'), 'updated header');
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(patchChannel).toHaveBeenCalledWith(channel.id, {header: 'updated header'});
    });

    test('should use the DM title when editing a direct message header', () => {
        const dmChannel = TestHelper.getChannelMock({
            type: 'D',
            header: '',
        });

        renderWithContext(
            <EditChannelHeaderModal
                channel={dmChannel}
                ctrlSend={true}
                onExited={jest.fn()}
                actions={{patchChannel: jest.fn()}}
            />,
        );

        expect(screen.getByText('Edit Header')).toBeInTheDocument();
        expect(screen.queryByText(/Edit Header for/)).not.toBeInTheDocument();
    });
});
