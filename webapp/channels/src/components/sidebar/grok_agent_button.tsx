// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl, FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import GrokAgentModal from 'components/grok_agent_modal';
import ToggleModalButton from 'components/toggle_modal_button';

import {ModalIdentifiers} from 'utils/constants';

type Props = {
    className?: string;
};

const GrokAgentButton = (props: Props): JSX.Element | null => {
    const intl = useIntl();
    const currentTeamId = useSelector(getCurrentTeamId);

    if (!currentTeamId) {
        return null;
    }

    return (
        <ToggleModalButton
            ariaLabel={intl.formatMessage({id: 'sidebar_left.grokAgent', defaultMessage: 'Grok'})}
            id='grokAgentButton'
            className={`intro-links color--link cursor--pointer${props.className ? ` ${props.className}` : ''}`}
            modalId={ModalIdentifiers.GROK_AGENT}
            dialogType={GrokAgentModal}
        >
            <div
                className='SidebarChannelNavigator__grokAgentLhsButton'
                data-testid='grokAgentLhsButton'
                aria-label={intl.formatMessage({id: 'sidebar_left.grokAgent.open', defaultMessage: 'Open Grok'})}
            >
                <i
                    className='icon-creation-outline'
                    aria-hidden='true'
                />
                <FormattedMessage
                    id='sidebar_left.grokAgent'
                    defaultMessage='Grok'
                />
            </div>
        </ToggleModalButton>
    );
};

export default GrokAgentButton;
