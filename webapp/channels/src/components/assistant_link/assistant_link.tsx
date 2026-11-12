// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {RobotHappyIcon} from '@mattermost/compass-icons/components';

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {openModal} from 'actions/views/modals';
import {isModalOpen} from 'selectors/views/modals';

import AssistantModal from 'components/assistant_modal';

import {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

import './assistant_link.scss';

const AssistantLink = () => {
    const dispatch = useDispatch();
    const currentTeamId = useSelector(getCurrentTeamId);
    const isOpen = useSelector((state: GlobalState) => isModalOpen(state, ModalIdentifiers.ASSISTANT_MODAL));

    const handleClick = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.ASSISTANT_MODAL,
            dialogType: AssistantModal,
        }));
    }, [dispatch]);

    if (!currentTeamId) {
        return null;
    }

    return (
        <ul className='SidebarAssistant NavGroupContent nav nav-pills__container'>
            <li
                className='SidebarChannel'
                tabIndex={-1}
            >
                <button
                    type='button'
                    id='sidebarItem_assistant'
                    className='SidebarLink sidebar-item SidebarAssistant__button'
                    onClick={handleClick}
                    aria-haspopup='dialog'
                    aria-expanded={isOpen}
                >
                    <span className='icon'>
                        <RobotHappyIcon size={18}/>
                    </span>
                    <span className='SidebarChannelLinkLabel_wrapper'>
                        <span className='SidebarChannelLinkLabel sidebar-item__name'>
                            <FormattedMessage
                                id='assistant.sidebarLink'
                                defaultMessage='Ask Assistant'
                            />
                        </span>
                    </span>
                </button>
            </li>
        </ul>
    );
};

export default AssistantLink;
