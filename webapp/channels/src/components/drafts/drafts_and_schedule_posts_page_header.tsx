// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import type {ReactNode} from 'react';
import {FormattedMessage} from 'react-intl';
import {useHistory, useParams} from 'react-router-dom';

import {Button} from '@mattermost/shared/components/button';

import Header from 'components/widgets/header';

import {TEMPLATES_URL_SUFFIX} from 'utils/constants';

type Props = {
    children: ReactNode;
}

export default function DraftsAndSchedulePostsPageHeader(props: Props) {
    const history = useHistory();
    const {team: teamName} = useParams<{team: string}>();

    const handleOpenTemplates = useCallback(() => {
        if (!teamName) {
            return;
        }
        history.push(`/${teamName}/${TEMPLATES_URL_SUFFIX}`);
    }, [history, teamName]);

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
                    <Button
                        type='button'
                        id='templatesButton'
                        emphasis='tertiary'
                        size='sm'
                        onClick={handleOpenTemplates}
                        disabled={!teamName}
                    >
                        <FormattedMessage
                            id='drafts.templates'
                            defaultMessage='Templates'
                        />
                    </Button>
                }
            />
            {props.children}
        </div>
    );
}
