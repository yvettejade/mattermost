// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {fireEvent, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import Constants from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import EditChannelHeaderModal from './edit_channel_header_modal';

describe('components/EditChannelHeaderModal', () => {
    const channel = TestHelper.getChannelMock({
        header: '  hello  ',
        display_name: 'Town Square',
    });

    function renderModal(options?: {ctrlSend?: boolean; header?: string; patchChannel?: jest.Mock}) {
        const patchChannel = options?.patchChannel ?? jest.fn().mockResolvedValue({data: true});
        renderWithContext(
            <EditChannelHeaderModal
                channel={{
                    ...channel,
                    header: options?.header ?? channel.header,
                }}
                ctrlSend={options?.ctrlSend ?? false}
                onExited={jest.fn()}
                actions={{patchChannel}}
            />,
        );
        return patchChannel;
    }

    function pressEnter(ctrlKey = false, metaKey = false) {
        const textarea = screen.getByRole('textbox');
        textarea.dispatchEvent(new KeyboardEvent('keydown', {
            key: Constants.KeyCodes.ENTER[0],
            keyCode: Constants.KeyCodes.ENTER[1],
            ctrlKey,
            metaKey,
            bubbles: true,
        }));
    }

    it('renders the header modal with the existing header', () => {
        renderModal();

        expect(document.getElementById('editChannelHeaderModalLabel')).toBeInTheDocument();
        expect(screen.getByRole('textbox')).toHaveAttribute('id', 'edit_textbox');
        expect(screen.getByPlaceholderText('Enter the Channel Header')).toBeInTheDocument();
        expect(screen.getByRole('textbox')).toHaveValue('  hello  ');
    });

    it('saves the trimmed header on enter', () => {
        const patchChannel = renderModal();

        pressEnter();

        expect(patchChannel).toHaveBeenCalledWith('channel_id', {header: 'hello'});
    });

    it('saves on ctrl+enter and cmd+enter when ctrl send is on', () => {
        const patchChannel = renderModal({ctrlSend: true});

        pressEnter(false, false);
        expect(patchChannel).not.toHaveBeenCalled();

        pressEnter(true, false);
        expect(patchChannel).toHaveBeenCalledWith('channel_id', {header: 'hello'});

        patchChannel.mockClear();
        pressEnter(false, true);
        expect(patchChannel).toHaveBeenCalledWith('channel_id', {header: 'hello'});
    });

    it('does not save more than 1024 code points and shows the limit error', () => {
        const patchChannel = renderModal({header: ''});
        const textarea = screen.getByRole('textbox');
        fireEvent.change(textarea, {target: {value: 'a'.repeat(1025)}});

        pressEnter();

        expect(patchChannel).not.toHaveBeenCalled();
        expect(screen.getByText(/The text entered exceeds the character limit/)).toBeInTheDocument();
    });

    it('allows a header of 1024 emoji code points', () => {
        const patchChannel = renderModal({header: ''});
        const header = '😀'.repeat(1024);
        const textarea = screen.getByRole('textbox');
        fireEvent.change(textarea, {target: {value: header}});

        pressEnter();

        expect(screen.queryByText(/exceeds the character limit/)).not.toBeInTheDocument();
        expect(patchChannel).toHaveBeenCalledWith('channel_id', {header});
    });

    it('does not save when cancel is clicked', async () => {
        const patchChannel = renderModal();

        await userEvent.click(screen.getByRole('button', {name: /cancel/i}));

        expect(patchChannel).not.toHaveBeenCalled();
    });
});
