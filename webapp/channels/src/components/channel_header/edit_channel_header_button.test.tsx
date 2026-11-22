// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import userEvent from '@testing-library/user-event';
import React from 'react';

import type {Channel, ChannelType} from '@mattermost/types/channels';

import {Permissions} from 'mattermost-redux/constants';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import EditChannelHeaderButton from './edit_channel_header_button';

const mockOpenModal = jest.fn((modalData: unknown) => ({type: 'MOCK_OPEN_MODAL', modalData}));
jest.mock('actions/views/modals', () => ({
    openModal: (modalData: unknown) => mockOpenModal(modalData),
}));

describe('components/channel_header/EditChannelHeaderButton', () => {
    const userId = 'user_id';

    function makeChannel(overrides: Partial<Channel> = {}): Channel {
        return TestHelper.getChannelMock({
            id: 'channel_id',
            team_id: 'team_id',
            type: 'O' as ChannelType,
            header: '',
            delete_at: 0,
            ...overrides,
        });
    }

    function makeState(permissions: string[]) {
        return {
            entities: {
                users: {
                    currentUserId: userId,
                    profiles: {
                        [userId]: TestHelper.getUserMock({id: userId, roles: 'custom_role'}),
                    },
                },
                roles: {
                    roles: {
                        custom_role: {id: 'custom_role', name: 'custom_role', permissions},
                    },
                },
            },
        };
    }

    beforeEach(() => {
        mockOpenModal.mockClear();
    });

    test('shows "Set header" for a public channel with an empty header when allowed', () => {
        renderWithContext(
            <EditChannelHeaderButton channel={makeChannel()}/>,
            makeState([Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]),
        );

        const button = screen.getByRole('button', {name: 'Set header'});
        expect(button).toHaveAttribute('id', 'channelHeaderEditHeaderButton');
    });

    test('shows "Edit header" when the channel already has a header', () => {
        renderWithContext(
            <EditChannelHeaderButton channel={makeChannel({header: 'Existing header'})}/>,
            makeState([Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]),
        );

        expect(screen.getByRole('button', {name: 'Edit header'})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Set header'})).not.toBeInTheDocument();
    });

    test('uses the private channel permission for private channels', () => {
        const privateChannel = makeChannel({type: 'P' as ChannelType});

        const {unmount} = renderWithContext(
            <EditChannelHeaderButton channel={privateChannel}/>,
            makeState([Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES]),
        );
        expect(screen.getByRole('button', {name: 'Set header'})).toBeInTheDocument();
        unmount();

        renderWithContext(
            <EditChannelHeaderButton channel={privateChannel}/>,
            makeState([Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]),
        );
        expect(screen.queryByRole('button', {name: 'Set header'})).not.toBeInTheDocument();
    });

    test('uses the public channel permission for public channels', () => {
        renderWithContext(
            <EditChannelHeaderButton channel={makeChannel()}/>,
            makeState([Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES]),
        );

        expect(screen.queryByRole('button', {name: 'Set header'})).not.toBeInTheDocument();
    });

    test('is hidden when the user lacks the permission', () => {
        renderWithContext(
            <EditChannelHeaderButton channel={makeChannel({header: 'Existing header'})}/>,
            makeState([]),
        );

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    test.each(['D', 'G'])('is hidden for %s channels even with permissions', (type) => {
        renderWithContext(
            <EditChannelHeaderButton channel={makeChannel({type: type as ChannelType})}/>,
            makeState([Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES, Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES]),
        );

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    test('is hidden for archived channels even with permissions', () => {
        renderWithContext(
            <EditChannelHeaderButton channel={makeChannel({delete_at: 1234})}/>,
            makeState([Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]),
        );

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    test('opens the edit channel header modal when clicked', async () => {
        const channel = makeChannel({header: 'Existing header'});
        renderWithContext(
            <EditChannelHeaderButton channel={channel}/>,
            makeState([Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]),
        );

        await userEvent.click(screen.getByRole('button', {name: 'Edit header'}));

        expect(mockOpenModal).toHaveBeenCalledTimes(1);
        expect(mockOpenModal).toHaveBeenCalledWith(expect.objectContaining({
            modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
            dialogProps: {channel},
        }));
    });
});
