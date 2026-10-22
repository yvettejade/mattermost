// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {ChartBarIcon} from '@mattermost/compass-icons/components';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {openModal} from 'actions/views/modals';

import {IconContainer} from 'components/advanced_text_editor/formatting_bar/formatting_icon';

import {ModalIdentifiers} from 'utils/constants';

import PollCreateModal from './poll_create_modal';

type Props = {
    channelId: string;
    rootId: string;
    disabled: boolean;
};

const PollButton = ({channelId, rootId, disabled}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const handleClick = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.POLL_CREATE,
            dialogType: PollCreateModal,
            dialogProps: {channelId, rootId},
        }));
    }, [dispatch, channelId, rootId]);

    return (
        <WithTooltip
            title={formatMessage({id: 'poll.button.tooltip', defaultMessage: 'Create a poll'})}
        >
            <IconContainer
                id='pollButton'
                className='control'
                type='button'
                disabled={disabled}
                aria-label={formatMessage({id: 'poll.button.aria', defaultMessage: 'create a poll'})}
                onClick={handleClick}
            >
                <ChartBarIcon
                    size={18}
                    color='currentColor'
                />
            </IconContainer>
        </WithTooltip>
    );
};

export default memo(PollButton);
