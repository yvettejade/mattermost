// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {Channel} from '@mattermost/types/channels';

import {patchChannel} from 'mattermost-redux/actions/channels';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';

import {setShowPreviewOnEditChannelHeaderModal} from 'actions/views/textbox';
import {showPreviewOnEditChannelHeaderModal} from 'selectors/views/textbox';

import {canEditChannelHeader} from 'utils/channel_utils';
import Constants from 'utils/constants';

import type {GlobalState} from 'types/store';

import EditChannelHeaderModal from './edit_channel_header_modal';

type OwnProps = {
    channel: Channel;
};

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    return {
        ctrlSend: getBool(state, Constants.Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter'),
        canEdit: canEditChannelHeader(state, ownProps.channel),
        shouldShowPreview: showPreviewOnEditChannelHeaderModal(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            patchChannel,
            setShowPreviewOnEditChannelHeaderModal,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(EditChannelHeaderModal);
