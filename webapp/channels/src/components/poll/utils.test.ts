// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PollResults} from '@mattermost/types/polls';
import type {Post} from '@mattermost/types/posts';

import {TestHelper} from 'utils/test_helper';

import {applyVoteLocally, getPercent, getPollFromPost, getUserVote} from './utils';

describe('poll utils', () => {
    const results: PollResults = {
        post_id: 'post1',
        votes: {a: ['u1', 'me'], b: ['u2'], c: []},
        total_votes: 3,
        update_at: 1,
    };

    describe('getPollFromPost', () => {
        const withPoll = (poll: unknown) => TestHelper.getPostMock({type: 'custom_poll' as Post['type'], props: {poll}});
        const options = [{id: 'a', text: 'Tacos'}, {id: 'b', text: 'Pizza'}];

        test('returns a well-formed poll with only id and text on options', () => {
            const poll = getPollFromPost(withPoll({question: 'Lunch?', options: [{...options[0], extra: 1}, options[1]]}));
            expect(poll).toEqual({question: 'Lunch?', options});
        });

        test.each([
            ['missing poll', undefined],
            ['non-object poll', 'Lunch?'],
            ['non-string question', {question: 42, options}],
            ['blank question', {question: '   ', options}],
            ['too long question', {question: 'q'.repeat(301), options}],
            ['options not an array', {question: 'Q', options: {a: 'Tacos'}}],
            ['too few options', {question: 'Q', options: [options[0]]}],
            ['too many options', {question: 'Q', options: Array.from({length: 11}, (_, i) => ({id: `${i}`, text: `${i}`}))}],
            ['null option', {question: 'Q', options: [options[0], null]}],
            ['numeric option id', {question: 'Q', options: [options[0], {id: 2, text: 'Pizza'}]}],
            ['non-string option text', {question: 'Q', options: [options[0], {id: 'b', text: {evil: true}}]}],
            ['too long option text', {question: 'Q', options: [options[0], {id: 'b', text: 'o'.repeat(101)}]}],
            ['duplicate option ids', {question: 'Q', options: [options[0], {id: 'a', text: 'Pizza'}]}],
        ])('rejects %s', (_, poll) => {
            expect(getPollFromPost(withPoll(poll))).toBeUndefined();
        });
    });

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
