// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as Selectors from 'selectors/rhs';

import {RHSStates} from 'utils/constants';

import type {GlobalState} from 'types/store';
import type {RhsState} from 'types/store/rhs';

describe('Selectors.Rhs', () => {
    describe('should return the last time a post was selected', () => {
        [0, 1000000, 2000000].forEach((expected) => {
            it(`when open is ${expected}`, () => {
                const state = {views: {rhs: {
                    selectedPostFocussedAt: expected,
                }}} as GlobalState;

                expect(Selectors.getSelectedPostFocussedAt(state)).toEqual(expected);
            });
        });
    });

    describe('should return the open state of the sidebar', () => {
        [true, false].forEach((expected) => {
            it(`when open is ${expected}`, () => {
                const state = {views: {rhs: {
                    isSidebarOpen: expected,
                }}} as GlobalState;

                expect(Selectors.getIsRhsOpen(state)).toEqual(expected);
            });
        });
    });

    describe('should return the open state of the sidebar menu', () => {
        [true, false].forEach((expected) => {
            it(`when open is ${expected}`, () => {
                const state = {views: {rhs: {
                    isMenuOpen: expected,
                }}} as GlobalState;

                expect(Selectors.getIsRhsMenuOpen(state)).toEqual(expected);
            });
        });
    });

    describe('should return the highlighted reply\'s id', () => {
        test.each(['42', ''])('when id is %s', (expected) => {
            const state = {views: {rhs: {
                highlightedPostId: expected,
            }}} as GlobalState;

            expect(Selectors.getHighlightedPostId(state)).toEqual(expected);
        });
    });

    describe('should return the previousRhsState', () => {
        test.each([
            [[], null],
            [['channel-info'], 'channel-info'],
            [['channel-info', 'pinned'], 'pinned'],
        ])('%p gives %p', (previousArray, previous) => {
            const state = {
                views: {rhs: {
                    previousRhsStates: previousArray,
                }}} as GlobalState;
            expect(Selectors.getPreviousRhsState(state)).toEqual(previous);
        });
    });

    describe('isChannelInfoRelatedRhsState', () => {
        test.each([
            [RHSStates.CHANNEL_INFO, true],
            [RHSStates.CHANNEL_MEMBERS, true],
            [RHSStates.CHANNEL_FILES, true],
            [RHSStates.PIN, true],
            [RHSStates.CHANNEL_BOOKMARKS, true],
            [RHSStates.CHANNEL_SCHEDULED_POSTS, true],
            [RHSStates.FLAG, false],
            [RHSStates.SEARCH, false],
            [null, false],
        ])('%p is related: %p', (rhsState, expected) => {
            expect(Selectors.isChannelInfoRelatedRhsState(rhsState as RhsState)).toEqual(expected);
        });
    });

    describe('canGoBackFromSelectedPost', () => {
        test.each([
            [RHSStates.SEARCH, true],
            [RHSStates.MENTION, true],
            [RHSStates.FLAG, true],
            [RHSStates.PIN, true],
            [RHSStates.CHANNEL_INFO, true],
            [RHSStates.CHANNEL_MEMBERS, true],
            [RHSStates.CHANNEL_FILES, true],
            [RHSStates.CHANNEL_BOOKMARKS, true],
            [RHSStates.CHANNEL_SCHEDULED_POSTS, true],
            [RHSStates.PLUGIN, false],
            [null, false],
        ])('%p allows thread Back: %p', (rhsState, expected) => {
            expect(Selectors.canGoBackFromSelectedPost(rhsState as RhsState)).toEqual(expected);
        });
    });

    describe('canGoBackFromChannelInfoRhs', () => {
        test.each([
            [[], false],
            [[RHSStates.CHANNEL_INFO], true],
            [[RHSStates.CHANNEL_MEMBERS], true],
            [[RHSStates.CHANNEL_FILES], true],
            [[RHSStates.PIN], true],
            [[RHSStates.CHANNEL_BOOKMARKS], true],
            [[RHSStates.CHANNEL_SCHEDULED_POSTS], true],
            [[RHSStates.CHANNEL_INFO, RHSStates.CHANNEL_BOOKMARKS], true],
            [[RHSStates.CHANNEL_SCHEDULED_POSTS, RHSStates.PIN], true],
            [[RHSStates.FLAG], false],
            [[RHSStates.SEARCH], false],
        ])('previous %p allows back: %p', (previousArray, expected) => {
            const state = {
                views: {rhs: {
                    previousRhsStates: previousArray,
                }}} as GlobalState;
            expect(Selectors.canGoBackFromChannelInfoRhs(state)).toEqual(expected);
        });
    });

    describe('should return the search team', () => {
        test.each([
            [undefined, 'currentTeamId'],
            [null, 'currentTeamId'],
            ['', ''],
            ['searchTeamId', 'searchTeamId'],
        ])('%p gives %p', (searchTeam, expected) => {
            const state = {
                entities: {teams: {currentTeamId: 'currentTeamId'}},
                views: {rhs: {
                    searchTeam,
                }} as any,
            } as GlobalState;

            expect(Selectors.getSearchTeam(state)).toEqual(expected);
        });
    });
});
