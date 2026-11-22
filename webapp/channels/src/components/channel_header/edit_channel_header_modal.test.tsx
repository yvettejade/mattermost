// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import userEvent from '@testing-library/user-event';
import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {patchChannel} from 'mattermost-redux/actions/channels';

import {renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import EditChannelHeaderModal from './edit_channel_header_modal';

jest.mock('mattermost-redux/actions/channels', () => ({
    ...jest.requireActual('mattermost-redux/actions/channels'),
    patchChannel: jest.fn(),
}));

const mockPatchChannel = patchChannel as unknown as jest.Mock;

describe('components/channel_header/EditChannelHeaderModal', () => {
    const onExited = jest.fn();

    function makeChannel(header = 'Current header'): Channel {
        return TestHelper.getChannelMock({
            id: 'channel_id',
            team_id: 'team_id',
            display_name: 'Town Hall',
            header,
        });
    }

    function renderModal(channel = makeChannel()) {
        return renderWithContext(
            <EditChannelHeaderModal
                channel={channel}
                onExited={onExited}
            />,
        );
    }

    function mockPatchResult(result: unknown) {
        mockPatchChannel.mockImplementation(() => () => Promise.resolve(result));
    }

    beforeEach(() => {
        mockPatchChannel.mockReset();
        onExited.mockClear();
    });

    test('prefills the textarea with the current header', () => {
        renderModal();

        expect(screen.getByRole('textbox')).toHaveValue('Current header');
        expect(screen.getByText('Edit Header for Town Hall')).toBeInTheDocument();
    });

    test('saves exactly {header} with the trimmed value', async () => {
        mockPatchResult({data: makeChannel('New header')});
        renderModal();

        const textbox = screen.getByRole('textbox');
        await userEvent.clear(textbox);
        await userEvent.type(textbox, '   New header  ');
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        await waitFor(() => expect(mockPatchChannel).toHaveBeenCalledTimes(1));
        expect(mockPatchChannel).toHaveBeenCalledWith('channel_id', {header: 'New header'});
        expect(Object.keys(mockPatchChannel.mock.calls[0][1])).toEqual(['header']);
        await waitFor(() => expect(onExited).toHaveBeenCalled());
    });

    test('clears the header when the value is emptied', async () => {
        mockPatchResult({data: makeChannel('')});
        renderModal();

        await userEvent.clear(screen.getByRole('textbox'));
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        await waitFor(() => expect(mockPatchChannel).toHaveBeenCalledWith('channel_id', {header: ''}));
        await waitFor(() => expect(onExited).toHaveBeenCalled());
    });

    test('disables Save and shows an error when the header is over 1024 characters', async () => {
        renderModal();

        const textbox = screen.getByRole('textbox');
        await userEvent.clear(textbox);
        await userEvent.click(textbox);
        await userEvent.paste('a'.repeat(1025));

        expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();
        expect(screen.getByText(/limited to 1024 characters/)).toBeInTheDocument();
        expect(mockPatchChannel).not.toHaveBeenCalled();
    });

    test('allows a header of exactly 1024 characters', async () => {
        renderModal();

        const textbox = screen.getByRole('textbox');
        await userEvent.clear(textbox);
        await userEvent.click(textbox);
        await userEvent.paste('a'.repeat(1024));

        expect(screen.getByRole('button', {name: 'Save'})).toBeEnabled();
    });

    test('shows the API error and stays open when saving fails', async () => {
        mockPatchResult({error: {message: 'Server exploded'}});
        renderModal();

        const textbox = screen.getByRole('textbox');
        await userEvent.clear(textbox);
        await userEvent.type(textbox, 'Another header');
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(await screen.findByText('Server exploded')).toBeInTheDocument();
        expect(screen.getByRole('textbox')).toHaveValue('Another header');
        expect(onExited).not.toHaveBeenCalled();
    });

    test('closes without calling the API when the value is unchanged', async () => {
        renderModal();

        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        await waitFor(() => expect(onExited).toHaveBeenCalled());
        expect(mockPatchChannel).not.toHaveBeenCalled();
    });

    test('closes without calling the API when cancelled', async () => {
        renderModal();

        await userEvent.type(screen.getByRole('textbox'), ' more');
        await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

        await waitFor(() => expect(onExited).toHaveBeenCalled());
        expect(mockPatchChannel).not.toHaveBeenCalled();
    });
});
