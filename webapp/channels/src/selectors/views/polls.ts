// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PollResults} from '@mattermost/types/polls';

import type {GlobalState} from 'types/store';

export function getPollResults(state: GlobalState, postId: string): PollResults | undefined {
    return state.views.polls.resultsByPostId[postId];
}
