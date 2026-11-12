// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {fireEvent, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import EditChannelHeaderModal from './edit_channel_header_modal';

jest.mock('mattermost-redux/actions/channels', () => ({
    ...jest.requireActual('mattermost-redux/actions/channels'),
    patchChannel: jest.fn(),
}));

jest.mock('components/advanced_text_editor/show_formatting/show_formatting', () => (
    jest.fn().mockImplementation(() => null)
));

describe('EditChannelHeaderModal', () => {
    const onHide = jest.fn();

    beforeEach(() => {
        onHide.mockClear();
        const {patchChannel} = require('mattermost-redux/actions/channels');
        patchChannel.mockReset();
        patchChannel.mockReturnValue(() => Promise.resolve({data: {header: 'Updated header'}}));
    });

    test('prefills the current header', () => {
        const channel = TestHelper.getChannelMock({header: 'Current header'});

        renderWithContext(
            <EditChannelHeaderModal
                channel={channel}
                onHide={onHide}
            />,
        );

        expect(screen.getByTestId('edit_channel_header_textbox')).toHaveValue('Current header');
    });

    test('saving calls the channel patch API with the new header', async () => {
        const {patchChannel} = require('mattermost-redux/actions/channels');
        const channel = TestHelper.getChannelMock({id: 'channel1', header: 'Old header'});

        renderWithContext(
            <EditChannelHeaderModal
                channel={channel}
                onHide={onHide}
            />,
        );

        const input = screen.getByTestId('edit_channel_header_textbox');
        await userEvent.clear(input);
        await userEvent.type(input, 'Updated header');
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        await waitFor(() => {
            expect(patchChannel).toHaveBeenCalledWith('channel1', {header: 'Updated header'});
        });
        expect(onHide).toHaveBeenCalled();
    });

    test('saving an empty header clears it through the patch API', async () => {
        const {patchChannel} = require('mattermost-redux/actions/channels');
        const channel = TestHelper.getChannelMock({id: 'channel1', header: 'Old header'});

        renderWithContext(
            <EditChannelHeaderModal
                channel={channel}
                onHide={onHide}
            />,
        );

        await userEvent.clear(screen.getByTestId('edit_channel_header_textbox'));
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        await waitFor(() => {
            expect(patchChannel).toHaveBeenCalledWith('channel1', {header: ''});
        });
        expect(onHide).toHaveBeenCalled();
    });

    test('does not save a header that exceeds the max length', async () => {
        const {patchChannel} = require('mattermost-redux/actions/channels');
        const channel = TestHelper.getChannelMock({id: 'channel1', header: ''});

        renderWithContext(
            <EditChannelHeaderModal
                channel={channel}
                onHide={onHide}
            />,
        );

        const input = screen.getByTestId('edit_channel_header_textbox');
        await userEvent.click(input);
        await userEvent.paste('a'.repeat(1025));

        expect(screen.getByText('The text entered exceeds the character limit. The channel header is limited to 1024 characters.')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();

        fireEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(patchChannel).not.toHaveBeenCalled();
        expect(onHide).not.toHaveBeenCalled();
    });

    test('shows an API error and keeps the modal open', async () => {
        const {patchChannel} = require('mattermost-redux/actions/channels');
        patchChannel.mockReturnValue(() => Promise.resolve({error: {message: 'Failed to update the channel header.'}}));
        const channel = TestHelper.getChannelMock({id: 'channel1', header: 'Old header'});

        renderWithContext(
            <EditChannelHeaderModal
                channel={channel}
                onHide={onHide}
            />,
        );

        const input = screen.getByTestId('edit_channel_header_textbox');
        await userEvent.clear(input);
        await userEvent.type(input, 'New header');
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(await screen.findByText('Failed to update the channel header.')).toBeInTheDocument();
        expect(screen.getByTestId('edit-channel-header-modal')).toBeInTheDocument();
        expect(onHide).not.toHaveBeenCalled();
    });
});
