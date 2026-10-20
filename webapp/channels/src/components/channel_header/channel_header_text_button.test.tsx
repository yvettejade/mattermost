// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as modalActions from 'actions/views/modals';

import ChannelSettingsModal from 'components/channel_settings_modal/channel_settings_modal';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ChannelHeaderTextButton from './channel_header_text_button';

describe('ChannelHeaderTextButton', () => {
    const defaultTeamId = TestHelper.getTeamMock().id;

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should render channel header button in the header icon row', () => {
        const channel = TestHelper.getChannelMock({header: 'Test Header'});

        renderWithContext(
            <ChannelHeaderTextButton
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.getByRole('button', {name: 'View channel header'})).toBeInTheDocument();
    });

    test('should open channel settings when add header is clicked for GM channels without header', async () => {
        const channel = TestHelper.getChannelMock({type: 'G', header: ''});
        const openModal = jest.spyOn(modalActions, 'openModal');

        renderWithContext(
            <ChannelHeaderTextButton
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Add a channel header'}));

        expect(openModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.CHANNEL_SETTINGS,
            dialogType: ChannelSettingsModal,
            dialogProps: {
                channelId: channel.id,
                focusOriginElement: 'channelHeaderTextButton',
                isOpen: true,
            },
        });
    });

    test('should show empty header feedback when header is missing and user cannot edit', async () => {
        const channel = TestHelper.getChannelMock({
            type: 'O',
            header: '',
        });

        renderWithContext(
            <ChannelHeaderTextButton
                teamId={defaultTeamId}
                channel={channel}
            />,
            {
                entities: {
                    channels: {
                        channels: {
                            [channel.id]: channel,
                        },
                    },
                    roles: {
                        roles: {
                            channel_user: {
                                permissions: [],
                            },
                        },
                    },
                },
            },
        );

        await userEvent.click(screen.getByRole('button', {name: 'View channel header'}));

        expect(await screen.findByText('This channel has no header')).toBeInTheDocument();
    });
});
