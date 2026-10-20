// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TestHelper} from 'utils/test_helper';

import {getChannelHeaderText, hasChannelHeaderText} from './channel_header_text_utils';

describe('channel_header_text_utils', () => {
    test('getChannelHeaderText returns channel header for regular channels', () => {
        const channel = TestHelper.getChannelMock({header: 'Team updates'});
        expect(getChannelHeaderText(channel)).toBe('Team updates');
    });

    test('getChannelHeaderText returns bot description for bot DM channels', () => {
        const channel = TestHelper.getChannelMock({type: 'D'});
        const bot = TestHelper.getUserMock({is_bot: true, bot_description: 'I am a bot'});
        expect(getChannelHeaderText(channel, bot)).toBe('I am a bot');
    });

    test('hasChannelHeaderText is false when header is whitespace only', () => {
        const channel = TestHelper.getChannelMock({header: '   '});
        expect(hasChannelHeaderText(channel)).toBe(false);
    });
});
