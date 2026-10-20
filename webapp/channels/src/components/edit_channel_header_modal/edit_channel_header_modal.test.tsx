// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {patchChannel} from 'mattermost-redux/actions/channels';

import {fireEvent, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import EditChannelHeaderModal from './edit_channel_header_modal';

const mockedPatchChannel = patchChannel as jest.MockedFunction<typeof patchChannel>;

jest.mock('mattermost-redux/actions/channels', () => ({
    patchChannel: jest.fn(),
}));

jest.mock('components/widgets/advanced_textbox/advanced_textbox', () => {
    return function MockAdvancedTextbox(props: {
        value: string;
        onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
        readOnly?: boolean;
        errorMessage?: string;
        countCodePoints?: boolean;
    }) {
        return (
            <div>
                <textarea
                    data-testid='edit-channel-header-input'
                    value={props.value}
                    readOnly={props.readOnly}
                    onChange={props.onChange}
                />
                {props.countCodePoints && <span data-testid='count-code-points'/>}
                {props.errorMessage && <div role='alert'>{props.errorMessage}</div>}
            </div>
        );
    };
});

describe('components/EditChannelHeaderModal', () => {
    const channel = TestHelper.getChannelMock({
        id: 'channel_id',
        display_name: 'Town Square',
        header: 'Hello',
        delete_at: 0,
        type: 'O',
    });

    beforeEach(() => {
        mockedPatchChannel.mockReset();
        mockedPatchChannel.mockReturnValue(() => Promise.resolve({data: {...channel, header: 'Hello world'}}) as unknown as ReturnType<typeof patchChannel>);
    });

    function renderModal(props: Partial<React.ComponentProps<typeof EditChannelHeaderModal>> = {}) {
        return renderWithContext(
            <EditChannelHeaderModal
                channel={channel}
                canEdit={true}
                {...props}
            />,
        );
    }

    test('save trims and patches only the header', async () => {
        renderModal();

        fireEvent.change(screen.getByTestId('edit-channel-header-input'), {target: {value: '  Hello world  '}});
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(mockedPatchChannel).toHaveBeenCalledTimes(1);
        expect(mockedPatchChannel).toHaveBeenCalledWith('channel_id', {header: 'Hello world'});
    });

    test('does not call the API when the text is unchanged', async () => {
        renderModal();

        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(mockedPatchChannel).not.toHaveBeenCalled();
    });

    test('cancel closes without a request', async () => {
        renderModal();

        fireEvent.change(screen.getByTestId('edit-channel-header-input'), {target: {value: 'Changed'}});
        await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

        expect(mockedPatchChannel).not.toHaveBeenCalled();
    });

    test('disables save when the header is over 1024 code points', () => {
        renderModal();

        fireEvent.change(screen.getByTestId('edit-channel-header-input'), {target: {value: '😀'.repeat(1025)}});

        expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();
        expect(screen.getByRole('alert')).toHaveTextContent('The text entered exceeds the character limit. The channel header is limited to 1024 characters.');
    });

    test('allows a 1024 code point header that exceeds 1024 UTF-16 units', () => {
        renderModal();

        const header = '😀'.repeat(1024);
        expect(header.length).toBeGreaterThan(1024);
        fireEvent.change(screen.getByTestId('edit-channel-header-input'), {target: {value: header}});

        expect(screen.getByRole('button', {name: 'Save'})).toBeEnabled();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    test('renders read-only when the user cannot edit', () => {
        renderModal({canEdit: false});

        expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
        expect(screen.getByTestId('edit-channel-header-input')).toHaveAttribute('readonly');
        expect(screen.getByTestId('edit-channel-header-input')).toHaveValue('Hello');
    });

    test('renders an archived channel as read-only', () => {
        renderModal({
            canEdit: true,
            channel: {...channel, delete_at: 1234},
        });

        expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
        expect(screen.getByTestId('edit-channel-header-input')).toHaveAttribute('readonly');
    });

    test('shows a bot description and does not patch', async () => {
        renderModal({
            canEdit: true,
            channel: {...channel, type: 'D', header: 'not the bot description'},
            dmUser: TestHelper.getUserMock({is_bot: true, bot_description: 'Tranquility'}),
        });

        expect(screen.getByTestId('edit-channel-header-input')).toHaveValue('Tranquility');
        expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
        expect(mockedPatchChannel).not.toHaveBeenCalled();
    });

    test('shows the server max-length error', async () => {
        mockedPatchChannel.mockReturnValue(() => Promise.resolve({
            error: {
                message: 'header too long',
                server_error_id: 'model.channel.is_valid.header.app_error',
            },
        }));

        renderModal();
        fireEvent.change(screen.getByTestId('edit-channel-header-input'), {target: {value: 'Changed'}});
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(await screen.findByText('The text entered exceeds the character limit. The channel header is limited to 1024 characters.')).toBeInTheDocument();
    });

    test('returns focus to the header button when closed', () => {
        const trigger = document.createElement('button');
        trigger.id = 'channelHeaderHeaderButton';
        document.body.appendChild(trigger);

        const {unmount} = renderModal();
        unmount();

        expect(document.activeElement).toBe(trigger);
        trigger.remove();
    });

    test('escape closes the modal', async () => {
        renderModal();

        expect(screen.getByTestId('editChannelHeaderModal')).toBeInTheDocument();
        fireEvent.keyDown(document, {key: 'Escape', keyCode: 27, which: 27});
        await waitFor(() => {
            expect(screen.queryByTestId('editChannelHeaderModal')).not.toBeInTheDocument();
        });
    });
});
