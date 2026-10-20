// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TestHelper} from 'utils/test_helper';

import {getChannelHeaderDisplayText} from './get_channel_header_display_text';

describe('getChannelHeaderDisplayText', () => {
    test('returns channel header for public channels', () => {
        const channel = TestHelper.getChannelMock({header: 'Team updates'});
        expect(getChannelHeaderDisplayText(channel)).toBe('Team updates');
    });

    test('returns bot description for bot DM channels', () => {
        const channel = TestHelper.getChannelMock({type: 'D', header: 'ignored'});
        const botUser = TestHelper.getUserMock({is_bot: true, bot_description: 'Bot purpose'});

        expect(getChannelHeaderDisplayText(channel, botUser)).toBe('Bot purpose');
    });

    test('returns empty string when channel is undefined', () => {
        expect(getChannelHeaderDisplayText(undefined)).toBe('');
    });
});
