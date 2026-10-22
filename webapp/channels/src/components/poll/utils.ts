// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Poll, PollResults} from '@mattermost/types/polls';
import type {Post} from '@mattermost/types/posts';

export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 10;
export const POLL_QUESTION_MAX_LENGTH = 300;
export const POLL_OPTION_MAX_LENGTH = 100;

export function getPollFromPost(post: Post): Poll | undefined {
    const poll = post.props?.poll as Poll | undefined;
    if (!poll || typeof poll.question !== 'string' || !Array.isArray(poll.options)) {
        return undefined;
    }
    return poll;
}

export function emptyPollResults(postId: string, poll: Poll): PollResults {
    return {
        post_id: postId,
        votes: Object.fromEntries(poll.options.map((option) => [option.id, []])),
        total_votes: 0,
    };
}

export function getUserVote(results: PollResults, userId: string): string | undefined {
    return Object.keys(results.votes).find((optionId) => results.votes[optionId].includes(userId));
}

export function getPercent(count: number, total: number): number {
    if (!total) {
        return 0;
    }
    return Math.round((count / total) * 100);
}

/**
 * Mirrors the server's vote semantics so the UI can update before the request
 * resolves: a user holds at most one vote, and a null option retracts it.
 */
export function applyVoteLocally(results: PollResults, userId: string, optionId: string | null): PollResults {
    const votes: PollResults['votes'] = {};
    let total = 0;

    for (const [id, voters] of Object.entries(results.votes)) {
        const next = voters.filter((voter) => voter !== userId);
        if (id === optionId) {
            next.push(userId);
        }
        votes[id] = next;
        total += next.length;
    }

    return {...results, votes, total_votes: total};
}
