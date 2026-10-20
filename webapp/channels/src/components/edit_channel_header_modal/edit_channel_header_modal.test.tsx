// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {patchChannel} from 'mattermost-redux/actions/channels';

import {fireEvent, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import EditChannelHeaderModal from './edit_channel_header_modal';

jest.mock('mattermost-redux/actions/channels', () => ({
    patchChannel: jest.fn(),
}));

jest.mock('components/textbox', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation((props) => (
        <textarea
            data-testid={props.id}
            id={props.id}
            value={props.value}
            onChange={props.onChange}
            onKeyPress={props.onKeyPress}
            placeholder={props.createMessage}
            disabled={props.disabled}
        />
    )),
}));

jest.mock('components/advanced_text_editor/show_formatting/show_formatting', () => (
    jest.fn().mockImplementation((props) => (
        <button
            data-testid='mock-show-format'
            onClick={props.onClick}
            className={props.active ? 'active' : ''}
        >
            {'Toggle Preview'}
        </button>
    ))
));

const mockedPatchChannel = patchChannel as jest.Mock;

describe('EditChannelHeaderModal', () => {
    const channel = TestHelper.getChannelMock({
        id: 'channel_id',
        header: 'current header',
        display_name: 'Town Square',
    });

    const baseProps = {
        channel,
        canEdit: true,
        onExited: jest.fn(),
    };

    beforeEach(() => {
        mockedPatchChannel.mockReset();
        mockedPatchChannel.mockReturnValue({type: 'MOCK_PATCH_CHANNEL', data: {}});
    });

    test('save trims the header and calls patchChannel with only header', async () => {
        renderWithContext(<EditChannelHeaderModal {...baseProps}/>);

        fireEvent.input(screen.getByTestId('edit_channel_header_textbox'), {
            target: {value: '  updated header  '},
        });

        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(mockedPatchChannel).toHaveBeenCalledTimes(1);
        expect(mockedPatchChannel).toHaveBeenCalledWith('channel_id', {header: 'updated header'});
    });

    test('unchanged text does not call the API', async () => {
        renderWithContext(<EditChannelHeaderModal {...baseProps}/>);

        fireEvent.input(screen.getByTestId('edit_channel_header_textbox'), {
            target: {value: '  current header  '},
        });

        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(mockedPatchChannel).not.toHaveBeenCalled();
    });

    test('Cancel closes without a request', async () => {
        renderWithContext(<EditChannelHeaderModal {...baseProps}/>);

        fireEvent.input(screen.getByTestId('edit_channel_header_textbox'), {
            target: {value: 'changed'},
        });

        await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

        expect(mockedPatchChannel).not.toHaveBeenCalled();
    });

    test('over 1024 code points disables Save and an emoji counts as one', () => {
        const emoji = '😀';
        expect(emoji.length).toBeGreaterThan(1);

        renderWithContext(<EditChannelHeaderModal {...baseProps}/>);

        fireEvent.input(screen.getByTestId('edit_channel_header_textbox'), {
            target: {value: emoji.repeat(1025)},
        });

        expect(screen.getByText('The text entered exceeds the character limit. The channel header is limited to 1024 characters.')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();
    });

    test('a 1024-code-point string with emoji is allowed', () => {
        const emoji = '😀';

        renderWithContext(<EditChannelHeaderModal {...baseProps}/>);

        fireEvent.input(screen.getByTestId('edit_channel_header_textbox'), {
            target: {value: emoji.repeat(1024)},
        });

        expect(screen.queryByText(/The text entered exceeds the character limit/)).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Save'})).not.toBeDisabled();
    });

    test('archived and missing permission render read-only', () => {
        const {rerender} = renderWithContext(
            <EditChannelHeaderModal
                {...baseProps}
                canEdit={false}
                channel={{...channel, delete_at: 1234}}
            />,
        );

        expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
        expect(screen.getByTestId('edit_channel_header_textbox')).toBeDisabled();

        rerender(
            <EditChannelHeaderModal
                {...baseProps}
                canEdit={false}
            />,
        );

        expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
        expect(screen.getByTestId('edit_channel_header_textbox')).toBeDisabled();
    });

    test('bot DM shows bot_description and does not patch', async () => {
        const dmChannel = TestHelper.getChannelMock({
            id: 'dm_id',
            type: 'D',
            header: 'should not be shown',
        });
        const dmUser = TestHelper.getUserMock({
            is_bot: true,
            bot_description: 'I am a helpful bot',
        });

        renderWithContext(
            <EditChannelHeaderModal
                channel={dmChannel}
                dmUser={dmUser}
                canEdit={false}
                onExited={jest.fn()}
            />,
        );

        expect(screen.getByTestId('edit_channel_header_textbox')).toHaveValue('I am a helpful bot');
        expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
        expect(mockedPatchChannel).not.toHaveBeenCalled();
    });

    test('surfaces a server header length error', async () => {
        mockedPatchChannel.mockReturnValue({
            type: 'MOCK_PATCH_CHANNEL',
            error: {
                server_error_id: 'model.channel.is_valid.header.app_error',
                message: 'Invalid header length',
            },
        });

        renderWithContext(<EditChannelHeaderModal {...baseProps}/>);

        fireEvent.input(screen.getByTestId('edit_channel_header_textbox'), {
            target: {value: 'new header'},
        });

        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(await screen.findByText('The text entered exceeds the character limit. The channel header is limited to 1024 characters.')).toBeInTheDocument();
    });
});
