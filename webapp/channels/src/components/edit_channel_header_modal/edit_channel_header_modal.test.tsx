// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel, ChannelType} from '@mattermost/types/channels';

import {EditChannelHeaderModal} from 'components/edit_channel_header_modal/edit_channel_header_modal';

import {renderWithContext, screen, userEvent, fireEvent, waitFor} from 'tests/react_testing_utils';
import Constants from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

jest.mock('components/widgets/advanced_textbox/advanced_textbox', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation((props) => (
        <div>
            <textarea
                data-testid={props.id}
                id={props.id}
                value={props.value}
                onChange={props.onChange}
                disabled={props.readOnly}
                placeholder={props.createMessage}
            />
            {props.errorMessage && (
                <div className='form-group has-error'>
                    <span>{props.errorMessage}</span>
                </div>
            )}
        </div>
    )),
}));

describe('components/EditChannelHeaderModal', () => {
    const channel: Channel = TestHelper.getChannelMock({
        id: 'fake-id',
        type: Constants.OPEN_CHANNEL as ChannelType,
        display_name: 'Fake Channel',
        name: 'fake-channel',
        header: 'Fake Channel',
        delete_at: 0,
    });

    const baseProps = {
        channel,
        canEdit: true,
        shouldShowPreview: false,
        onExited: jest.fn(),
        actions: {
            setShowPreview: jest.fn(),
            patchChannel: jest.fn().mockResolvedValue({}),
        },
    };

    test('save trims and calls patchChannel with only header', async () => {
        const patchChannel = jest.fn().mockResolvedValue({});
        renderWithContext(
            <EditChannelHeaderModal
                {...baseProps}
                actions={{...baseProps.actions, patchChannel}}
            />,
        );

        const textbox = screen.getByTestId('edit_textbox');
        fireEvent.change(textbox, {target: {value: '  trimmed header  '}});
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(patchChannel).toHaveBeenCalledTimes(1);
        expect(patchChannel).toHaveBeenCalledWith('fake-id', {header: 'trimmed header'});
    });

    test('unchanged text does not call the API', async () => {
        const patchChannel = jest.fn().mockResolvedValue({});
        renderWithContext(
            <EditChannelHeaderModal
                {...baseProps}
                actions={{...baseProps.actions, patchChannel}}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
        expect(patchChannel).not.toHaveBeenCalled();
    });

    test('Cancel closes without a request', async () => {
        const patchChannel = jest.fn().mockResolvedValue({});
        renderWithContext(
            <EditChannelHeaderModal
                {...baseProps}
                actions={{...baseProps.actions, patchChannel}}
            />,
        );

        fireEvent.change(screen.getByTestId('edit_textbox'), {target: {value: 'changed'}});
        await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
        expect(patchChannel).not.toHaveBeenCalled();
    });

    test('over 1024 code points, counting an emoji as one, disables Save', async () => {
        const emoji = '😀';
        expect(emoji.length).toBeGreaterThan(1);

        renderWithContext(
            <EditChannelHeaderModal {...baseProps}/>,
        );

        fireEvent.change(screen.getByTestId('edit_textbox'), {target: {value: emoji.repeat(1025)}});

        expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();
        expect(screen.getByText(/The text entered exceeds the character limit/)).toBeInTheDocument();
    });

    test('a 1024-code-point string with emoji is allowed', async () => {
        const emoji = '😀';
        const patchChannel = jest.fn().mockResolvedValue({});
        const value = `${emoji.repeat(512)}${'a'.repeat(512)}`;
        expect(Array.from(value).length).toBe(1024);
        expect(value.length).toBeGreaterThan(1024);

        renderWithContext(
            <EditChannelHeaderModal
                {...baseProps}
                actions={{...baseProps.actions, patchChannel}}
            />,
        );

        fireEvent.change(screen.getByTestId('edit_textbox'), {target: {value}});

        const save = screen.getByRole('button', {name: 'Save'});
        expect(save).toBeEnabled();
        expect(screen.queryByText(/The text entered exceeds the character limit/)).not.toBeInTheDocument();

        await userEvent.click(save);
        expect(patchChannel).toHaveBeenCalledWith('fake-id', {header: value});
    });

    test('archived and missing permission render read-only', () => {
        const {rerender} = renderWithContext(
            <EditChannelHeaderModal
                {...baseProps}
                canEdit={false}
                channel={{...channel, delete_at: 1234}}
            />,
        );

        expect(screen.getByTestId('edit_textbox')).toBeDisabled();
        expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
        expect(screen.getAllByRole('button', {name: 'Close'}).length).toBeGreaterThan(0);

        rerender(
            <EditChannelHeaderModal
                {...baseProps}
                canEdit={false}
            />,
        );

        expect(screen.getByTestId('edit_textbox')).toBeDisabled();
        expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
    });

    test('bot DM shows bot_description and does not patch', async () => {
        const patchChannel = jest.fn().mockResolvedValue({});
        const dmChannel = TestHelper.getChannelMock({
            ...channel,
            type: Constants.DM_CHANNEL as ChannelType,
            header: 'should not be shown',
        });
        const dmUser = TestHelper.getUserMock({
            is_bot: true,
            bot_description: 'I am a helpful bot',
        });

        renderWithContext(
            <EditChannelHeaderModal
                {...baseProps}
                channel={dmChannel}
                dmUser={dmUser}
                canEdit={true}
                actions={{...baseProps.actions, patchChannel}}
            />,
        );

        expect(screen.getByTestId('edit_textbox')).toHaveValue('I am a helpful bot');
        expect(screen.getByTestId('edit_textbox')).toBeDisabled();
        expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
        expect(patchChannel).not.toHaveBeenCalled();
    });

    test('surfaces a server error, including the max-length id', async () => {
        const patchChannel = jest.fn().mockResolvedValue({
            error: {
                server_error_id: 'model.channel.is_valid.header.app_error',
                message: 'too long',
            },
        });

        renderWithContext(
            <EditChannelHeaderModal
                {...baseProps}
                actions={{...baseProps.actions, patchChannel}}
            />,
        );

        fireEvent.change(screen.getByTestId('edit_textbox'), {target: {value: 'New header'}});
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        await waitFor(() => {
            expect(screen.getByText(/The text entered exceeds the character limit/)).toBeInTheDocument();
        });
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
});
