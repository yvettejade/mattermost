// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import ConnectedChannelInfoRhs from './index';

const mockChannelInfoRhs = jest.fn();
jest.mock('./channel_info_rhs', () => ({
    __esModule: true,
    default: (props: unknown) => {
        mockChannelInfoRhs(props);
        return <div/>;
    },
}));

const channelId = 'channel_id';
const otherChannelId = 'other_channel_id';
const teamId = 'team_id';
const userId = 'user_id';

function makeState(overrides: DeepPartial<GlobalState> = {}): DeepPartial<GlobalState> {
    const base: DeepPartial<GlobalState> = {
        entities: {
            general: {
                config: {
                    CollapsedThreads: 'disabled',
                    ScheduledPosts: 'true',
                },
                license: {IsLicensed: 'true'},
            },
            users: {
                currentUserId: userId,
                profiles: {[userId]: TestHelper.getUserMock({id: userId, roles: 'system_user'})},
                profilesInChannel: {},
                statuses: {},
            },
            teams: {
                currentTeamId: teamId,
                teams: {[teamId]: TestHelper.getTeamMock({id: teamId, name: 'team-name'})},
            },
            channels: {
                currentChannelId: channelId,
                channels: {
                    [channelId]: TestHelper.getChannelMock({id: channelId, team_id: teamId, type: 'O'}),
                    [otherChannelId]: TestHelper.getChannelMock({id: otherChannelId, team_id: teamId, type: 'O'}),
                },
                stats: {[channelId]: {channel_id: channelId, member_count: 4, guest_count: 0, pinnedpost_count: 2, files_count: 1}},
                messageCounts: {
                    [channelId]: {total: 20, root: 12},
                    [otherChannelId]: {total: 5, root: 5},
                },
                myMembers: {
                    [channelId]: TestHelper.getChannelMembershipMock({
                        channel_id: channelId,
                        user_id: userId,
                        msg_count: 15,
                        msg_count_root: 9,
                        mention_count: 3,
                        mention_count_root: 1,
                    }),
                    [otherChannelId]: TestHelper.getChannelMembershipMock({
                        channel_id: otherChannelId,
                        user_id: userId,
                        msg_count: 5,
                        msg_count_root: 5,
                    }),
                },
            },
            channelBookmarks: {
                byChannelId: {
                    [channelId]: {
                        b1: {id: 'b1'},
                        b2: {id: 'b2'},
                        b3: {id: 'b3'},
                    },
                },
            },
            scheduledPosts: {
                byId: {
                    sp1: {id: 'sp1', channel_id: channelId, root_id: ''},
                    sp2: {id: 'sp2', channel_id: channelId, root_id: ''},
                    sp3: {id: 'sp3', channel_id: channelId, root_id: '', error_code: 'unknown'},
                    sp4: {id: 'sp4', channel_id: channelId, root_id: 'root_post_id'},
                },
                byChannelOrThreadId: {
                    [channelId]: ['sp1', 'sp2', 'sp3'],
                    root_post_id: ['sp4'],
                },
            },
        },
        views: {
            browser: {windowSize: 'desktopView'},
        },
    } as unknown as DeepPartial<GlobalState>;

    return {
        ...base,
        ...overrides,
        entities: {
            ...base.entities,
            ...overrides.entities,
        },
    } as DeepPartial<GlobalState>;
}

function lastProps() {
    return mockChannelInfoRhs.mock.calls[mockChannelInfoRhs.mock.calls.length - 1][0];
}

describe('components/channel_info_rhs/index', () => {
    beforeEach(() => {
        mockChannelInfoRhs.mockClear();
    });

    test('maps the unread message and mention counts for the current channel (CRT off)', () => {
        renderWithContext(<ConnectedChannelInfoRhs/>, makeState());

        expect(lastProps().unreadCount).toEqual({messages: 5, mentions: 3});
    });

    test('maps the root-level unread counts when collapsed reply threads is on', () => {
        const state = makeState();
        (state.entities!.general!.config as Record<string, string>).CollapsedThreads = 'always_on';

        renderWithContext(<ConnectedChannelInfoRhs/>, state);

        expect(lastProps().unreadCount).toEqual({messages: 3, mentions: 1});
    });

    test('follows the current channel', () => {
        const state = makeState();
        const {replaceStoreState} = renderWithContext(<ConnectedChannelInfoRhs/>, state);

        expect(lastProps().channel.id).toBe(channelId);

        (state.entities!.channels as {currentChannelId: string}).currentChannelId = otherChannelId;
        replaceStoreState(state);

        expect(lastProps().channel.id).toBe(otherChannelId);
        expect(lastProps().unreadCount).toEqual({messages: 0, mentions: 0});
        expect(lastProps().bookmarksCount).toBe(0);
        expect(lastProps().scheduledPostsCount).toBe(0);
    });

    test('maps the bookmark count and enabled flag', () => {
        const state = makeState();
        (state.entities!.general as {config: Record<string, string>}).config.FeatureFlagChannelBookmarks = 'true';

        renderWithContext(<ConnectedChannelInfoRhs/>, state);

        expect(lastProps().isBookmarksEnabled).toBe(true);
        expect(lastProps().bookmarksCount).toBe(3);
    });

    test('flags bookmarks as disabled when the feature flag is off', () => {
        renderWithContext(<ConnectedChannelInfoRhs/>, makeState());

        expect(lastProps().isBookmarksEnabled).toBe(false);
    });

    test('counts only non-errored root-level scheduled posts of the channel', () => {
        renderWithContext(<ConnectedChannelInfoRhs/>, makeState());

        expect(lastProps().isScheduledPostsEnabled).toBe(true);
        expect(lastProps().scheduledPostsCount).toBe(2);
    });

    test('disables the scheduled posts row when the feature is off', () => {
        const state = makeState();
        (state.entities!.general as {config: Record<string, string>}).config.ScheduledPosts = 'false';

        renderWithContext(<ConnectedChannelInfoRhs/>, state);

        expect(lastProps().isScheduledPostsEnabled).toBe(false);
        expect(lastProps().scheduledPostsCount).toBe(0);
    });

    test('disables the scheduled posts row when unlicensed', () => {
        const state = makeState();
        (state.entities!.general as {license: Record<string, string>}).license = {IsLicensed: 'false'};

        renderWithContext(<ConnectedChannelInfoRhs/>, state);

        expect(lastProps().isScheduledPostsEnabled).toBe(false);
    });

    test('maps the channel stats used by the members and pinned rows', () => {
        renderWithContext(<ConnectedChannelInfoRhs/>, makeState());

        expect(lastProps().channelStats).toEqual(expect.objectContaining({member_count: 4, pinnedpost_count: 2}));
    });
});
