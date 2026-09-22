// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useParams} from 'react-router-dom';

import {mainContentProps} from 'components/skip_to_content/skip_to_content';

import HelpAttaching from './attaching';
import HelpCommands from './commands';
import HelpFormatting from './formatting';
import HelpMentioning from './mentioning';
import HelpMessaging from './messaging';
import HelpSending from './sending';

type HelpPage = 'messaging' | 'sending' | 'mentioning' | 'formatting' | 'attaching' | 'commands';

const Help = (): JSX.Element => {
    const {page} = useParams<{page?: string}>();

    // Default to messaging (the landing page)
    const currentPage = (page || 'messaging') as HelpPage;

    // Scroll to top when page changes
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [currentPage]);

    let pageContent: JSX.Element;
    switch (currentPage) {
    case 'sending':
        pageContent = <HelpSending/>;
        break;
    case 'mentioning':
        pageContent = <HelpMentioning/>;
        break;
    case 'formatting':
        pageContent = <HelpFormatting/>;
        break;
    case 'attaching':
        pageContent = <HelpAttaching/>;
        break;
    case 'commands':
        pageContent = <HelpCommands/>;
        break;
    case 'messaging':
    default:
        pageContent = <HelpMessaging/>;
        break;
    }

    return (
        <main {...mainContentProps}>
            {pageContent}
        </main>
    );
};

export default Help;

