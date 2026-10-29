// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TestHelper} from 'utils/test_helper';

import {getChannelHeaderContent} from './channel_header_content';

describe('getChannelHeaderContent', () => {
    test('returns the channel header', () => {
        const channel = TestHelper.getChannelMock({type: 'O', header: 'Welcome'});

        expect(getChannelHeaderContent(channel)).toEqual({kind: 'text', text: 'Welcome', channelNamesMap: undefined});
    });

    test('returns the bot description instead of the header in a bot DM', () => {
        const channel = TestHelper.getChannelMock({type: 'D', header: 'ignored'});
        const bot = TestHelper.getUserMock({is_bot: true, bot_description: 'Tranquility'});

        expect(getChannelHeaderContent(channel, bot)).toMatchObject({kind: 'text', text: 'Tranquility'});
    });

    test('returns the header in a DM with a person', () => {
        const channel = TestHelper.getChannelMock({type: 'D', header: 'Our DM'});
        const person = TestHelper.getUserMock({is_bot: false, bot_description: 'not shown'});

        expect(getChannelHeaderContent(channel, person)).toMatchObject({kind: 'text', text: 'Our DM'});
    });

    test.each([
        ['empty', ''],
        ['whitespace-only', ' \n\t '],
    ])('treats an %s header as empty', (_, header) => {
        expect(getChannelHeaderContent(TestHelper.getChannelMock({header}))).toEqual({kind: 'empty'});
    });

    test('treats a bot DM without a description as empty', () => {
        const channel = TestHelper.getChannelMock({type: 'D', header: 'ignored'});
        const bot = TestHelper.getUserMock({is_bot: true, bot_description: ''});

        expect(getChannelHeaderContent(channel, bot)).toEqual({kind: 'empty'});
    });

    test('passes channel mentions through when they are a valid names map', () => {
        const channelMentions = {town: {display_name: 'Town Square', team_name: 'team'}, off: 'Off-Topic'};
        const channel = TestHelper.getChannelMock({header: 'See ~town', props: {channel_mentions: channelMentions}});

        expect(getChannelHeaderContent(channel)).toEqual({kind: 'text', text: 'See ~town', channelNamesMap: channelMentions});
    });

    test('drops channel mentions that are not a valid names map', () => {
        const channel = TestHelper.getChannelMock({header: 'See ~town', props: {channel_mentions: {town: {display_name: 42}}}});

        expect(getChannelHeaderContent(channel)).toEqual({kind: 'text', text: 'See ~town', channelNamesMap: undefined});
    });
});
