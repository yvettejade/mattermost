// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {ONLINE_URL_SUFFIX} from 'utils/constants';

import {formatAudFromCents, overallPositionCents} from './store';
import type {EverydayMoneyState} from './types';

type Props = {
    state: EverydayMoneyState;
};

export default function Overview({state}: Props) {
    const history = useHistory();
    const currentTeam = useSelector(getCurrentTeam);
    const currentTeamName = currentTeam?.name ?? '';

    const openAccount = useCallback((accountId: string) => {
        if (!currentTeamName) {
            return;
        }
        history.push(`/${currentTeamName}/${ONLINE_URL_SUFFIX}/accounts/${accountId}`);
    }, [currentTeamName, history]);

    return (
        <>
            <section
                className='Online__position'
                aria-labelledby='online-position-heading'
            >
                <h3
                    id='online-position-heading'
                    className='Online__positionLabel'
                >
                    <FormattedMessage
                        id='online.overview.position.label'
                        defaultMessage='Overall position'
                    />
                </h3>
                <p
                    className='Online__positionValue'
                    data-testid='online-position'
                >
                    {state.settings.hideBalances ? (
                        <FormattedMessage
                            id='online.overview.hidden'
                            defaultMessage='Hidden'
                        />
                    ) : formatAudFromCents(overallPositionCents(state.accounts))}
                </p>
            </section>
            <section aria-labelledby='online-accounts-heading'>
                <h3
                    id='online-accounts-heading'
                    className='Online__sectionTitle'
                >
                    <FormattedMessage
                        id='online.accounts.heading'
                        defaultMessage='Accounts'
                    />
                </h3>
                <ul
                    className='Online__accounts'
                    data-testid='online-accounts'
                >
                    {state.accounts.map((account) => (
                        <li key={account.id}>
                            <button
                                type='button'
                                className='Online__account'
                                data-testid='online-account'
                                onClick={() => openAccount(account.id)}
                            >
                                <div>
                                    <h4 className='Online__accountName'>
                                        <FormattedMessage
                                            id={account.nameId}
                                            defaultMessage={account.name}
                                        />
                                    </h4>
                                    <p className='Online__accountNumber'>{account.number}</p>
                                </div>
                                <p className='Online__accountAvailable'>
                                    <span className='Online__muted'>
                                        <FormattedMessage
                                            id='online.account.available'
                                            defaultMessage='Available'
                                        />
                                    </span>
                                    {state.settings.hideBalances ? (
                                        <FormattedMessage
                                            id='online.overview.hidden'
                                            defaultMessage='Hidden'
                                        />
                                    ) : formatAudFromCents(account.availableCents)}
                                </p>
                            </button>
                        </li>
                    ))}
                </ul>
            </section>
        </>
    );
}
