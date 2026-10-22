// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PollResults} from '@mattermost/types/polls';

import {receivedPollResults} from 'actions/views/polls';

import polls from './polls';

describe('reducers/views/polls', () => {
    const results = (updateAt: number, voters: string[]): PollResults => ({
        post_id: 'post1',
        votes: {a: voters},
        total_votes: voters.length,
        update_at: updateAt,
    });

    test('stores newer and equal results, drops older ones', () => {
        let state = polls(undefined, receivedPollResults(results(5, ['u1'])));
        expect(state.resultsByPostId.post1.votes.a).toEqual(['u1']);

        state = polls(state, receivedPollResults(results(5, ['u1', 'me'])));
        expect(state.resultsByPostId.post1.votes.a).toEqual(['u1', 'me']);

        state = polls(state, receivedPollResults(results(4, [])));
        expect(state.resultsByPostId.post1.votes.a).toEqual(['u1', 'me']);

        state = polls(state, receivedPollResults(results(6, ['u2'])));
        expect(state.resultsByPostId.post1.votes.a).toEqual(['u2']);
    });
});
