// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {makeGetChannelUnreadCount} from 'mattermost-redux/selectors/entities/channels';

import {act, renderWithContext} from 'tests/react_testing_utils';
import {ActionTypes, Constants} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import ChannelInfoRhsConnected from './index';

const mockChannelInfoRhs = jest.fn();
jest.mock('./channel_info_rhs', () => {
    const MockChannelInfoRhs = (props: unknown) => {
        mockChannelInfoRhs(props);
        return <div data-testid='channel-info-rhs'/>;
    };
    return {__esModule: true, default: MockChannelInfoRhs};
});

jest.mock('actions/channel_bookmarks', () => ({
    fetchChannelBookmarks: jest.fn(() => ({type: 'MOCK_FETCH_CHANNEL_BOOKMARKS'})),
}));

const currentUserId = 'current_user_id';
const teamId = 'team_id';
const channelId = 'channel_id';
const otherChannelId = 'other_channel_id';

type StateOptions = {
    collapsedThreads: boolean;
    channelType?: string;
    channelName?: string;
}

function makeState({collapsedThreads, channelType = Constants.OPEN_CHANNEL, channelName = 'town-square'}: StateOptions) {
    const channel = TestHelper.getChannelMock({id: channelId, team_id: teamId, type: channelType as 'O', name: channelName, display_name: 'Town Square'});
    const otherChannel = TestHelper.getChannelMock({id: otherChannelId, team_id: teamId, name: 'off-topic', display_name: 'Off-Topic'});

    return {
        entities: {
            general: {
                config: {
                    CollapsedThreads: collapsedThreads ? 'always_on' : 'disabled',
                    FeatureFlagChannelBookmarks: 'true',
                    ScheduledPosts: 'true',
                },
                license: {IsLicensed: 'true'},
            },
            users: {
                currentUserId,
                profiles: {
                    [currentUserId]: TestHelper.getUserMock({id: currentUserId, roles: 'system_user'}),
                    other_user_id: TestHelper.getUserMock({id: 'other_user_id', username: 'other', roles: 'system_user'}),
                },
                profilesInChannel: {[channelId]: new Set([currentUserId])},
            },
            teams: {
                currentTeamId: teamId,
                teams: {[teamId]: TestHelper.getTeamMock({id: teamId, name: 'team-1'})},
            },
            channels: {
                currentChannelId: channelId,
                channels: {[channelId]: channel, [otherChannelId]: otherChannel},
                channelsInTeam: {[teamId]: new Set([channelId, otherChannelId])},
                myMembers: {
                    [channelId]: TestHelper.getChannelMembershipMock({
                        channel_id: channelId,
                        user_id: currentUserId,
                        msg_count: 10,
                        msg_count_root: 5,
                        mention_count: 4,
                        mention_count_root: 2,
                    }),
                    [otherChannelId]: TestHelper.getChannelMembershipMock({
                        channel_id: otherChannelId,
                        user_id: currentUserId,
                        msg_count: 0,
                        msg_count_root: 0,
                        mention_count: 1,
                        mention_count_root: 1,
                    }),
                },
                messageCounts: {
                    [channelId]: {total: 17, root: 12},
                    [otherChannelId]: {total: 3, root: 2},
                },
                stats: {
                    [channelId]: {channel_id: channelId, member_count: 5, guest_count: 0, pinnedpost_count: 2, files_count: 1},
                },
            },
            channelBookmarks: {
                byChannelId: {
                    [channelId]: {
                        bookmark1: {id: 'bookmark1', channel_id: channelId, sort_order: 0},
                        bookmark2: {id: 'bookmark2', channel_id: channelId, sort_order: 1},
                        bookmark3: {id: 'bookmark3', channel_id: channelId, sort_order: 2},
                    },
                },
            },
            scheduledPosts: {
                byId: {
                    sp1: {id: 'sp1', channel_id: channelId, root_id: ''},
                    sp2: {id: 'sp2', channel_id: channelId, root_id: ''},
                    sp3: {id: 'sp3', channel_id: channelId, root_id: '', error_code: 'unable_to_send'},
                },
                byTeamId: {[teamId]: ['sp1', 'sp2', 'sp3']},
                errorsByTeamId: {},
                byChannelOrThreadId: {[channelId]: ['sp1', 'sp2', 'sp3']},
            },
        },
    } as unknown as DeepPartial<GlobalState>;
}

