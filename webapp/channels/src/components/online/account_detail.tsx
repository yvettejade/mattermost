// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useParams} from 'react-router-dom';

import {Button} from '@mattermost/shared/components/button';

import {
    accountCategories,
    csvFileName,
    downloadCsv,
    filterTransactions,
    findAccount,
    formatSignedAmount,
    transactionsToCsv,
} from './store';
import type {Account, Transaction} from './types';

type Props = {
    accounts: Account[];
    transactions: Transaction[];
    now?: Date;
};

export default function AccountDetail({accounts, transactions, now = new Date()}: Props) {
    const {formatMessage} = useIntl();
    const {accountId} = useParams<{accountId: string}>();
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('');
    const account = findAccount(accounts, accountId ?? '');

    const categories = useMemo(() => {
        if (!account) {
            return [];
        }
        return accountCategories(transactions, account.id);
    }, [account, transactions]);

    const activity = useMemo(() => {
        if (!account) {
            return [];
        }
        return filterTransactions(transactions, account.id, {query, category});
    }, [account, category, query, transactions]);

    const handleSearch = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(event.target.value);
    }, []);

    const handleCategory = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        setCategory(event.target.value);
    }, []);

    const handleExport = useCallback(() => {
        if (!account || activity.length === 0) {
            return;
        }
        downloadCsv(transactionsToCsv(activity), csvFileName(account.name, now));
    }, [account, activity, now]);

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
            </section>
            <section aria-labelledby='online-account-activity-heading'>
                <h3
                    id='online-account-activity-heading'
                    className='Online__sectionTitle'
                >
                    <FormattedMessage
                        id='online.detail.transactions'
                        defaultMessage='Transactions'
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
                            defaultMessage: 'Search transactions',
                        })}
                        aria-label={formatMessage({
                            id: 'online.detail.search',
                            defaultMessage: 'Search transactions',
                        })}
                    />
                    <label
                        className='Online__category'
                        htmlFor='online-category-filter'
                    >
                        <span className='Online__label'>
                            <FormattedMessage
                                id='online.detail.category'
                                defaultMessage='Category'
                            />
                        </span>
                        <select
                            id='online-category-filter'
                            value={category}
                            onChange={handleCategory}
                        >
                            <option value=''>
                                {formatMessage({
                                    id: 'online.detail.category.all',
                                    defaultMessage: 'All categories',
                                })}
                            </option>
                            {categories.map((item) => (
                                <option
                                    key={item}
                                    value={item}
                                >
                                    {item}
                                </option>
                            ))}
                        </select>
                    </label>
                    <Button
                        type='button'
                        emphasis='tertiary'
                        disabled={activity.length === 0}
                        onClick={handleExport}
                    >
                        <FormattedMessage
                            id='online.detail.export'
                            defaultMessage='Export CSV'
                        />
                    </Button>
                </div>
                {activity.length === 0 ? (
                    <p className='Online__muted'>
                        <FormattedMessage
                            id='online.detail.empty'
                            defaultMessage='There is nothing to export.'
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
                                    <p className='Online__muted'>
                                        {`${transaction.date} · ${transaction.merchant} · ${transaction.category}`}
                                    </p>
                                </div>
                                <p data-testid='online-amount'>{formatSignedAmount(transaction.amountCents)}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </>
    );
}
