// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import EditChannelHeaderModal from 'components/edit_channel_header_modal/edit_channel_header_modal';

import {fireEvent, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

jest.mock('components/widgets/advanced_textbox/advanced_textbox', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation((props) => (
        <textarea
            data-testid='edit-header-textbox'
            id={props.id}
            value={props.value}
            onChange={props.onChange}
            onKeyPress={props.onKeyPress}
            placeholder={props.createMessage}
        />
    )),
}));

describe('components/EditChannelHeaderModal', () => {
    const channel = TestHelper.getChannelMock({
        id: 'channel_id',
        header: 'initial header',
        display_name: 'Town Square',
    });

    const patchChannel = jest.fn().mockResolvedValue({data: channel});
    const setShowPreviewOnEditChannelHeaderModal = jest.fn();

    const baseProps = {
        channel,
        showPreview: false,
        onExited: jest.fn(),
        actions: {
            patchChannel,
            setShowPreviewOnEditChannelHeaderModal,
        },
    };

    beforeEach(() => {
        patchChannel.mockClear();
    });

    it('calls patchChannel with trimmed header on save', async () => {
        renderWithContext(<EditChannelHeaderModal {...baseProps}/>);

        const textbox = screen.getByTestId('edit-header-textbox');
        await userEvent.clear(textbox);
        await userEvent.type(textbox, '  updated header  ');

        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        await waitFor(() => {
            expect(patchChannel).toHaveBeenCalledWith('channel_id', {header: 'updated header'});
        });
    });

    it('calls patchChannel when Enter is pressed', async () => {
        renderWithContext(<EditChannelHeaderModal {...baseProps}/>);

        const textbox = screen.getByTestId('edit-header-textbox');
        await userEvent.clear(textbox);
        fireEvent.keyPress(textbox, {key: 'Enter', code: 'Enter', charCode: 13});

        await waitFor(() => {
            expect(patchChannel).toHaveBeenCalledWith('channel_id', {header: ''});
        });
    });

    it('does not call patchChannel when header is unchanged', async () => {
        renderWithContext(<EditChannelHeaderModal {...baseProps}/>);

        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(patchChannel).not.toHaveBeenCalled();
    });

    it('does not call patchChannel when cancel is clicked', async () => {
        renderWithContext(<EditChannelHeaderModal {...baseProps}/>);

        const textbox = screen.getByTestId('edit-header-textbox');
        await userEvent.clear(textbox);
        await userEvent.type(textbox, 'changed');

        await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

        expect(patchChannel).not.toHaveBeenCalled();
    });

    it('does not call patchChannel when over 1024 code points', async () => {
        const overLimitHeader = 'a'.repeat(1025);
        renderWithContext(<EditChannelHeaderModal {...baseProps}/>);

        const textbox = screen.getByTestId('edit-header-textbox');
        await userEvent.clear(textbox);
        fireEvent.change(textbox, {target: {value: overLimitHeader}});

        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(patchChannel).not.toHaveBeenCalled();
    });

    it('allows exactly 1024 code points', async () => {
        const validHeader = 'a'.repeat(1024);
        renderWithContext(<EditChannelHeaderModal {...baseProps}/>);

        const textbox = screen.getByTestId('edit-header-textbox');
        await userEvent.clear(textbox);
        fireEvent.change(textbox, {target: {value: validHeader}});

        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        await waitFor(() => {
            expect(patchChannel).toHaveBeenCalledWith('channel_id', {header: validHeader});
        });
    });
});
