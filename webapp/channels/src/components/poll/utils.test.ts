// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PollResults} from '@mattermost/types/polls';

import {applyVoteLocally, getPercent, getUserVote} from './utils';

describe('poll utils', () => {
    const results: PollResults = {
        post_id: 'post1',
        votes: {a: ['u1', 'me'], b: ['u2'], c: []},
        total_votes: 3,
    };

    test('getUserVote finds the option the user voted for', () => {
        expect(getUserVote(results, 'me')).toBe('a');
        expect(getUserVote(results, 'nobody')).toBeUndefined();
    });

    test('getPercent rounds and handles zero totals', () => {
        expect(getPercent(1, 3)).toBe(33);
        expect(getPercent(2, 3)).toBe(67);
        expect(getPercent(0, 0)).toBe(0);
    });

    test('applyVoteLocally moves an existing vote', () => {
        const next = applyVoteLocally(results, 'me', 'c');

        expect(next.votes).toEqual({a: ['u1'], b: ['u2'], c: ['me']});
        expect(next.total_votes).toBe(3);
        expect(results.votes.a).toEqual(['u1', 'me']);
    });

    test('applyVoteLocally adds a new vote', () => {
        const next = applyVoteLocally(results, 'u3', 'b');

        expect(next.votes.b).toEqual(['u2', 'u3']);
        expect(next.total_votes).toBe(4);
    });

    test('applyVoteLocally retracts with a null option', () => {
        const next = applyVoteLocally(results, 'me', null);

        expect(next.votes.a).toEqual(['u1']);
        expect(next.total_votes).toBe(2);
    });
});
