// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelHeaderText, {getChannelHeaderText, getChannelMentionsNameMap, isBotDMChannel} from './channel_header_text';

describe('channel header text helpers', () => {
    const bot = TestHelper.getUserMock({is_bot: true, bot_description: 'Bot text'});
    const human = TestHelper.getUserMock({is_bot: false});

    test('isBotDMChannel should only be true for DMs with a bot', () => {
        expect(isBotDMChannel(TestHelper.getChannelMock({type: 'D'}), bot)).toBe(true);
        expect(isBotDMChannel(TestHelper.getChannelMock({type: 'D'}), human)).toBe(false);
        expect(isBotDMChannel(TestHelper.getChannelMock({type: 'D'}))).toBe(false);
        expect(isBotDMChannel(TestHelper.getChannelMock({type: 'O'}), bot)).toBe(false);
    });

    test('getChannelHeaderText should use the bot description for bot DMs and the header otherwise', () => {
        expect(getChannelHeaderText(TestHelper.getChannelMock({type: 'D', header: 'Header'}), bot)).toBe('Bot text');
        expect(getChannelHeaderText(TestHelper.getChannelMock({type: 'D', header: 'Header'}), human)).toBe('Header');
        expect(getChannelHeaderText(TestHelper.getChannelMock({type: 'O', header: 'Header'}))).toBe('Header');
    });

    test('getChannelMentionsNameMap should only return valid channel mention maps', () => {
        const mentions = {'town-square': {display_name: 'Town Square'}};
        expect(getChannelMentionsNameMap(TestHelper.getChannelMock({props: {channel_mentions: mentions}}))).toBe(mentions);
        expect(getChannelMentionsNameMap(TestHelper.getChannelMock({props: {channel_mentions: 'nope'}}))).toBeUndefined();
        expect(getChannelMentionsNameMap(TestHelper.getChannelMock({}))).toBeUndefined();
    });
});

describe('ChannelHeaderText', () => {
    const defaultTeamId = TestHelper.getTeamMock().id;

    test('should render channel header text when header exists for a channel', () => {
        const channel = TestHelper.getChannelMock({header: 'Test Header'});
        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.getByText('Test Header')).toBeInTheDocument();
    });

    test('should render channel header of bot description for bot DM channels', () => {
        const channel = TestHelper.getChannelMock({type: 'D'});
        const botDm = TestHelper.getUserMock({is_bot: true, bot_description: 'Tranquility'});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
                dmUser={botDm}
            />,
        );

        expect(screen.getByText('Tranquility')).toBeInTheDocument();
    });

    test('should return null if the channel has no header and is archived', () => {
        const channel = TestHelper.getChannelMock({delete_at: 1, header: ''});

        const {container} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(container.childNodes.length).toBe(0);
    });

    test('should return null if its a bot DM channels and its description is empty', () => {
        const channel = TestHelper.getChannelMock({type: 'D'});
        const botDm = TestHelper.getUserMock({is_bot: true, bot_description: ''});

        const {container} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
                dmUser={botDm}
            />,
        );

        expect(container.childNodes.length).toBe(0);
    });

    test('should return null for DM channels without header', () => {
        const channel = TestHelper.getChannelMock({type: 'D', header: ''});

        const {container} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(container.childNodes.length).toBe(0);
    });

    test('should return null for GM channels without header', () => {
        const channel = TestHelper.getChannelMock({type: 'G', header: ''});

        const {container} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(container.childNodes.length).toBe(0);
    });

    test('should return null for public channels without header regardless of permissions', () => {
        const channel = TestHelper.getChannelMock({
            type: 'O',
            header: '',
        });

        const state = {
            entities: {
                channels: {
                    myMembers: {
                        [channel.id]: {channel_id: channel.id, roles: 'channel_role'},
                    },
                    roles: {
                        [channel.id]: new Set(['channel_role']),
                    },
                },
                teams: {
                    myMembers: {
                        [defaultTeamId]: {team_id: defaultTeamId, roles: 'team_role'},
                    },
                },
                users: {
                    currentUserId: 'user_id',
                    profiles: {
                        user_id: {
                            id: 'user_id',
                            roles: 'system_role',
                        },
                    },
                },
                roles: {
                    roles: {
                        system_role: {permissions: ['test_system_permission']},
                        team_role: {permissions: ['test_team_permission']},
                        channel_role: {permissions: ['manage_public_channel_properties']},
                    },
                },
            },
        };

        const {container} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            state,
        );

        expect(container.childNodes.length).toBe(0);
    });
});
