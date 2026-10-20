// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';

import {openModal} from 'actions/views/modals';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import Constants, {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ChannelHeaderTextButton from './channel_header_text_button';

jest.mock('mattermost-redux/selectors/entities/roles', () => ({
    ...jest.requireActual('mattermost-redux/selectors/entities/roles'),
    haveIChannelPermission: jest.fn(),
}));

jest.mock('actions/views/modals', () => ({
    openModal: jest.fn(() => ({type: 'MOCK_OPEN_MODAL'})),
}));

const mockHaveIChannelPermission = haveIChannelPermission as jest.MockedFunction<typeof haveIChannelPermission>;

describe('components/channel_header/ChannelHeaderTextButton', () => {
    const channel = TestHelper.getChannelMock({
        id: 'channel_id',
        team_id: 'team_id',
        type: Constants.OPEN_CHANNEL as ChannelType,
        header: 'Read the **docs** at https://example.com',
        delete_at: 0,
    });

    beforeEach(() => {
        mockHaveIChannelPermission.mockReturnValue(true);
        (openModal as jest.Mock).mockClear();
    });

    test('should render an accessible button with a tooltip label', () => {
        renderWithContext(<ChannelHeaderTextButton channel={channel}/>);

        const button = screen.getByRole('button', {name: 'Channel header'});
        expect(button).toHaveAttribute('id', 'channelHeaderTextButton');
        expect(button).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('should toggle the popover with the rendered header on click', async () => {
        renderWithContext(<ChannelHeaderTextButton channel={channel}/>);

        const button = screen.getByRole('button', {name: 'Channel header'});
        await userEvent.click(button);

        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveTextContent('Channel header');
        expect(screen.getByText('docs').tagName).toBe('STRONG');
        expect(button).toHaveAttribute('aria-expanded', 'true');

        await userEvent.click(button);
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    test('should open with Enter/Space and close with Escape', async () => {
        renderWithContext(<ChannelHeaderTextButton channel={channel}/>);

        const button = screen.getByRole('button', {name: 'Channel header'});
        button.focus();

        await userEvent.keyboard('{Enter}');
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        await userEvent.keyboard('{Escape}');
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

        button.focus();
        await userEvent.keyboard(' ');
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    test('should show empty state with an add action for users who can manage the channel', async () => {
        renderWithContext(<ChannelHeaderTextButton channel={{...channel, header: '  '}}/>);

        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));

        expect(screen.getByText('No channel header yet')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Edit'})).not.toBeInTheDocument();
    });

    test('should show empty state without actions for users who cannot manage the channel', async () => {
        mockHaveIChannelPermission.mockReturnValue(false);
        renderWithContext(<ChannelHeaderTextButton channel={{...channel, header: ''}}/>);

        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));

        expect(screen.getByText('No channel header yet')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('should check the private channel permission for private channels', async () => {
        renderWithContext(<ChannelHeaderTextButton channel={{...channel, type: Constants.PRIVATE_CHANNEL as ChannelType}}/>);

        expect(mockHaveIChannelPermission).toHaveBeenCalledWith(expect.anything(), 'team_id', 'channel_id', 'manage_private_channel_properties');
    });

    test('should be read-only for users without manage permission', async () => {
        mockHaveIChannelPermission.mockReturnValue(false);
        renderWithContext(<ChannelHeaderTextButton channel={channel}/>);

        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));

        expect(screen.getByText('docs')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Edit'})).not.toBeInTheDocument();
    });

    test('should be read-only for archived channels', async () => {
        renderWithContext(<ChannelHeaderTextButton channel={{...channel, delete_at: 1234}}/>);

        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));

        expect(screen.getByText('docs')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Edit'})).not.toBeInTheDocument();
    });

    test('should allow editing group message headers without a team permission', async () => {
        mockHaveIChannelPermission.mockReturnValue(false);
        renderWithContext(<ChannelHeaderTextButton channel={{...channel, type: Constants.GM_CHANNEL as ChannelType, team_id: ''}}/>);

        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));

        expect(screen.getByRole('button', {name: 'Edit'})).toBeInTheDocument();
    });

    test('should open the channel settings modal and close the popover when Edit is clicked', async () => {
        renderWithContext(<ChannelHeaderTextButton channel={channel}/>);

        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));
        await userEvent.click(screen.getByRole('button', {name: 'Edit'}));

        expect(openModal).toHaveBeenCalledWith(expect.objectContaining({
            modalId: ModalIdentifiers.CHANNEL_SETTINGS,
            dialogProps: expect.objectContaining({
                channelId: 'channel_id',
                focusOriginElement: 'channelHeaderTextButton',
                isOpen: true,
            }),
        }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    test('should show the updated header after the channel changes', async () => {
        const {rerender} = renderWithContext(<ChannelHeaderTextButton channel={channel}/>);

        rerender(<ChannelHeaderTextButton channel={{...channel, header: 'A brand new header'}}/>);
        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));

        expect(screen.getByText('A brand new header')).toBeInTheDocument();
    });
});
