import React from 'react';
import {useSelector} from 'react-redux';

import {openGrokModal} from './modal_state';

type RootState = {
    entities?: {
        teams?: {
            currentTeamId?: string;
        };
    };
};

export default function GrokSidebarButton() {
    const teamId = useSelector((state: RootState) => state.entities?.teams?.currentTeamId);
    if (!teamId) {
        return null;
    }

    return (
        <button
            type='button'
            id='grokAgentButton'
            data-testid='grokAgentLhsButton'
            className='intro-links color--link cursor--pointer followingSibling'
            aria-label='Open Grok'
            onClick={openGrokModal}
        >
            <div className='SidebarChannelNavigator__grokAgentLhsButton'>
                <i
                    className='icon-creation-outline'
                    aria-hidden='true'
                />
                <span>{'Grok'}</span>
            </div>
        </button>
    );
}
