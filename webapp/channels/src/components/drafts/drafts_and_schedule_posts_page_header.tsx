// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import type {ReactNode} from 'react';
import {FormattedMessage} from 'react-intl';
import {useHistory, useRouteMatch} from 'react-router-dom';

import {Button} from '@mattermost/shared/components/button';

import Header from 'components/widgets/header';

import {ONLINE_URL_SUFFIX} from 'utils/constants';

type Props = {
    children: ReactNode;
}

export default function DraftsAndSchedulePostsPageHeader(props: Props) {
    const history = useHistory();
    const match = useRouteMatch<{team: string}>('/:team');

    const openEverydayMoney = useCallback(() => {
        if (!match?.params.team) {
            return;
        }

        history.push(`/${match.params.team}/${ONLINE_URL_SUFFIX}/accounts/everyday`);
    }, [history, match?.params.team]);

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
                        emphasis='tertiary'
                        size='sm'
                        onClick={openEverydayMoney}
                    >
                        <FormattedMessage
                            id='drafts.everydayMoney'
                            defaultMessage='Everyday money'
                        />
                    </Button>
                }
            />
            {props.children}
        </div>
    );
}
