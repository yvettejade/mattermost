// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import EditChannelHeaderModal from 'components/edit_channel_header_modal/edit_channel_header_modal';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import Constants from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

jest.mock('components/widgets/advanced_textbox/advanced_textbox', () => ({
    __esModule: true,
    default: (props: {
        id: string;
        value: string;
        onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
        onKeyPress: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
        readOnly?: boolean;
        createMessage: string;
    }) => (
        <textarea
            id={props.id}
            value={props.value}
            onChange={props.onChange}
            onKeyPress={props.onKeyPress}
            readOnly={props.readOnly}
            aria-label={props.createMessage}
        />
    ),
}));

describe('components/EditChannelHeaderModal', () => {
    const channel = TestHelper.getChannelMock({
        header: 'current header',
        display_name: 'Off-Topic',
    });

    const baseProps = {
        channel,
        ctrlSend: false,
        canEdit: true,
        shouldShowPreview: false,
        onExited: jest.fn(),
        actions: {
            patchChannel: jest.fn().mockResolvedValue({data: true}),
            setShowPreviewOnEditChannelHeaderModal: jest.fn(),
        },
    };

    test('should load the current channel header', () => {
        renderWithContext(
            <EditChannelHeaderModal {...baseProps}/>,
        );

        expect(screen.getByRole('heading', {name: 'Edit Header for Off-Topic'})).toBeInTheDocument();
        expect(screen.getByLabelText('Enter the Channel Header')).toHaveValue('current header');
    });

    test('should save a trimmed header via patchChannel', async () => {
        renderWithContext(
            <EditChannelHeaderModal {...baseProps}/>,
        );

        const textbox = screen.getByLabelText('Enter the Channel Header');
        await userEvent.clear(textbox);
        await userEvent.type(textbox, '  new header  ');
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        await waitFor(() => {
            expect(baseProps.actions.patchChannel).toHaveBeenCalledWith('channel_id', {header: 'new header'});
        });
    });

    test('should not call the API when the trimmed header is unchanged', async () => {
        renderWithContext(
            <EditChannelHeaderModal {...baseProps}/>,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        await waitFor(() => {
            const modal = screen.getByRole('dialog');
            expect(modal.classList.contains('in')).toBe(false);
        });
        expect(baseProps.actions.patchChannel).not.toHaveBeenCalled();
    });

    test('should close without saving when cancel is clicked', async () => {
        renderWithContext(
            <EditChannelHeaderModal {...baseProps}/>,
        );

        const textbox = screen.getByLabelText('Enter the Channel Header');
        await userEvent.clear(textbox);
        await userEvent.type(textbox, 'abandoned edit');
        await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

        expect(baseProps.actions.patchChannel).not.toHaveBeenCalled();
        const modal = screen.getByRole('dialog');
        expect(modal.classList.contains('in')).toBe(false);
    });

    test('should show a server error and keep the modal open', async () => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                patchChannel: jest.fn().mockResolvedValue({error: {message: 'failed to save'}}),
            },
        };

        renderWithContext(
            <EditChannelHeaderModal {...props}/>,
        );

        const textbox = screen.getByLabelText('Enter the Channel Header');
        await userEvent.clear(textbox);
        await userEvent.type(textbox, 'updated header');
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(await screen.findByText('failed to save')).toBeInTheDocument();
        expect(screen.getByRole('dialog').classList.contains('in')).toBe(true);
    });

    test('should not show save when the header is not editable', () => {
        renderWithContext(
            <EditChannelHeaderModal
                {...baseProps}
                canEdit={false}
            />,
        );

        expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
        expect(screen.getByLabelText('Enter the Channel Header')).toHaveAttribute('readOnly');
    });

    test('should use the DM title', () => {
        renderWithContext(
            <EditChannelHeaderModal
                {...baseProps}
                channel={TestHelper.getChannelMock({
                    type: Constants.DM_CHANNEL,
                    header: 'dm header',
                })}
            />,
        );

        expect(screen.getByRole('heading', {name: 'Edit Header'})).toBeInTheDocument();
    });

    test('should show an empty editor instead of failing silently', () => {
        renderWithContext(
            <EditChannelHeaderModal
                {...baseProps}
                channel={TestHelper.getChannelMock({
                    header: '',
                    display_name: 'Town Square',
                })}
            />,
        );

        expect(screen.getByRole('heading', {name: 'Edit Header for Town Square'})).toBeInTheDocument();
        expect(screen.getByLabelText('Enter the Channel Header')).toHaveValue('');
        expect(screen.getByRole('button', {name: 'Save'})).toBeInTheDocument();
    });
});
