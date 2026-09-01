// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ConnectedProps} from 'react-redux';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {AnyAction, Dispatch} from 'redux';

import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/common';

import {
    closeRightHandSide,
    toggleRhsExpanded,
    goBack,
} from 'actions/views/rhs';
import {canGoBackFromChannelInfoRhs, getIsRhsExpanded, getPreviousRhsState} from 'selectors/rhs';

import type {GlobalState} from 'types/store/index.js';

import SearchResultsHeader from './search_results_header';

function mapStateToProps(state: GlobalState) {
    const previousRhsState = getPreviousRhsState(state);
    const canGoBack = canGoBackFromChannelInfoRhs(state);

    return {
        isExpanded: getIsRhsExpanded(state),
        channelId: getCurrentChannelId(state),
        previousRhsState,
        canGoBack,
    };
}

function mapDispatchToProps(dispatch: Dispatch<AnyAction>) {
    return {
        actions: bindActionCreators({
            closeRightHandSide,
            toggleRhsExpanded,
            goBack,
        }, dispatch),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(SearchResultsHeader);
