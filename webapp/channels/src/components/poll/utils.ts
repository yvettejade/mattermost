// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages} from 'react-intl';

import type {Poll, PollOption, PollResults} from '@mattermost/types/polls';
import type {Post} from '@mattermost/types/posts';

// Mirror the server limits in model/poll.go.
export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 10;
export const POLL_QUESTION_MAX_LENGTH = 300;
export const POLL_OPTION_MAX_LENGTH = 100;

export const pollMessages = defineMessages({
    visibilityNotice: {id: 'poll.visibility_notice', defaultMessage: 'Votes are visible to channel members'},
});

function isNonEmptyWithin(value: unknown, maxLength: number): value is string {
    if (typeof value !== 'string') {
        return false;
    }
    const length = [...value.trim()].length;
    return length > 0 && length <= maxLength;
}

function isValidOption(option: unknown): option is PollOption {
    if (!option || typeof option !== 'object') {
        return false;
    }
    const {id, text} = option as Record<string, unknown>;
    return typeof id === 'string' && id.length > 0 && isNonEmptyWithin(text, POLL_OPTION_MAX_LENGTH);
}

/**
 * Returns the poll only if props.poll has the exact shape the server produces,
 * so a malformed post falls back to rendering its plain message.
 */
export function getPollFromPost(post: Post): Poll | undefined {
    const poll = post.props?.poll as Record<string, unknown> | undefined;
    if (!poll || typeof poll !== 'object') {
        return undefined;
    }

    const {question, options} = poll;
    if (!isNonEmptyWithin(question, POLL_QUESTION_MAX_LENGTH) || !Array.isArray(options)) {
        return undefined;
    }
    if (options.length < POLL_MIN_OPTIONS || options.length > POLL_MAX_OPTIONS || !options.every(isValidOption)) {
        return undefined;
    }
    if (new Set(options.map((option) => option.id)).size !== options.length) {
        return undefined;
    }

    return {question, options: options.map(({id, text}) => ({id, text}))};
}

export function emptyPollResults(postId: string, poll: Poll): PollResults {
    return {
        post_id: postId,
        votes: Object.fromEntries(poll.options.map((option) => [option.id, []])),
        total_votes: 0,
        update_at: 0,
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
 * update_at is kept so any real server result supersedes the optimistic one.
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
