// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionTypes} from 'utils/constants';

import type {ThunkActionFunc} from 'types/store';

export function incrementWsErrorCount(): ThunkActionFunc<Promise<void>> {
    return async (dispatch) => {
        dispatch({
            type: ActionTypes.INCREMENT_WS_ERROR_COUNT,
        });
    };
}

export function resetWsErrorCount(): ThunkActionFunc<Promise<void>> {
    return async (dispatch) => {
        dispatch({
            type: ActionTypes.RESET_WS_ERROR_COUNT,
        });
    };
}
