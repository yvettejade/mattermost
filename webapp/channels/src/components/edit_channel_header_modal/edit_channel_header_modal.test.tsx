// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import EditChannelHeaderModal from 'components/edit_channel_header_modal/edit_channel_header_modal';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

describe('components/EditChannelHeaderModal', () => {
    const channel = TestHelper.getChannelMock({
        id: 'channel_id',
        display_name: 'Town Square',
        header: '  existing header  ',
        type: 'O',
    });

    it('calls patch with the trimmed header when Enter is pressed', async () => {
        const patchChannel = jest.fn().mockResolvedValue({data: channel});

        renderWithContext(
            <EditChannelHeaderModal
                channel={channel}
                ctrlSend={false}
                onExited={jest.fn()}
                actions={{patchChannel}}
            />,
        );

        const textbox = screen.getByPlaceholderText('Enter the Channel Header');
        await userEvent.clear(textbox);
        await userEvent.type(textbox, '  new header  {Enter}');

        expect(patchChannel).toHaveBeenCalledTimes(1);
        expect(patchChannel).toHaveBeenCalledWith(channel.id, {header: 'new header'});
    });

    it('does not call patch and shows an error when the header exceeds 1024 code points', async () => {
        const patchChannel = jest.fn().mockResolvedValue({data: channel});

        renderWithContext(
            <EditChannelHeaderModal
                channel={{...channel, header: ''}}
                ctrlSend={false}
                onExited={jest.fn()}
                actions={{patchChannel}}
            />,
        );

        const textbox = screen.getByPlaceholderText('Enter the Channel Header');
        await userEvent.click(textbox);
        await userEvent.paste('a'.repeat(1025));
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(patchChannel).not.toHaveBeenCalled();
        expect(screen.getByText('The text entered exceeds the character limit. The channel header is limited to 1024 characters.')).toBeInTheDocument();
    });

    it('allows a header of 1024 emoji code points', async () => {
        const patchChannel = jest.fn().mockResolvedValue({data: channel});
        const emojiHeader = '😀'.repeat(1024);

        renderWithContext(
            <EditChannelHeaderModal
                channel={{...channel, header: ''}}
                ctrlSend={false}
                onExited={jest.fn()}
                actions={{patchChannel}}
            />,
        );

        const textbox = screen.getByPlaceholderText('Enter the Channel Header');
        await userEvent.click(textbox);
        await userEvent.paste(emojiHeader);
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(patchChannel).toHaveBeenCalledTimes(1);
        expect(patchChannel).toHaveBeenCalledWith(channel.id, {header: emojiHeader});
    });

    it('does not call patch when Cancel is clicked', async () => {
        const patchChannel = jest.fn().mockResolvedValue({data: channel});

        renderWithContext(
            <EditChannelHeaderModal
                channel={channel}
                ctrlSend={false}
                onExited={jest.fn()}
                actions={{patchChannel}}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

        expect(patchChannel).not.toHaveBeenCalled();
    });
});
