// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {Permissions} from 'mattermost-redux/constants';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import ChannelHeaderPopoverButton from './channel_header_popover_button';

describe('components/channel_header/ChannelHeaderPopoverButton', () => {
    const publicChannel = TestHelper.getChannelMock({
        id: 'channel_id',
        team_id: 'team_id',
        type: 'O',
        delete_at: 0,
        header: 'Read the [guide](https://example.com/guide) first',
    });

    function stateWith(permissions: string[] = []) {
        return {
            entities: {
                users: {
                    currentUserId: 'user_id',
                    profiles: {
                        user_id: TestHelper.getUserMock({id: 'user_id', roles: 'test_role'}),
                    },
                },
                roles: {
                    roles: {
                        test_role: TestHelper.getRoleMock({name: 'test_role', permissions}),
                    },
                },
            },
        };
    }

    function renderButton(channel: Channel, permissions: string[] = [], dmUser?: UserProfile) {
        return renderWithContext(
            <ChannelHeaderPopoverButton
                channel={channel}
                dmUser={dmUser}
            />,
            stateWith(permissions),
        );
    }

    const headerButton = () => screen.getByRole('button', {name: 'Channel header'});
    const channelSettingsModal = (state: GlobalState) => state.views.modals.modalState[ModalIdentifiers.CHANNEL_SETTINGS];

    test('is an accessible dialog trigger with a tooltip', async () => {
        renderButton(publicChannel);

        const button = headerButton();
        expect(button).toHaveAttribute('id', 'channelHeaderPopoverButton');
        expect(button).toHaveAttribute('aria-haspopup', 'dialog');
        expect(button).toHaveAttribute('aria-expanded', 'false');
        expect(button).not.toHaveAttribute('aria-controls');

        await userEvent.hover(button);
        await waitFor(() => {
            expect(screen.getByText('Channel header')).toBeInTheDocument();
        });

        await userEvent.click(button);

        const dialog = screen.getByRole('dialog', {name: 'Channel header'});
        expect(headerButton()).toHaveAttribute('aria-expanded', 'true');
        expect(headerButton()).toHaveAttribute('aria-controls', dialog.id);
        expect(dialog).toHaveAttribute('id', 'channelHeaderPopover');
    });

    test('toggles the full formatted header', async () => {
        renderButton(publicChannel);

        await userEvent.click(headerButton());

        const dialog = screen.getByRole('dialog', {name: 'Channel header'});
        expect(dialog).toHaveTextContent('Read the guide first');
        expect(screen.getByRole('link', {name: 'guide'})).toHaveAttribute('href', 'https://example.com/guide');
        expect(headerButton()).toHaveClass('channel-header__icon--active');

        await userEvent.click(headerButton());

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(headerButton()).not.toHaveClass('channel-header__icon--active');
        expect(headerButton()).toHaveAttribute('aria-expanded', 'false');
    });

    test('opens from the keyboard and closes on Escape, returning focus', async () => {
        renderButton(publicChannel);

        await userEvent.tab();
        expect(headerButton()).toHaveFocus();
        await userEvent.keyboard('{Enter}');

        const dialog = screen.getByRole('dialog');
        await waitFor(() => {
            expect(dialog).toContainElement(document.activeElement as HTMLElement);
        });

        await userEvent.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await waitFor(() => {
            expect(headerButton()).toHaveFocus();
        });
    });

    test('closes on an outside click', async () => {
        renderButton(publicChannel);

        await userEvent.click(headerButton());
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        await userEvent.click(document.body);

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('renders closed after a channel switch and stays closed on return', async () => {
        const otherChannel = {...publicChannel, id: 'other_channel_id', header: 'Other header'};
        const {rerender} = renderButton(publicChannel);

        await userEvent.click(headerButton());
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        rerender(<ChannelHeaderPopoverButton channel={otherChannel}/>);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(headerButton()).toHaveAttribute('aria-expanded', 'false');

        rerender(<ChannelHeaderPopoverButton channel={publicChannel}/>);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('shows the empty state without actions to members who cannot manage the header', async () => {
        renderButton({...publicChannel, header: '   '});

        await userEvent.click(headerButton());

        expect(screen.getByRole('dialog')).toHaveTextContent('No channel header yet');
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Edit'})).not.toBeInTheDocument();
    });

    test('lets a member with manage public properties add a header through Channel Settings', async () => {
        const {store} = renderButton({...publicChannel, header: ''}, [Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]);

        await userEvent.click(headerButton());
        expect(screen.getByRole('dialog')).toHaveTextContent('No channel header yet');
        expect(screen.queryByRole('button', {name: 'Edit'})).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: 'Add a channel header'}));

        expect(channelSettingsModal(store.getState())).toMatchObject({
            open: true,
            dialogProps: {
                channelId: 'channel_id',
                focusOriginElement: 'channelHeaderPopoverButton',
                isOpen: true,
            },
        });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('lets a member with manage private properties edit a private header through Channel Settings', async () => {
        const privateChannel = {...publicChannel, type: 'P' as const};
        const {store} = renderButton(privateChannel, [Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES]);

        await userEvent.click(headerButton());
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: 'Edit'}));

        expect(channelSettingsModal(store.getState())).toMatchObject({
            open: true,
            dialogProps: {
                channelId: 'channel_id',
                focusOriginElement: 'channelHeaderPopoverButton',
            },
        });
    });

    test('does not offer Edit when the permission is for the other channel type', async () => {
        renderButton(publicChannel, [Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES]);

        await userEvent.click(headerButton());

        expect(screen.getByRole('dialog')).toHaveTextContent('Read the guide first');
        expect(screen.queryByRole('button', {name: 'Edit'})).not.toBeInTheDocument();
    });

    test.each([
        ['DM', 'D' as const],
        ['GM', 'G' as const],
    ])('offers no Add or Edit in a %s even with properties permissions', async (_, type) => {
        const permissions = [Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES, Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES];
        const dmUser = type === 'D' ? TestHelper.getUserMock({id: 'other_user_id'}) : undefined;

        renderButton({...publicChannel, type}, permissions, dmUser);
        await userEvent.click(headerButton());
        expect(screen.getByRole('dialog')).toHaveTextContent('Read the guide first');
        expect(screen.queryByRole('button', {name: 'Edit'})).not.toBeInTheDocument();
    });

    test('offers no Add on an empty GM even with a properties grant', async () => {
        const permissions = [Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES, Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES];

        renderButton({...publicChannel, type: 'G', header: ''}, permissions);
        await userEvent.click(headerButton());

        expect(screen.getByRole('dialog')).toHaveTextContent('No channel header yet');
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Edit'})).not.toBeInTheDocument();
    });

    test('offers no Add or Edit in an archived channel', async () => {
        const permissions = [Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES];

        const {unmount} = renderButton({...publicChannel, delete_at: 1234}, permissions);
        await userEvent.click(headerButton());
        expect(screen.getByRole('dialog')).toHaveTextContent('Read the guide first');
        expect(screen.queryByRole('button', {name: 'Edit'})).not.toBeInTheDocument();
        unmount();

        renderButton({...publicChannel, delete_at: 1234, header: ''}, permissions);
        await userEvent.click(headerButton());
        expect(screen.getByRole('dialog')).toHaveTextContent('No channel header yet');
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('shows the bot description in a bot DM', async () => {
        const botDm = TestHelper.getUserMock({id: 'bot_id', is_bot: true, bot_description: 'I answer questions'});

        renderButton({...publicChannel, type: 'D', header: 'hidden header'}, [Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES], botDm);
        await userEvent.click(headerButton());

        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveTextContent('I answer questions');
        expect(dialog).not.toHaveTextContent('hidden header');
        expect(screen.queryByRole('button', {name: 'Edit'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });
});
