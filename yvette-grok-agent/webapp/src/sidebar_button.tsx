import React from 'react';

import {openChatModal} from './modal_state';

export const ASK_GROK_LABEL = 'Ask Grok';

export default function SidebarButton(): JSX.Element {
    return (
        <button
            type='button'
            id='yvetteGrokAskButton'
            className='intro-links color--link cursor--pointer followingSibling YvetteGrok__lhsButton'
            onClick={openChatModal}
        >
            <div className='SidebarChannelNavigator__inviteMembersLhsButton'>
                <i
                    className='icon-message-text-outline'
                    aria-hidden='true'
                />
                <span>{ASK_GROK_LABEL}</span>
            </div>
        </button>
    );
}
