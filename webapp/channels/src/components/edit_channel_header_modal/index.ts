// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {patchChannel} from 'mattermost-redux/actions/channels';

import {setShowPreviewOnEditChannelHeaderModal} from 'actions/views/textbox';
import {showPreviewOnEditChannelHeaderModal} from 'selectors/views/textbox';

import type {GlobalState} from 'types/store';

import EditChannelHeaderModal from './edit_channel_header_modal';

function mapStateToProps(state: GlobalState) {
    return {
        showPreview: showPreviewOnEditChannelHeaderModal(state),
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
