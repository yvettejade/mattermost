// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import EditChannelHeaderModal from 'components/edit_channel_header_modal/edit_channel_header_modal';

import {fireEvent, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import Constants from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

describe('components/EditChannelHeaderModal', () => {
    const channel = TestHelper.getChannelMock({
        header: 'existing header',
        display_name: 'Town Square',
    });

    it('saves the trimmed header on Enter', async () => {
        const patchChannel = jest.fn().mockResolvedValue({data: true});

        renderWithContext(
            <EditChannelHeaderModal
                channel={channel}
                ctrlSend={false}
                onExited={jest.fn()}
                actions={{patchChannel}}
            />,
        );

        const textarea = screen.getByRole('textbox');
        fireEvent.change(textarea, {target: {value: '  weekly notes  '}});
        fireEvent.keyDown(textarea, {
            key: Constants.KeyCodes.ENTER[0],
            keyCode: Constants.KeyCodes.ENTER[1],
        });

        await waitFor(() => {
            expect(patchChannel).toHaveBeenCalledWith('channel_id', {header: 'weekly notes'});
        });
    });

    it('does not call patch and shows the existing error when the header exceeds 1024 code points', async () => {
        const patchChannel = jest.fn().mockResolvedValue({data: true});
        const longChannel = TestHelper.getChannelMock({
            ...channel,
            header: 'a'.repeat(1025),
        });

        renderWithContext(
            <EditChannelHeaderModal
                channel={longChannel}
                ctrlSend={false}
                onExited={jest.fn()}
                actions={{patchChannel}}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: /save/i}));

        expect(patchChannel).not.toHaveBeenCalled();
        expect(screen.getByText(/exceeds the character limit/)).toBeInTheDocument();
    });

    it('allows a header of 1024 emoji code points', async () => {
        const patchChannel = jest.fn().mockResolvedValue({data: true});
        const header = '👍'.repeat(1024);
        const emojiChannel = TestHelper.getChannelMock({
            ...channel,
            header,
        });

        renderWithContext(
            <EditChannelHeaderModal
                channel={emojiChannel}
                ctrlSend={false}
                onExited={jest.fn()}
                actions={{patchChannel}}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: /save/i}));

        expect(patchChannel).toHaveBeenCalledWith('channel_id', {header});
    });

    it('does not call patch when Cancel is clicked', async () => {
        const patchChannel = jest.fn().mockResolvedValue({data: true});

        renderWithContext(
            <EditChannelHeaderModal
                channel={channel}
                ctrlSend={false}
                onExited={jest.fn()}
                actions={{patchChannel}}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: /cancel/i}));

        expect(patchChannel).not.toHaveBeenCalled();
    });

    it('uses the DM title when the channel is a direct message', () => {
        const dmChannel = TestHelper.getChannelMock({
            type: 'D',
            display_name: 'alice',
            header: '',
        });

        renderWithContext(
            <EditChannelHeaderModal
                channel={dmChannel}
                ctrlSend={false}
                onExited={jest.fn()}
                actions={{patchChannel: jest.fn()}}
            />,
        );

        expect(screen.getByText('Edit Header')).toBeInTheDocument();
        expect(document.getElementById('editChannelHeaderModalLabel')).toBeInTheDocument();
        expect(document.getElementById('edit_textbox')).toBeInTheDocument();
    });
});
