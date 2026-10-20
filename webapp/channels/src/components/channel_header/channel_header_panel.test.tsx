// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelHeaderPanel, {CHANNEL_HEADER_PANEL_ID} from './channel_header_panel';

describe('ChannelHeaderPanel', () => {
    const channel = TestHelper.getChannelMock({
        id: 'channel_id',
        header: 'Standup at 9 · [notes](https://example.com)',
    });

    const baseProps = {
        channel,
        canEdit: true,
        onClose: jest.fn(),
    };

    beforeEach(() => {
        baseProps.onClose.mockClear();
    });

    test('renders the panel title and full header markdown', () => {
        renderWithContext(
            <ChannelHeaderPanel {...baseProps}/>,
        );

        expect(screen.getByRole('region', {name: 'Channel header'})).toHaveAttribute('id', CHANNEL_HEADER_PANEL_ID);
        expect(screen.getByRole('heading', {name: 'Channel header'})).toBeInTheDocument();
        expect(screen.getByText(/Standup at 9/)).toBeInTheDocument();
        expect(screen.getByRole('link', {name: 'notes'})).toBeInTheDocument();
    });

    test('shows an empty state when the header is blank', () => {
        renderWithContext(
            <ChannelHeaderPanel
                {...baseProps}
                channel={TestHelper.getChannelMock({id: 'channel_id', header: ''})}
            />,
        );

        expect(screen.getByText('Add a channel header…')).toBeInTheDocument();
    });

    test('does not prompt to add a header when the user cannot edit', () => {
        renderWithContext(
            <ChannelHeaderPanel
                {...baseProps}
                canEdit={false}
                channel={TestHelper.getChannelMock({id: 'channel_id', header: ''})}
            />,
        );

        expect(screen.queryByText('Add a channel header…')).not.toBeInTheDocument();
        expect(screen.getByText('No channel header')).toBeInTheDocument();
    });

    test('calls onClose from the panel Close action', async () => {
        renderWithContext(
            <ChannelHeaderPanel {...baseProps}/>,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Close'}));
        expect(baseProps.onClose).toHaveBeenCalledTimes(1);
    });

    test('closes the panel when Escape is pressed while focus is inside it', async () => {
        renderWithContext(
            <ChannelHeaderPanel {...baseProps}/>,
        );

        const panel = screen.getByRole('region', {name: 'Channel header'});
        panel.focus();
        await userEvent.keyboard('{Escape}');

        expect(baseProps.onClose).toHaveBeenCalledTimes(1);
    });

    test('renders a bot description for bot DM channels', () => {
        renderWithContext(
            <ChannelHeaderPanel
                {...baseProps}
                channel={TestHelper.getChannelMock({type: 'D', header: 'ignored'})}
                dmUser={TestHelper.getUserMock({is_bot: true, bot_description: 'I schedule standups'})}
                canEdit={false}
            />,
        );

        expect(screen.getByText('I schedule standups')).toBeInTheDocument();
        expect(screen.queryByText('ignored')).not.toBeInTheDocument();
    });
});
