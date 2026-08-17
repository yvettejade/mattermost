// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import './skip_to_content.scss';

export const MAIN_CONTENT_ID = 'main-content';

export const mainContentProps = {
    id: MAIN_CONTENT_ID,
    tabIndex: -1 as const,
};

export function resolveMainContentTarget(): HTMLElement | null {
    return (
        document.getElementById(MAIN_CONTENT_ID) ||
        document.querySelector('main') ||
        document.querySelector('.main-wrapper') ||
        document.querySelector('.admin-console__wrapper')
    );
}

const SkipToContent = () => {
    const handleActivate = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
        event.preventDefault();

        const target = resolveMainContentTarget();
        if (!target) {
            return;
        }

        if (!target.hasAttribute('tabindex')) {
            target.tabIndex = -1;
        }

        target.focus();
    }, []);

    return (
        <a
            className='SkipToContent'
            href={`#${MAIN_CONTENT_ID}`}
            onClick={handleActivate}
        >
            <FormattedMessage
                id='accessibility.skipToMainContent'
                defaultMessage='Skip to main content'
            />
        </a>
    );
};

export default SkipToContent;
