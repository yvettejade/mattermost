// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {patchChannel} from 'mattermost-redux/actions/channels';

import {renderWithContext, screen, userEvent, fireEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelHeaderInlineEdit from './channel_header_inline_edit';

jest.mock('components/textbox', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation((props) => (
        <textarea
            id={props.id}
            value={props.value}
            onChange={props.onChange}
            onKeyPress={props.onKeyPress}
            placeholder={props.createMessage}
            aria-label={props.createMessage}
        />
    )),
}));

jest.mock('mattermost-redux/actions/channels', () => ({
    ...jest.requireActual('mattermost-redux/actions/channels'),
    patchChannel: jest.fn(),
}));

const mockPatchChannel = patchChannel as jest.MockedFunction<typeof patchChannel>;

describe('ChannelHeaderInlineEdit', () => {
    const channel = TestHelper.getChannelMock({header: 'Test Header'});

    beforeEach(() => {
        mockPatchChannel.mockImplementation(() => async () => ({data: channel}));
    });

    test('renders header markdown and an edit control when editable', () => {
        renderWithContext(
            <ChannelHeaderInlineEdit
                channel={channel}
                headerText='Test Header'
                canEdit={true}
            />,
        );

        expect(screen.getByText('Test Header')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Edit channel header'})).toBeInTheDocument();
    });

    test('does not render an edit control when the user cannot edit', () => {
        renderWithContext(
            <ChannelHeaderInlineEdit
                channel={channel}
                headerText='Test Header'
                canEdit={false}
            />,
        );

        expect(screen.getByText('Test Header')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Edit channel header'})).not.toBeInTheDocument();
    });

    test('shows an add-header placeholder when there is no header and the user can edit', () => {
        renderWithContext(
            <ChannelHeaderInlineEdit
                channel={TestHelper.getChannelMock({header: ''})}
                headerText=''
                canEdit={true}
            />,
        );

        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
    });

    test('returns nothing when there is no header and the user cannot edit', () => {
        const {container} = renderWithContext(
            <ChannelHeaderInlineEdit
                channel={TestHelper.getChannelMock({header: ''})}
                headerText=''
                canEdit={false}
            />,
        );

        expect(container.childNodes.length).toBe(0);
    });

    test('enters edit mode and saves a patched header via patchChannel', async () => {
        renderWithContext(
            <ChannelHeaderInlineEdit
                channel={channel}
                headerText='Test Header'
                canEdit={true}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Edit channel header'}));

        const textbox = screen.getByLabelText('Enter the Channel Header');
        expect(textbox).toBeInTheDocument();

        await userEvent.clear(textbox);
        await userEvent.type(textbox, 'Updated header');
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        await waitFor(() => {
            expect(mockPatchChannel).toHaveBeenCalledWith(channel.id, {header: 'Updated header'});
        });
    });

    test('cancel restores view mode without calling patchChannel', async () => {
        renderWithContext(
            <ChannelHeaderInlineEdit
                channel={channel}
                headerText='Test Header'
                canEdit={true}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Edit channel header'}));
        await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

        expect(mockPatchChannel).not.toHaveBeenCalled();
        expect(screen.getByText('Test Header')).toBeInTheDocument();
        expect(screen.queryByLabelText('Enter the Channel Header')).not.toBeInTheDocument();
    });

    test('escape cancels editing', async () => {
        renderWithContext(
            <ChannelHeaderInlineEdit
                channel={channel}
                headerText='Test Header'
                canEdit={true}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Edit channel header'}));
        fireEvent.keyDown(screen.getByLabelText('Enter the Channel Header').closest('.ChannelHeaderInlineEdit') as HTMLElement, {
            key: 'Escape',
            keyCode: 27,
        });

        expect(mockPatchChannel).not.toHaveBeenCalled();
        expect(screen.getByText('Test Header')).toBeInTheDocument();
    });

    test('shows a length error and does not save when the header exceeds 1024 characters', async () => {
        renderWithContext(
            <ChannelHeaderInlineEdit
                channel={channel}
                headerText='Test Header'
                canEdit={true}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Edit channel header'}));
        const textbox = screen.getByLabelText('Enter the Channel Header');
        fireEvent.change(textbox, {target: {value: 'x'.repeat(1025)}});

        expect(screen.getByRole('alert')).toHaveTextContent('The channel header is limited to 1024 characters');
        expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();
        expect(mockPatchChannel).not.toHaveBeenCalled();
    });
});