function lastProps() {
    return mockChannelInfoRhs.mock.calls[mockChannelInfoRhs.mock.calls.length - 1][0];
}

describe('channel_info_rhs/index', () => {
    beforeEach(() => {
        mockChannelInfoRhs.mockClear();
    });

    test('should map root-level unread counts when collapsed threads is on', () => {
        renderWithContext(<ChannelInfoRhsConnected/>, makeState({collapsedThreads: true}));

        expect(lastProps().unreadCount).toMatchObject({messages: 7, mentions: 2});
    });

    test('should map total unread counts when collapsed threads is off', () => {
        renderWithContext(<ChannelInfoRhsConnected/>, makeState({collapsedThreads: false}));

        expect(lastProps().unreadCount).toMatchObject({messages: 7, mentions: 4});
    });

    test('should match the counts returned by makeGetChannelUnreadCount', () => {
        [true, false].forEach((collapsedThreads) => {
            mockChannelInfoRhs.mockClear();
            const state = makeState({collapsedThreads});
            const {store} = renderWithContext(<ChannelInfoRhsConnected/>, state);

            const expected = makeGetChannelUnreadCount()(store.getState() as GlobalState, channelId);
            expect(lastProps().unreadCount).toEqual(expected);
        });
    });

    test('should map the bookmark count and the non-errored root scheduled post count', () => {
        renderWithContext(<ChannelInfoRhsConnected/>, makeState({collapsedThreads: false}));

        const props = lastProps();
        expect(props.isBookmarksEnabled).toBe(true);
        expect(props.bookmarksCount).toBe(3);
        expect(props.isScheduledPostsEnabled).toBe(true);
        expect(props.scheduledPostsCount).toBe(2);
    });

    test('should report disabled features with zero counts', () => {
        const state = makeState({collapsedThreads: false});
        (state.entities!.general!.config as Record<string, string>).FeatureFlagChannelBookmarks = 'false';
        (state.entities!.general!.config as Record<string, string>).ScheduledPosts = 'false';

        renderWithContext(<ChannelInfoRhsConnected/>, state);

        const props = lastProps();
        expect(props.isBookmarksEnabled).toBe(false);
        expect(props.bookmarksCount).toBe(0);
        expect(props.isScheduledPostsEnabled).toBe(false);
        expect(props.scheduledPostsCount).toBe(0);
    });

    test('should follow the current channel', () => {
        const {store} = renderWithContext(<ChannelInfoRhsConnected/>, makeState({collapsedThreads: false}));

        expect(lastProps().channel.id).toBe(channelId);

        act(() => {
            store.dispatch({type: 'SELECT_CHANNEL', data: otherChannelId});
        });

        const props = lastProps();
        expect(props.channel.id).toBe(otherChannelId);
        expect(props.unreadCount).toMatchObject({messages: 3, mentions: 1});
        expect(props.bookmarksCount).toBe(0);
        expect(props.scheduledPostsCount).toBe(0);
    });

    test('should not re-render when unrelated state changes', () => {
        const {store} = renderWithContext(<ChannelInfoRhsConnected/>, makeState({collapsedThreads: false}));
        const renderCount = mockChannelInfoRhs.mock.calls.length;
        const unreadCountBefore = lastProps().unreadCount;

        act(() => {
            store.dispatch({type: ActionTypes.MODAL_OPEN, modalId: 'unrelated_modal', dialogType: () => null, dialogProps: {}});
        });
        act(() => {
            store.dispatch({type: ActionTypes.MODAL_CLOSE, modalId: 'unrelated_modal'});
        });

        expect(mockChannelInfoRhs.mock.calls.length).toBe(renderCount);
        expect(lastProps().unreadCount).toBe(unreadCountBefore);
    });

    test('should not re-render on unrelated state changes in a DM', () => {
        const state = makeState({collapsedThreads: false, channelType: Constants.DM_CHANNEL, channelName: `${currentUserId}__other_user_id`});
        const {store} = renderWithContext(<ChannelInfoRhsConnected/>, state);
        const renderCount = mockChannelInfoRhs.mock.calls.length;

        expect(lastProps().dmUser.user.id).toBe('other_user_id');

        act(() => {
            store.dispatch({type: ActionTypes.MODAL_OPEN, modalId: 'unrelated_modal', dialogType: () => null, dialogProps: {}});
        });

        expect(mockChannelInfoRhs.mock.calls.length).toBe(renderCount);
    });
});
