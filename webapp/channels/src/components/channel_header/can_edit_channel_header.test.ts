// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {General} from 'mattermost-redux/constants';

import {TestHelper} from 'utils/test_helper';

import {canEditChannelHeader} from './can_edit_channel_header';

describe('canEditChannelHeader', () => {
    const cases: Array<{
        name: string;
        channel: ReturnType<typeof TestHelper.getChannelMock> | null;
        isBotDm: boolean;
        canManageProperties: boolean;
        want: boolean;
    }> = [
        {
            name: 'missing channel',
            channel: null,
            isBotDm: false,
            canManageProperties: true,
            want: false,
        },
        {
            name: 'archived channel',
            channel: TestHelper.getChannelMock({delete_at: 1}),
            isBotDm: false,
            canManageProperties: true,
            want: false,
        },
        {
            name: 'bot direct message',
            channel: TestHelper.getChannelMock({type: General.DM_CHANNEL}),
            isBotDm: true,
            canManageProperties: true,
            want: false,
        },
        {
            name: 'direct message',
            channel: TestHelper.getChannelMock({type: General.DM_CHANNEL}),
            isBotDm: false,
            canManageProperties: false,
            want: true,
        },
        {
            name: 'group message',
            channel: TestHelper.getChannelMock({type: General.GM_CHANNEL}),
            isBotDm: false,
            canManageProperties: false,
            want: true,
        },
        {
            name: 'public channel without manage properties',
            channel: TestHelper.getChannelMock({type: General.OPEN_CHANNEL}),
            isBotDm: false,
            canManageProperties: false,
            want: false,
        },
        {
            name: 'public channel with manage properties',
            channel: TestHelper.getChannelMock({type: General.OPEN_CHANNEL}),
            isBotDm: false,
            canManageProperties: true,
            want: true,
        },
        {
            name: 'private channel without manage properties',
            channel: TestHelper.getChannelMock({type: General.PRIVATE_CHANNEL}),
            isBotDm: false,
            canManageProperties: false,
            want: false,
        },
        {
            name: 'private channel with manage properties',
            channel: TestHelper.getChannelMock({type: General.PRIVATE_CHANNEL}),
            isBotDm: false,
            canManageProperties: true,
            want: true,
        },
    ];

    test.each(cases)('$name', ({channel, isBotDm, canManageProperties, want}) => {
        expect(canEditChannelHeader(channel, isBotDm, canManageProperties)).toBe(want);
    });
});
