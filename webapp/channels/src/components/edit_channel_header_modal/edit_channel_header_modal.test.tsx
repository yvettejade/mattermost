// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import Constants from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import EditChannelHeaderModal, {HEADER_MAX_LENGTH} from './edit_channel_header_modal';

describe('components/EditChannelHeaderModal', () => {
    const channel = TestHelper.getChannelMock({
        header: 'test header',
        display_name: 'Town Square',
    });

    it('should render the channel title and existing header', () => {
        renderWithContext(
            <EditChannelHeaderModal
                channel={channel}
                ctrlSend={true}
                onExited={jest.fn()}
                actions={{patchChannel: jest.fn()}}
            />,
        );

        expect(screen.getByText('Edit Header for Town Square')).toBeInTheDocument();
        expect(screen.getByRole('textbox')).toHaveValue('test header');
        expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', String(HEADER_MAX_LENGTH));
    });

    it('should render the DM title', () => {
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
    });

    it('should patch the current channel header on save', async () => {
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
        await userEvent.clear(textarea);
        await userEvent.type(textarea, 'new header');
        await userEvent.click(screen.getByRole('button', {name: /save/i}));

        expect(patchChannel).toHaveBeenCalledWith('channel_id', {header: 'new header'});
    });

    it('should show a server error and stay open when patch fails', async () => {
        const patchChannel = jest.fn().mockResolvedValue({error: {message: 'cannot save'}});

        renderWithContext(
            <EditChannelHeaderModal
                channel={channel}
                ctrlSend={true}
                onExited={jest.fn()}
                actions={{patchChannel}}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: /save/i}));

        expect(screen.getByText('cannot save')).toBeInTheDocument();
        expect(screen.getByRole('dialog').classList.contains('in')).toBe(true);
    });

    it('should submit on ctrl + enter when ctrlSend is enabled', () => {
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
        textarea.dispatchEvent(new KeyboardEvent('keydown', {
            key: Constants.KeyCodes.ENTER[0],
            keyCode: Constants.KeyCodes.ENTER[1],
            ctrlKey: true,
            bubbles: true,
        }));

        expect(patchChannel).toHaveBeenCalledWith('channel_id', {header: 'test header'});
    });
});
