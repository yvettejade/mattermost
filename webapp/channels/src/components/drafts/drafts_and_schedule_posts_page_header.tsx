// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import type {ReactNode} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import {Button} from '@mattermost/shared/components/button';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import Header from 'components/widgets/header';

import {EXPORT_MONITOR_URL_SUFFIX} from 'utils/constants';

type Props = {
    children: ReactNode;
}

export default function DraftsAndSchedulePostsPageHeader(props: Props) {
    const history = useHistory();
    const currentTeam = useSelector(getCurrentTeam);
    const currentTeamName = currentTeam?.name ?? '';

    const handleOpenExportMonitor = useCallback(() => {
        if (!currentTeamName) {
            return;
        }
        history.push(`/${currentTeamName}/${EXPORT_MONITOR_URL_SUFFIX}`);
    }, [currentTeamName, history]);

    return (
        <div
            id='app-content'
            className='Drafts app__content'
        >
            <Header
                level={2}
                className='Drafts__header'
                heading={
                    <FormattedMessage
                        id='drafts.heading'
                        defaultMessage='Drafts'
                    />
                }
                subtitle={
                    <FormattedMessage
                        id='drafts.subtitle'
                        defaultMessage="Any messages you've started will show here"
                    />
                }
                right={
                    <div className='Drafts__headerActions'>
                        <Button
                            emphasis='tertiary'
                            onClick={handleOpenExportMonitor}
                        >
                            <FormattedMessage
                                id='drafts.exportMonitor'
                                defaultMessage='Export monitor'
                            />
                        </Button>
                    </div>
                }
            />
            {props.children}
        </div>
    );
}
