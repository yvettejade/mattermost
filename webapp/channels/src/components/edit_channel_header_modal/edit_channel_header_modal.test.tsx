// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {act, fireEvent, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import Constants from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import EditChannelHeaderModal from './edit_channel_header_modal';

describe('components/EditChannelHeaderModal', () => {
    const channel = TestHelper.getChannelMock({
        id: 'channel_id',
        display_name: 'Town Square',
        header: '  current header  ',
        type: 'O',
    });

    it('saves the trimmed header when Enter is pressed', async () => {
        const patchChannel = jest.fn().mockResolvedValue({data: true});

        renderWithContext(
            <EditChannelHeaderModal
                channel={channel}
                ctrlSend={false}
                onExited={jest.fn()}
                actions={{patchChannel}}
            />,
        );

        expect(document.getElementById('editChannelHeaderModalLabel')).toBeInTheDocument();
        const textarea = screen.getByPlaceholderText('Enter the Channel Header');
        expect(textarea).toHaveAttribute('id', 'edit_textbox');

        await act(async () => {
            textarea.dispatchEvent(new KeyboardEvent('keydown', {
                key: Constants.KeyCodes.ENTER[0],
                keyCode: Constants.KeyCodes.ENTER[1],
                bubbles: true,
            }));
        });

        expect(patchChannel).toHaveBeenCalledWith('channel_id', {header: 'current header'});
    });

    it('saves on ctrl+enter and cmd+enter when ctrl send is enabled', async () => {
        const patchChannel = jest.fn().mockResolvedValue({data: true});

        renderWithContext(
            <EditChannelHeaderModal
                channel={channel}
                ctrlSend={true}
                onExited={jest.fn()}
                actions={{patchChannel}}
            />,
        );

        const textarea = screen.getByRole('textbox');
        await act(async () => {
            textarea.dispatchEvent(new KeyboardEvent('keydown', {
                key: Constants.KeyCodes.ENTER[0],
                keyCode: Constants.KeyCodes.ENTER[1],
                ctrlKey: true,
                bubbles: true,
            }));
            textarea.dispatchEvent(new KeyboardEvent('keydown', {
                key: Constants.KeyCodes.ENTER[0],
                keyCode: Constants.KeyCodes.ENTER[1],
                metaKey: true,
                bubbles: true,
            }));
        });

        expect(patchChannel).toHaveBeenCalledTimes(2);
        expect(patchChannel).toHaveBeenCalledWith('channel_id', {header: 'current header'});
    });

    it('does not patch a header longer than 1024 code points and shows the limit error', async () => {
        const patchChannel = jest.fn().mockResolvedValue({data: true});

        renderWithContext(
            <EditChannelHeaderModal
                channel={channel}
                ctrlSend={false}
                onExited={jest.fn()}
                actions={{patchChannel}}
            />,
        );

        fireEvent.change(screen.getByRole('textbox'), {target: {value: 'a'.repeat(1025)}});
        await userEvent.click(screen.getByRole('button', {name: /save/i}));

        expect(patchChannel).not.toHaveBeenCalled();
        expect(screen.getByText('The text entered exceeds the character limit. The channel header is limited to 1024 characters.')).toBeInTheDocument();
    });

    it('allows a header of 1024 emoji code points', async () => {
        const patchChannel = jest.fn().mockResolvedValue({data: true});
        const emojiHeader = '👍'.repeat(1024);

        renderWithContext(
            <EditChannelHeaderModal
                channel={channel}
                ctrlSend={false}
                onExited={jest.fn()}
                actions={{patchChannel}}
            />,
        );

        fireEvent.change(screen.getByRole('textbox'), {target: {value: emojiHeader}});
        await userEvent.click(screen.getByRole('button', {name: /save/i}));

        expect(patchChannel).toHaveBeenCalledWith('channel_id', {header: emojiHeader});
    });

    it('does not patch when cancel is clicked', async () => {
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

    it('uses the direct-message title for a DM', () => {
        renderWithContext(
            <EditChannelHeaderModal
                channel={{...channel, type: 'D', display_name: ''}}
                ctrlSend={false}
                onExited={jest.fn()}
                actions={{patchChannel: jest.fn()}}
            />,
        );

        expect(document.getElementById('editChannelHeaderModalLabel')).toHaveTextContent('Edit Header');
        expect(document.getElementById('editChannelHeaderModalLabel')).not.toHaveTextContent('Town Square');
    });
});
