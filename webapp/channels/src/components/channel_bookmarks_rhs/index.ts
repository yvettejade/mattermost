// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {AnyAction, Dispatch} from 'redux';

import type {Channel} from '@mattermost/types/channels';

import {getCurrentChannel, isCurrentChannelArchived} from 'mattermost-redux/selectors/entities/channels';

import {closeRightHandSide, goBack} from 'actions/views/rhs';
import {getPreviousRhsState} from 'selectors/rhs';

import {RHSStates} from 'utils/constants';

import type {GlobalState} from 'types/store';

import ChannelBookmarksRHS from './channel_bookmarks_rhs';
import type {Props} from './channel_bookmarks_rhs';

function mapStateToProps(state: GlobalState) {
    const channel = getCurrentChannel(state);

    if (!channel) {
        return {
            channel: {} as Channel,
            isArchived: false,
            canGoBack: false,
        } as Props;
    }

    const prevRhsState = getPreviousRhsState(state);
    const hasInfoPrevState = prevRhsState === RHSStates.CHANNEL_INFO ||
        prevRhsState === RHSStates.CHANNEL_FILES ||
        prevRhsState === RHSStates.CHANNEL_MEMBERS ||
        prevRhsState === RHSStates.PIN;

    return {
        channel,
        isArchived: isCurrentChannelArchived(state),
        canGoBack: Boolean(hasInfoPrevState),
    } as Props;
}

function mapDispatchToProps(dispatch: Dispatch<AnyAction>) {
    return {
        actions: bindActionCreators({
            closeRightHandSide,
            goBack,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ChannelBookmarksRHS);
