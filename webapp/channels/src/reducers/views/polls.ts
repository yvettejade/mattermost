// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import type {PollResults} from '@mattermost/types/polls';

import {UserTypes} from 'mattermost-redux/action_types';

import {ActionTypes} from 'utils/constants';

import type {MMAction} from 'types/store';

function resultsByPostId(state: Record<string, PollResults> = {}, action: MMAction): Record<string, PollResults> {
    switch (action.type) {
    case ActionTypes.RECEIVED_POLL_RESULTS: {
        const results: PollResults = action.data;
        return {
            ...state,
            [results.post_id]: results,
        };
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export default combineReducers({
    resultsByPostId,
});
