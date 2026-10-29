// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {patchChannel, updateChannel} from 'mattermost-redux/actions/channels';

import {fireEvent, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import Constants from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import EditChannelHeaderModal from './edit_channel_header_modal';

jest.mock('mattermost-redux/actions/channels', () => ({
    patchChannel: jest.fn(() => ({type: 'MOCK_PATCH_CHANNEL', data: {id: 'channel_id'}})),
    updateChannel: jest.fn(() => ({type: 'MOCK_UPDATE_CHANNEL'})),
}));

const genericModalProps: Array<{autoCloseOnConfirmButton?: boolean; handleEnterKeyPress?: unknown}> = [];

jest.mock('@mattermost/components', () => {
    const React = require('react');
    const actual = jest.requireActual('@mattermost/components');
    return {
        ...actual,
        GenericModal: (props: Record<string, unknown>) => {
            genericModalProps.push({
                autoCloseOnConfirmButton: props.autoCloseOnConfirmButton as boolean | undefined,
                handleEnterKeyPress: props.handleEnterKeyPress,
            });
            return React.createElement(actual.GenericModal, props);
        },
    };
});

jest.mock('components/widgets/advanced_textbox/advanced_textbox', () => ({
    __esModule: true,
    default: (props: {
        id: string;
        value: string;
        onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
        onKeyPress: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
        createMessage: string;
    }) => (
        <textarea
            id={props.id}
            value={props.value}
            onChange={props.onChange}
            onKeyPress={props.onKeyPress}
            placeholder={props.createMessage}
        />
    ),
}));

const mockedPatchChannel = jest.mocked(patchChannel);
const mockedUpdateChannel = jest.mocked(updateChannel);

describe('components/EditChannelHeaderModal', () => {
    const channel = TestHelper.getChannelMock({
        header: 'existing header',
        display_name: 'Town Square',
    });

    beforeEach(() => {
        mockedPatchChannel.mockClear();
        mockedUpdateChannel.mockClear();
        genericModalProps.length = 0;
        mockedPatchChannel.mockReturnValue({type: 'MOCK_PATCH_CHANNEL', data: {id: 'channel_id'}} as never);
    });

    function renderModal(channelOverride?: Channel) {
        return renderWithContext(
            <EditChannelHeaderModal channel={channelOverride ?? channel}/>,
        );
    }

    it('saves the trimmed header on Enter and does not call updateChannel', async () => {
        renderModal();

        const textarea = document.getElementById('edit_textbox') as HTMLTextAreaElement;
        fireEvent.change(textarea, {target: {value: '  weekly notes  '}});
        fireEvent.keyPress(textarea, {key: 'Enter', charCode: 13, shiftKey: false});

        await waitFor(() => {
            expect(mockedPatchChannel).toHaveBeenCalledWith('channel_id', {header: 'weekly notes'});
        });
        expect(mockedUpdateChannel).not.toHaveBeenCalled();
    });

    it('saves the trimmed header from the Save button', async () => {
        renderModal();

        const textarea = document.getElementById('edit_textbox') as HTMLTextAreaElement;
        fireEvent.change(textarea, {target: {value: '  standup notes  '}});
        await userEvent.click(screen.getByRole('button', {name: /save/i}));

        await waitFor(() => {
            expect(mockedPatchChannel).toHaveBeenCalledWith('channel_id', {header: 'standup notes'});
        });
        expect(mockedUpdateChannel).not.toHaveBeenCalled();
    });

    it('does not save on Shift+Enter', async () => {
        renderModal();

        const textarea = document.getElementById('edit_textbox') as HTMLTextAreaElement;
        fireEvent.change(textarea, {target: {value: 'line one'}});
        fireEvent.keyPress(textarea, {key: 'Enter', charCode: 13, shiftKey: true});

        expect(mockedPatchChannel).not.toHaveBeenCalled();
    });

    it('does not call the API when the header exceeds 1024 code points', async () => {
        renderModal();

        const textarea = document.getElementById('edit_textbox') as HTMLTextAreaElement;
        fireEvent.change(textarea, {target: {value: 'a'.repeat(1025)}});
        await userEvent.click(screen.getByRole('button', {name: /save/i}));

        expect(mockedPatchChannel).not.toHaveBeenCalled();
        expect(screen.getByText(/exceeds the character limit/)).toBeInTheDocument();
    });

    it('counts a single emoji above U+FFFF as one character', async () => {
        const header = '👍'.repeat(1024);
        renderModal(TestHelper.getChannelMock({
            ...channel,
            header,
        }));

        await userEvent.click(screen.getByRole('button', {name: /save/i}));

        await waitFor(() => {
            expect(mockedPatchChannel).toHaveBeenCalledWith('channel_id', {header});
        });
    });

    it('keeps autoCloseOnConfirmButton false and does not pass handleEnterKeyPress', () => {
        renderModal();

        expect(genericModalProps[0].autoCloseOnConfirmButton).toBe(false);
        expect(genericModalProps[0].handleEnterKeyPress).toBeUndefined();
        expect(document.getElementById('editChannelHeaderModalLabel')).toBeInTheDocument();
        expect(document.getElementById('edit_textbox')).toBeInTheDocument();
    });

    it('uses the DM title for a direct message', () => {
        renderModal(TestHelper.getChannelMock({
            type: Constants.DM_CHANNEL as Channel['type'],
            display_name: 'alice',
            header: '',
        }));

        expect(screen.getByText('Edit Header')).toBeInTheDocument();
        expect(screen.queryByText(/Edit Header for/)).not.toBeInTheDocument();
    });
});
