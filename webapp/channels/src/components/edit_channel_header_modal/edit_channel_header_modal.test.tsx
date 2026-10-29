// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as ChannelActions from 'mattermost-redux/actions/channels';

import * as ModalActions from 'actions/views/modals';

jest.mock('mattermost-redux/actions/channels', () => {
    const actual = jest.requireActual('mattermost-redux/actions/channels');
    return {
        ...actual,
        patchChannel: jest.fn(),
        updateChannel: jest.fn(() => () => Promise.resolve({data: {}})),
    };
});

import {fireEvent, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import EditChannelHeaderModal from './edit_channel_header_modal';

describe('components/EditChannelHeaderModal', () => {
    const channel = TestHelper.getChannelMock({
        id: 'channel_id',
        display_name: 'Town Square',
        header: '  existing header  ',
        type: 'O' as const,
    });

    const onExited = jest.fn();

    beforeEach(() => {
        (ChannelActions.patchChannel as jest.Mock).mockImplementation((channelId: string, patch: {header?: string}) => {
            return () => Promise.resolve({data: {id: channelId, header: patch.header}});
        });
        (ChannelActions.updateChannel as jest.Mock).mockClear();
        jest.spyOn(ModalActions, 'closeModal');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function renderModal(channelOverride = channel) {
        return renderWithContext(
            <EditChannelHeaderModal
                channel={channelOverride}
                onExited={onExited}
            />,
        );
    }

    it('uses the channel header title, placeholder, and prefilled textbox', () => {
        renderModal();

        expect(document.getElementById('editChannelHeaderModalLabel')).toHaveTextContent('Edit Header for Town Square');
        expect(screen.getByPlaceholderText('Enter the Channel Header')).toHaveAttribute('id', 'edit_textbox');
        expect(screen.getByRole('button', {name: 'Save'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
        expect(screen.getByTestId('edit_textbox')).toHaveValue('  existing header  ');
    });

    it('uses the direct-message title for a DM', () => {
        renderModal(TestHelper.getChannelMock({
            ...channel,
            type: 'D' as const,
            display_name: '',
        }));

        expect(document.getElementById('editChannelHeaderModalLabel')).toHaveTextContent('Edit Header');
        expect(screen.queryByText('Edit Header for')).not.toBeInTheDocument();
    });

    it('saves the trimmed header on Save and Enter without calling updateChannel', async () => {
        renderModal();

        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        await waitFor(() => {
            expect(ChannelActions.patchChannel).toHaveBeenCalledWith('channel_id', {header: 'existing header'});
        });
        expect(ChannelActions.updateChannel).not.toHaveBeenCalled();
        expect(ModalActions.closeModal).toHaveBeenCalledWith('edit_channel_header');
    });

    it('saves on Enter, ignores Shift+Enter, and keeps the modal open when validation fails', async () => {
        renderModal(TestHelper.getChannelMock({
            ...channel,
            header: 'hello',
        }));

        const textbox = screen.getByTestId('edit_textbox');
        fireEvent.keyPress(textbox, {key: 'Enter', shiftKey: true, charCode: 13});
        expect(ChannelActions.patchChannel).not.toHaveBeenCalled();

        const composing = new KeyboardEvent('keypress', {key: 'Enter', bubbles: true, cancelable: true});
        Object.defineProperty(composing, 'isComposing', {get: () => true});
        textbox.dispatchEvent(composing);
        expect(ChannelActions.patchChannel).not.toHaveBeenCalled();

        fireEvent.input(textbox, {target: {value: '  trimmed header  '}});
        fireEvent.keyPress(textbox, {key: 'Enter', charCode: 13});

        await waitFor(() => {
            expect(ChannelActions.patchChannel).toHaveBeenCalledWith('channel_id', {header: 'trimmed header'});
        });
        expect(ChannelActions.updateChannel).not.toHaveBeenCalled();

        (ChannelActions.patchChannel as jest.Mock).mockClear();
        (ModalActions.closeModal as jest.Mock).mockClear();
        fireEvent.input(textbox, {target: {value: '😀'.repeat(1025)}});
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(ChannelActions.patchChannel).not.toHaveBeenCalled();
        expect(screen.getByText(/limited to 1024 characters/)).toBeInTheDocument();
        expect(document.getElementById('editChannelHeaderModalLabel')).toBeInTheDocument();
        expect(ModalActions.closeModal).not.toHaveBeenCalled();
    });

    it('treats one emoji above U+FFFF as a single character', async () => {
        renderModal(TestHelper.getChannelMock({
            ...channel,
            header: '',
        }));

        fireEvent.input(screen.getByTestId('edit_textbox'), {target: {value: '😀'.repeat(1024)}});
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        await waitFor(() => {
            expect(ChannelActions.patchChannel).toHaveBeenCalledWith('channel_id', {header: '😀'.repeat(1024)});
        });
    });

    it('keeps the modal open and shows a server error', async () => {
        (ChannelActions.patchChannel as jest.Mock).mockImplementation(() => {
            return () => Promise.resolve({error: {message: 'Channel is archived'}});
        });

        renderModal();
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(await screen.findByText('Channel is archived')).toBeInTheDocument();
        expect(document.getElementById('editChannelHeaderModalLabel')).toBeInTheDocument();
        expect(ModalActions.closeModal).not.toHaveBeenCalled();
        expect(ChannelActions.updateChannel).not.toHaveBeenCalled();
    });
});
