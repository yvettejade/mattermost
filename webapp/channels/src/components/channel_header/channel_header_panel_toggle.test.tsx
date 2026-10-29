// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {canEditChannelHeader} from 'selectors/views/channel_header';

import EditChannelHeaderModal from 'components/edit_channel_header_modal';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ChannelHeaderPanelToggle from './channel_header_panel_toggle';

jest.mock('selectors/views/channel_header', () => ({
    canEditChannelHeader: jest.fn(() => false),
}));

const canEdit = canEditChannelHeader as jest.Mock;

describe('components/channel_header/ChannelHeaderPanelToggle', () => {
    beforeEach(() => {
        canEdit.mockReturnValue(false);
    });

    function channelWith(override: Partial<Channel> = {}): Channel {
        return TestHelper.getChannelMock({
            id: 'channel_id',
            header: 'Sprint goal',
            delete_at: 0,
            ...override,
        });
    }

    async function openPanel(channel: Channel = channelWith(), dmUser?: UserProfile) {
        const view = renderWithContext(
            <ChannelHeaderPanelToggle
                channel={channel}
                dmUser={dmUser}
            />,
        );
        const button = screen.getByRole('button', {name: 'Channel header'});
        await userEvent.click(button);
        return {button, ...view};
    }

    test('toggles the panel from the header button', async () => {
        const {button} = await openPanel();

        expect(button).toHaveFocus();
        expect(button).toHaveAttribute('aria-expanded', 'true');
        expect(button).toHaveAttribute('aria-controls', 'channelHeaderPanel');
        expect(button).toHaveAccessibleName('Close channel header');
        expect(screen.getByRole('region', {name: 'Channel header'})).toHaveAttribute('id', 'channelHeaderPanel');
        expect(screen.getByText('Sprint goal')).toBeInTheDocument();

        await userEvent.click(button);

        expect(screen.queryByRole('region', {name: 'Channel header'})).not.toBeInTheDocument();
        expect(button).toHaveAttribute('aria-expanded', 'false');
        expect(button).not.toHaveAttribute('aria-controls');
        expect(button).toHaveAccessibleName('Channel header');
    });

    test('does not close the panel when the user clicks outside it', async () => {
        await openPanel();

        await userEvent.click(document.body);

        expect(screen.getByRole('region', {name: 'Channel header'})).toBeInTheDocument();
    });

    test('closes from the Close button and returns focus to the header button', async () => {
        const {button} = await openPanel();

        await userEvent.click(screen.getByRole('button', {name: 'Close'}));

        expect(screen.queryByRole('region', {name: 'Channel header'})).not.toBeInTheDocument();
        expect(button).toHaveFocus();
    });

    test('closes on Escape inside the panel and returns focus to the header button', async () => {
        const {button} = await openPanel();
        screen.getByRole('button', {name: 'Close'}).focus();

        await userEvent.keyboard('{Escape}');

        expect(screen.queryByRole('region', {name: 'Channel header'})).not.toBeInTheDocument();
        expect(button).toHaveFocus();
    });

    test('shows an add prompt and Edit when the header is blank and the user may edit', async () => {
        canEdit.mockReturnValue(true);
        await openPanel(channelWith({header: '   '}));

        expect(screen.getByText('Add a channel header…')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Edit'})).toBeInTheDocument();
    });

    test('shows a read-only empty message and hides Edit when the user may not edit', async () => {
        await openPanel(channelWith({header: ''}));

        expect(screen.getByText('No channel header')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Edit'})).not.toBeInTheDocument();
    });

    test('opens the edit header modal and leaves the panel open', async () => {
        canEdit.mockReturnValue(true);
        const channel = channelWith({header: 'Visible header'});
        const {store} = await openPanel(channel);

        await userEvent.click(screen.getByRole('button', {name: 'Edit'}));

        expect(store.getState().views.modals.modalState[ModalIdentifiers.EDIT_CHANNEL_HEADER]).toMatchObject({
            open: true,
            dialogType: EditChannelHeaderModal,
            dialogProps: {channel},
        });
        expect(screen.getByRole('region', {name: 'Channel header'})).toBeInTheDocument();
        expect(screen.getByText('Visible header')).toBeInTheDocument();
    });

    test('shows the bot description instead of the channel header', async () => {
        const channel = channelWith({
            type: 'D' as Channel['type'],
            header: 'not the bot description',
        });
        const dmUser = TestHelper.getUserMock({
            is_bot: true,
            bot_description: 'Schedules standups',
        });

        await openPanel(channel, dmUser);

        expect(screen.getByText('Schedules standups')).toBeInTheDocument();
        expect(screen.queryByText('not the bot description')).not.toBeInTheDocument();
    });

    test('renders a multiline header as separate lines', async () => {
        await openPanel(channelWith({header: 'First line\n\nSecond line'}));

        expect(screen.getByText('First line')).toBeInTheDocument();
        expect(screen.getByText('Second line')).toBeInTheDocument();
    });

    test('closes the panel when the channel changes', async () => {
        const channelA = channelWith({id: 'channel_a', header: 'Alpha header'});
        const channelB = channelWith({id: 'channel_b', header: 'Beta header'});
        const {rerender} = renderWithContext(
            <ChannelHeaderPanelToggle channel={channelA}/>,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));
        expect(screen.getByText('Alpha header')).toBeInTheDocument();

        rerender(
            <ChannelHeaderPanelToggle channel={channelB}/>,
        );

        expect(screen.queryByRole('region', {name: 'Channel header'})).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Channel header'})).toHaveAttribute('aria-expanded', 'false');
    });
});
