// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import EditChannelHeaderModal from 'components/edit_channel_header_modal/edit_channel_header_modal';

import {act, renderWithContext, screen, userEvent, fireEvent} from 'tests/react_testing_utils';
import Constants from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

describe('components/EditChannelHeaderModal', () => {
    const channel = TestHelper.getChannelMock({
        id: 'channel_id',
        header: '  existing header  ',
        display_name: 'Town Square',
        type: 'O',
    });

    it('calls patch with the trimmed header when Enter is pressed', async () => {
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
        await act(async () => {
            textarea.dispatchEvent(new KeyboardEvent('keydown', {
                key: Constants.KeyCodes.ENTER[0],
                keyCode: Constants.KeyCodes.ENTER[1],
                bubbles: true,
            }));
        });

        expect(patchChannel).toHaveBeenCalledWith('channel_id', {header: 'existing header'});
    });

    it('does not call patch and shows the limit error above 1024 code points', async () => {
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
        const header = '😀'.repeat(1024);

        renderWithContext(
            <EditChannelHeaderModal
                channel={channel}
                ctrlSend={false}
                onExited={jest.fn()}
                actions={{patchChannel}}
            />,
        );

        fireEvent.change(screen.getByRole('textbox'), {target: {value: header}});
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

    it('saves on Ctrl+Enter when ctrl send is enabled', async () => {
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
        });

        expect(patchChannel).toHaveBeenCalledWith('channel_id', {header: 'existing header'});
    });
});
