// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {patchChannel} from 'mattermost-redux/actions/channels';

import {fireEvent, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import EditChannelHeaderModal from './edit_channel_header_modal';

jest.mock('react-bootstrap', () => {
    const Modal = ({children, show}: {children: React.ReactNode; show: boolean}) => (
        show ? <div role='dialog'>{children}</div> : null
    );
    Modal.Header = ({children}: {children: React.ReactNode}) => <div>{children}</div>;
    Modal.Title = ({children}: {children: React.ReactNode}) => <h1>{children}</h1>;
    Modal.Body = ({children}: {children: React.ReactNode}) => <div>{children}</div>;
    Modal.Footer = ({children}: {children: React.ReactNode}) => <div>{children}</div>;
    return {Modal};
});

jest.mock('components/widgets/advanced_textbox/advanced_textbox', () => {
    return function MockAdvancedTextbox(props: {
        id: string;
        value: string;
        readOnly?: boolean;
        errorMessage?: React.ReactNode;
        onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    }) {
        return (
            <>
                <textarea
                    data-testid={props.id}
                    value={props.value}
                    readOnly={props.readOnly}
                    onChange={props.onChange}
                />
                {props.errorMessage && <div>{props.errorMessage}</div>}
            </>
        );
    };
});

jest.mock('mattermost-redux/actions/channels', () => ({
    patchChannel: jest.fn(() => ({type: 'MOCK_PATCH_CHANNEL'})),
}));

const mockedPatchChannel = patchChannel as jest.MockedFunction<typeof patchChannel>;

describe('EditChannelHeaderModal', () => {
    const channel = TestHelper.getChannelMock({
        id: 'channel_id',
        display_name: 'Town Square',
        header: 'Existing header',
        type: 'O',
    });
    const onExited = jest.fn();

    beforeEach(() => {
        mockedPatchChannel.mockClear();
        mockedPatchChannel.mockReturnValue({type: 'MOCK_PATCH_CHANNEL'} as never);
        onExited.mockClear();
    });

    test('saves a trimmed header through patchChannel with only header', async () => {
        renderWithContext(
            <EditChannelHeaderModal
                channel={channel}
                canEdit={true}
                onExited={onExited}
            />,
        );

        fireEvent.change(screen.getByTestId('edit_channel_header_textbox'), {
            target: {value: '  **new header**  '},
        });
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        await waitFor(() => {
            expect(mockedPatchChannel).toHaveBeenCalledTimes(1);
        });
        expect(mockedPatchChannel).toHaveBeenCalledWith('channel_id', {header: '**new header**'});
    });

    test('does not call the API when the trimmed header is unchanged', async () => {
        renderWithContext(
            <EditChannelHeaderModal
                channel={channel}
                canEdit={true}
                onExited={onExited}
            />,
        );

        fireEvent.change(screen.getByTestId('edit_channel_header_textbox'), {
            target: {value: '  Existing header  '},
        });
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(mockedPatchChannel).not.toHaveBeenCalled();
    });

    test('Cancel closes without a request', async () => {
        renderWithContext(
            <EditChannelHeaderModal
                channel={channel}
                canEdit={true}
                onExited={onExited}
            />,
        );

        fireEvent.change(screen.getByTestId('edit_channel_header_textbox'), {
            target: {value: 'changed'},
        });
        await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

        expect(mockedPatchChannel).not.toHaveBeenCalled();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('disables Save when the header is over 1024 code points', () => {
        const emoji = '😀';
        expect(emoji.length).toBeGreaterThan(1);

        renderWithContext(
            <EditChannelHeaderModal
                channel={channel}
                canEdit={true}
                onExited={onExited}
            />,
        );

        fireEvent.change(screen.getByTestId('edit_channel_header_textbox'), {
            target: {value: emoji.repeat(1025)},
        });

        expect(screen.getByText('The text entered exceeds the character limit. The channel header is limited to 1024 characters.')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();
    });

    test('allows a 1024-code-point header that includes emoji', () => {
        const emoji = '😀';

        renderWithContext(
            <EditChannelHeaderModal
                channel={channel}
                canEdit={true}
                onExited={onExited}
            />,
        );

        fireEvent.change(screen.getByTestId('edit_channel_header_textbox'), {
            target: {value: emoji.repeat(1024)},
        });

        expect(screen.queryByText(/exceeds the character limit/)).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Save'})).not.toBeDisabled();
    });

    test('renders read-only when the user cannot edit', () => {
        renderWithContext(
            <EditChannelHeaderModal
                channel={channel}
                canEdit={false}
                onExited={onExited}
            />,
        );

        expect(screen.getByTestId('edit_channel_header_textbox')).toHaveAttribute('readOnly');
        expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
    });

    test('renders archived channels read-only', () => {
        const archived = TestHelper.getChannelMock({
            ...channel,
            delete_at: 1,
        });

        renderWithContext(
            <EditChannelHeaderModal
                channel={archived}
                canEdit={false}
                onExited={onExited}
            />,
        );

        expect(screen.getByTestId('edit_channel_header_textbox')).toHaveValue('Existing header');
        expect(screen.getByTestId('edit_channel_header_textbox')).toHaveAttribute('readOnly');
        expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
    });

    test('shows bot_description for bot DMs and does not patch', async () => {
        const botChannel = TestHelper.getChannelMock({
            id: 'bot_dm',
            type: 'D',
            header: 'channel header should be ignored',
        });
        const dmUser = TestHelper.getUserMock({
            is_bot: true,
            bot_description: 'I am a helpful bot',
        });

        renderWithContext(
            <EditChannelHeaderModal
                channel={botChannel}
                dmUser={dmUser}
                canEdit={false}
                onExited={onExited}
            />,
        );

        expect(screen.getByTestId('edit_channel_header_textbox')).toHaveValue('I am a helpful bot');
        expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
        expect(mockedPatchChannel).not.toHaveBeenCalled();
    });

    test('surfaces a server max-length error', async () => {
        mockedPatchChannel.mockReturnValue({
            type: 'MOCK_PATCH_CHANNEL',
            error: {
                server_error_id: 'model.channel.is_valid.header.app_error',
                message: 'Invalid header length',
            },
        } as never);

        renderWithContext(
            <EditChannelHeaderModal
                channel={{...channel, header: ''}}
                canEdit={true}
                onExited={onExited}
            />,
        );

        fireEvent.change(screen.getByTestId('edit_channel_header_textbox'), {
            target: {value: 'ok header'},
        });
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(await screen.findByText('The text entered exceeds the character limit. The channel header is limited to 1024 characters.')).toBeInTheDocument();
    });
});
