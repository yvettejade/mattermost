// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ServerError} from '@mattermost/types/errors';
import type {Poll, PollResults} from '@mattermost/types/polls';
import type {Post} from '@mattermost/types/posts';

import {logError} from 'mattermost-redux/actions/errors';
import {forceLogoutIfNecessary} from 'mattermost-redux/actions/helpers';
import {Client4} from 'mattermost-redux/client';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {createPost} from 'actions/post_actions';

import {ActionTypes, PostTypes} from 'utils/constants';

import type {ActionFuncAsync} from 'types/store';

export function receivedPollResults(results: PollResults) {
    return {
        type: ActionTypes.RECEIVED_POLL_RESULTS,
        data: results,
    };
}

export function fetchPollResults(postId: string): ActionFuncAsync<PollResults> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.getPollResults(postId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error: error as ServerError};
        }

        dispatch(receivedPollResults(data));
        return {data};
    };
}

/**
 * Sets the current user's vote. Passing null retracts it.
 *
 * The response is not stored: it can arrive after a newer poll_updated event,
 * so the store only takes results from the ordered websocket broadcast.
 */
export function votePoll(postId: string, optionId: string | null): ActionFuncAsync<PollResults> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = optionId ? await Client4.votePoll(postId, optionId) : await Client4.retractPollVote(postId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error: error as ServerError};
        }

        return {data};
    };
}

export function createPoll(channelId: string, rootId: string, poll: Poll): ActionFuncAsync {
    return async (dispatch, getState) => {
        const post = {
            user_id: getCurrentUserId(getState()),
            channel_id: channelId,
            root_id: rootId,

            // Plain-text fallback for notifications and clients that don't render polls.
            message: `📊 ${poll.question}`,
            type: PostTypes.CUSTOM_POLL,
            props: {poll},
        } as unknown as Post;

        return dispatch(createPost(post, [], undefined, {keepDraft: true}));
    };
}
