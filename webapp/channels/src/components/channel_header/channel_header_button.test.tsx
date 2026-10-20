// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {Permissions} from 'mattermost-redux/constants';

import {openModal} from 'actions/views/modals';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import Constants, {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ChannelHeaderButton from './channel_header_button';

jest.mock('actions/views/modals', () => ({
    openModal: jest.fn(() => ({type: 'MOCK_OPEN_MODAL'})),
}));

const mockedOpenModal = openModal as unknown as jest.Mock;

describe('components/channel_header/ChannelHeaderButton', () => {
    const currentUser = TestHelper.getUserMock({id: 'current_user_id', roles: 'system_user'});
    const team = TestHelper.getTeamMock({id: 'team_id', name: 'team-name'});

    function getState(permissions: string[] = []) {
        return {
            entities: {
                users: {
                    currentUserId: currentUser.id,
                    profiles: {[currentUser.id]: currentUser},
                },
                teams: {
                    currentTeamId: team.id,
                    teams: {[team.id]: team},
                },
                roles: {
                    roles: {
                        system_user: TestHelper.getRoleMock({name: 'system_user', permissions}),
                    },
                },
            },
        };
    }

    const openChannel = TestHelper.getChannelMock({
        id: 'channel_id',
        team_id: 'team_id',
        type: Constants.OPEN_CHANNEL as Channel['type'],
        header: 'Read the **docs** at ~town-square :smile:',
        props: {channel_mentions: {'town-square': {display_name: 'Town Square'}}},
    });

    const emptyChannel = {...openChannel, header: ''};

    beforeEach(() => {
        mockedOpenModal.mockClear();
    });

    test('should render an accessible, closed button by default', () => {
        renderWithContext(<ChannelHeaderButton channel={openChannel}/>, getState());

        const button = screen.getByRole('button', {name: 'Channel header'});
        expect(button).toHaveAttribute('aria-expanded', 'false');
        expect(button).not.toHaveClass('channel-header__icon--active');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('should toggle the popover with the full header text', async () => {
        renderWithContext(<ChannelHeaderButton channel={openChannel}/>, getState());

        const button = screen.getByRole('button', {name: 'Channel header'});
        await userEvent.click(button);

        const dialog = screen.getByRole('dialog');
        expect(button).toHaveAttribute('aria-expanded', 'true');
        expect(button).toHaveClass('channel-header__icon--active');
        expect(dialog).toHaveTextContent('Read the docs at ~Town Square');
        expect(dialog.querySelector('strong')).toHaveTextContent('docs');
        expect(dialog.querySelector('a.mention-link')).toHaveAttribute('href', '/team-name/channels/town-square');
        expect(dialog.querySelector('[data-emoticon="smile"]')).toBeInTheDocument();
        expect(screen.queryByText('No channel header yet.')).not.toBeInTheDocument();

        await userEvent.click(button);
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    test('should close on Escape', async () => {
        renderWithContext(<ChannelHeaderButton channel={openChannel}/>, getState());

        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        await userEvent.keyboard('{Escape}');
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    test('should close on outside click', async () => {
        renderWithContext(
            <div>
                <ChannelHeaderButton channel={openChannel}/>
                <div data-testid='outside'/>
            </div>,
            getState(),
        );

        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        await userEvent.click(screen.getByTestId('outside'));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    test('should be keyboard operable', async () => {
        renderWithContext(<ChannelHeaderButton channel={openChannel}/>, getState());

        await userEvent.tab();
        expect(screen.getByRole('button', {name: 'Channel header'})).toHaveFocus();

        await userEvent.keyboard('{Enter}');
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    test('should show the empty state with an add action when the user can edit the header', async () => {
        renderWithContext(
            <ChannelHeaderButton channel={emptyChannel}/>,
            getState([Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]),
        );

        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));
        expect(screen.getByText('No channel header yet.')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: 'Add a channel header'}));

        expect(mockedOpenModal).toHaveBeenCalledWith(expect.objectContaining({
            modalId: ModalIdentifiers.CHANNEL_SETTINGS,
            dialogProps: expect.objectContaining({channelId: emptyChannel.id, isOpen: true}),
        }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    test('should not show the add action without permission', async () => {
        renderWithContext(<ChannelHeaderButton channel={emptyChannel}/>, getState());

        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));
        expect(screen.getByText('No channel header yet.')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('should require the private channel permission for private channels', async () => {
        const privateChannel = {...emptyChannel, type: Constants.PRIVATE_CHANNEL as Channel['type']};

        renderWithContext(
            <ChannelHeaderButton channel={privateChannel}/>,
            getState([Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]),
        );
        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('should allow private channel edits with the private channel permission', async () => {
        const privateChannel = {...emptyChannel, type: Constants.PRIVATE_CHANNEL as Channel['type']};

        renderWithContext(
            <ChannelHeaderButton channel={privateChannel}/>,
            getState([Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES]),
        );
        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));
        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
    });

    test('should not show the add action for archived channels', async () => {
        renderWithContext(
            <ChannelHeaderButton channel={{...emptyChannel, delete_at: 1234}}/>,
            getState([Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]),
        );

        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test.each([
        Constants.DM_CHANNEL,
        Constants.GM_CHANNEL,
    ])('should not show an edit action for %s channels', async (type) => {
        const channel = {...emptyChannel, team_id: '', type: type as Channel['type']};

        renderWithContext(
            <ChannelHeaderButton channel={channel}/>,
            getState([Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES, Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES]),
        );
        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));
        expect(screen.getByText('No channel header yet.')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('should show the header text for DM channels', async () => {
        const channel = {...openChannel, team_id: '', type: Constants.DM_CHANNEL as Channel['type'], header: 'DM header'};
        const dmUser = TestHelper.getUserMock({id: 'other_user'});

        renderWithContext(
            <ChannelHeaderButton
                channel={channel}
                dmUser={dmUser}
            />,
            getState(),
        );
        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));
        expect(screen.getByRole('dialog')).toHaveTextContent('DM header');
    });

    test('should show the bot description for bot DMs', async () => {
        const channel = {...openChannel, team_id: '', type: Constants.DM_CHANNEL as Channel['type'], header: 'ignored header'};
        const dmUser = TestHelper.getUserMock({id: 'bot_user', is_bot: true, bot_description: 'I am a helpful bot'}) as UserProfile;

        renderWithContext(
            <ChannelHeaderButton
                channel={channel}
                dmUser={dmUser}
            />,
            getState(),
        );

        await userEvent.click(screen.getByRole('button', {name: 'Bot description'}));

        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveTextContent('I am a helpful bot');
        expect(dialog).not.toHaveTextContent('ignored header');
    });

    test('should show a bot empty state without an edit action', async () => {
        const channel = {...emptyChannel, team_id: '', type: Constants.DM_CHANNEL as Channel['type']};
        const dmUser = TestHelper.getUserMock({id: 'bot_user', is_bot: true, bot_description: ''});

        renderWithContext(
            <ChannelHeaderButton
                channel={channel}
                dmUser={dmUser}
            />,
            getState([Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]),
        );

        await userEvent.click(screen.getByRole('button', {name: 'Bot description'}));
        expect(screen.getByText('This bot has no description.')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });
});
