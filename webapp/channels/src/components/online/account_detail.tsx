// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useParams} from 'react-router-dom';

import {Button} from '@mattermost/shared/components/button';

import {
    filterTransactions,
    findAccount,
    formatAudFromCents,
    scheduledTransactions,
    transactionsToCsv,
} from './store';
import type {EverydayMoneyState} from './types';

type Props = {
    state: EverydayMoneyState;
};

export default function AccountDetail({state}: Props) {
    const {formatMessage} = useIntl();
    const {accountId} = useParams<{accountId: string}>();
    const [query, setQuery] = useState('');
    const account = findAccount(state.accounts, accountId ?? '');

    const activity = useMemo(() => {
        if (!account) {
            return [];
        }
        return filterTransactions(state.transactions, account.id, query);
    }, [account, query, state.transactions]);

    const scheduled = useMemo(() => {
        if (!account) {
            return [];
        }
        return scheduledTransactions(state.transactions, account.id);
    }, [account, state.transactions]);

    const handleSearch = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(event.target.value);
    }, []);

    const handleExport = useCallback(() => {
        const csv = transactionsToCsv(activity);
        const blob = new Blob([csv], {type: 'text/csv'});
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${account?.id ?? 'account'}-activity.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }, [account, activity]);

    if (!account) {
        return (
            <p className='Online__muted'>
                <FormattedMessage
                    id='online.account.not_found'
                    defaultMessage='That account is not available.'
                />
            </p>
        );
    }

    return (
        <>
            <section aria-labelledby='online-account-detail-heading'>
                <h3
                    id='online-account-detail-heading'
                    className='Online__sectionTitle'
                >
                    <FormattedMessage
                        id={account.nameId}
                        defaultMessage={account.name}
                    />
                </h3>
                <p className='Online__accountNumber'>{account.number}</p>
                <p
                    className='Online__accountAvailable'
                    data-testid='online-account-available'
                >
                    {formatAudFromCents(account.availableCents)}
                </p>
            </section>
            <section aria-labelledby='online-account-activity-heading'>
                <h3
                    id='online-account-activity-heading'
                    className='Online__sectionTitle'
                >
                    <FormattedMessage
                        id='online.detail.transactions'
                        defaultMessage='Activity'
                    />
                </h3>
                <div className='Online__toolbar'>
                    <input
                        className='Online__search'
                        type='search'
                        value={query}
                        onChange={handleSearch}
                        placeholder={formatMessage({
                            id: 'online.detail.search',
                            defaultMessage: 'Search activity',
                        })}
                        aria-label={formatMessage({
                            id: 'online.detail.search',
                            defaultMessage: 'Search activity',
                        })}
                    />
                    <Button
                        type='button'
                        emphasis='tertiary'
                        onClick={handleExport}
                    >
                        <FormattedMessage
                            id='online.detail.export'
                            defaultMessage='Export'
                        />
                    </Button>
                </div>
                {activity.length === 0 ? (
                    <p className='Online__muted'>
                        <FormattedMessage
                            id='online.detail.search.empty'
                            defaultMessage='No activity matches that search.'
                        />
                    </p>
                ) : (
                    <ul
                        className='Online__list'
                        data-testid='online-activity'
                    >
                        {activity.map((transaction) => (
                            <li
                                key={transaction.id}
                                className='Online__row'
                            >
                                <div>
                                    <p className='Online__accountName'>{transaction.description}</p>
                                    <p className='Online__muted'>{transaction.date}</p>
                                </div>
                                <p>{formatAudFromCents(transaction.amountCents)}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
            <section aria-labelledby='online-account-scheduled-heading'>
                <h3
                    id='online-account-scheduled-heading'
                    className='Online__sectionTitle'
                >
                    <FormattedMessage
                        id='online.detail.scheduled'
                        defaultMessage='Scheduled activity'
                    />
                </h3>
                {scheduled.length === 0 ? (
                    <p className='Online__muted'>
                        <FormattedMessage
                            id='online.detail.scheduled.empty'
                            defaultMessage='No scheduled activity.'
                        />
                    </p>
                ) : (
                    <ul
                        className='Online__list'
                        data-testid='online-scheduled'
                    >
                        {scheduled.map((transaction) => (
                            <li
                                key={transaction.id}
                                className='Online__row'
                            >
                                <div>
                                    <p className='Online__accountName'>{transaction.description}</p>
                                    <p className='Online__muted'>{transaction.date}</p>
                                </div>
                                <p>{formatAudFromCents(transaction.amountCents)}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </>
    );
}
