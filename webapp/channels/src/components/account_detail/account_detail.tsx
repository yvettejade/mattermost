// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';

import Header from 'components/widgets/header';

import {
    EMPTY_TRANSACTION_FILTERS,
    buildDemoTransactions,
    categoriesForAccount,
    filterTransactions,
    formatNzd,
    formatTransactionDate,
    hasActiveFilters,
    resolveDateRange,
} from './transactions';
import type {AccountId, DateRangePreset, TransactionFilters} from './types';

import './account_detail.scss';

const ACCOUNTS: Array<{id: AccountId; nameId: string; name: string; typeId: string; type: string}> = [
    {
        id: 'youmoney',
        nameId: 'account_detail.youmoney.name',
        name: 'YouMoney',
        typeId: 'account_detail.youmoney.type',
        type: 'Transaction account',
    },
    {
        id: 'rapid-save',
        nameId: 'account_detail.rapid_save.name',
        name: 'Rapid Save',
        typeId: 'account_detail.rapid_save.type',
        type: 'Savings account',
    },
];

const DATE_PRESETS: Array<{value: DateRangePreset; id: string; defaultMessage: string}> = [
    {value: '', id: 'account_detail.date.any', defaultMessage: 'Any dates'},
    {value: 'this-month', id: 'account_detail.date.this_month', defaultMessage: 'This month'},
    {value: 'last-30', id: 'account_detail.date.last_30', defaultMessage: 'Last 30 days'},
    {value: 'last-90', id: 'account_detail.date.last_90', defaultMessage: 'Last 90 days'},
    {value: 'custom', id: 'account_detail.date.custom', defaultMessage: 'Custom'},
];

function isDateRangePreset(value: string): value is DateRangePreset {
    return DATE_PRESETS.some((preset) => preset.value === value);
}

type Props = {
    now?: Date;
};

export default function AccountDetail({now = new Date()}: Props) {
    const {formatMessage} = useIntl();
    const [selectedId, setSelectedId] = useState<AccountId>('youmoney');
    const [filters, setFilters] = useState<TransactionFilters>(EMPTY_TRANSACTION_FILTERS);

    const transactions = useMemo(() => buildDemoTransactions(now), [now]);
    const selected = ACCOUNTS.find((account) => account.id === selectedId) ?? ACCOUNTS[0];
    const categories = useMemo(() => categoriesForAccount(transactions, selected.id), [selected.id, transactions]);
    const visible = useMemo(
        () => filterTransactions(transactions, selected.id, filters, now),
        [filters, now, selected.id, transactions],
    );
    const dateRange = resolveDateRange(filters, now);
    const invalidRange = dateRange.kind === 'invalid';

    const selectAccount = useCallback((id: AccountId) => {
        setSelectedId(id);
    }, []);

    const updateFilters = useCallback((patch: Partial<TransactionFilters>) => {
        setFilters((current) => ({...current, ...patch}));
    }, []);

    const handleQueryChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        updateFilters({query: event.target.value});
    }, [updateFilters]);

    const handleCategoryChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        updateFilters({category: event.target.value});
    }, [updateFilters]);

    const handleDatePresetChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        if (isDateRangePreset(event.target.value)) {
            updateFilters({datePreset: event.target.value});
        }
    }, [updateFilters]);

    const handleCustomFromChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        updateFilters({customFrom: event.target.value});
    }, [updateFilters]);

    const handleCustomToChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        updateFilters({customTo: event.target.value});
    }, [updateFilters]);

    const clearFilters = useCallback(() => {
        setFilters(EMPTY_TRANSACTION_FILTERS);
    }, []);

    return (
        <div
            id='app-content'
            className='AccountDetail app__content'
        >
            <Header
                level={2}
                className='AccountDetail__header'
                heading={
                    <FormattedMessage
                        id='account_detail.heading'
                        defaultMessage='Account'
                    />
                }
                subtitle={
                    <FormattedMessage
                        id='account_detail.subtitle'
                        defaultMessage='Review YouMoney and Rapid Save transactions'
                    />
                }
            />
            <div className='AccountDetail__main'>
                <div
                    className='AccountDetail__tabs'
                    role='tablist'
                    aria-label={formatMessage({id: 'account_detail.tabs', defaultMessage: 'Accounts'})}
                >
                    {ACCOUNTS.map((account) => {
                        const selectedTab = account.id === selectedId;
                        return (
                            <Button
                                key={account.id}
                                type='button'
                                role='tab'
                                id={`account-tab-${account.id}`}
                                aria-selected={selectedTab}
                                aria-controls={`account-panel-${account.id}`}
                                emphasis={selectedTab ? 'primary' : 'tertiary'}
                                size='sm'
                                onClick={() => selectAccount(account.id)}
                            >
                                <FormattedMessage
                                    id={account.nameId}
                                    defaultMessage={account.name}
                                />
                            </Button>
                        );
                    })}
                </div>
                <section
                    id={`account-panel-${selected.id}`}
                    role='tabpanel'
                    aria-labelledby={`account-tab-${selected.id}`}
                    className='AccountDetail__panel'
                >
                    <h3 className='AccountDetail__accountName'>
                        <FormattedMessage
                            id={selected.nameId}
                            defaultMessage={selected.name}
                        />
                    </h3>
                    <p className='AccountDetail__accountType'>
                        <FormattedMessage
                            id={selected.typeId}
                            defaultMessage={selected.type}
                        />
                    </p>
                    <div className='AccountDetail__filters'>
                        <div className='AccountDetail__field'>
                            <label
                                className='AccountDetail__label'
                                htmlFor='account-transaction-search'
                            >
                                <FormattedMessage
                                    id='account_detail.search'
                                    defaultMessage='Search'
                                />
                            </label>
                            <input
                                id='account-transaction-search'
                                type='search'
                                value={filters.query}
                                onChange={handleQueryChange}
                            />
                        </div>
                        <div className='AccountDetail__field'>
                            <label
                                className='AccountDetail__label'
                                htmlFor='account-transaction-category'
                            >
                                <FormattedMessage
                                    id='account_detail.category'
                                    defaultMessage='Category'
                                />
                            </label>
                            <select
                                id='account-transaction-category'
                                value={filters.category}
                                onChange={handleCategoryChange}
                            >
                                <option value=''>
                                    {formatMessage({id: 'account_detail.category.all', defaultMessage: 'All categories'})}
                                </option>
                                {categories.map((category) => (
                                    <option
                                        key={category}
                                        value={category}
                                    >
                                        {category}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className='AccountDetail__field'>
                            <label
                                className='AccountDetail__label'
                                htmlFor='account-transaction-date-range'
                            >
                                <FormattedMessage
                                    id='account_detail.date.range'
                                    defaultMessage='Date range'
                                />
                            </label>
                            <select
                                id='account-transaction-date-range'
                                value={filters.datePreset}
                                onChange={handleDatePresetChange}
                            >
                                {DATE_PRESETS.map((preset) => (
                                    <option
                                        key={preset.value || 'any'}
                                        value={preset.value}
                                    >
                                        {formatMessage({id: preset.id, defaultMessage: preset.defaultMessage})}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {filters.datePreset === 'custom' && (
                            <>
                                <div className='AccountDetail__field'>
                                    <label
                                        className='AccountDetail__label'
                                        htmlFor='account-transaction-date-from'
                                    >
                                        <FormattedMessage
                                            id='account_detail.date.from'
                                            defaultMessage='From'
                                        />
                                    </label>
                                    <input
                                        id='account-transaction-date-from'
                                        type='date'
                                        value={filters.customFrom}
                                        onChange={handleCustomFromChange}
                                        aria-invalid={invalidRange}
                                        aria-describedby={invalidRange ? 'account-transaction-date-error' : undefined}
                                    />
                                </div>
                                <div className='AccountDetail__field'>
                                    <label
                                        className='AccountDetail__label'
                                        htmlFor='account-transaction-date-to'
                                    >
                                        <FormattedMessage
                                            id='account_detail.date.to'
                                            defaultMessage='To'
                                        />
                                    </label>
                                    <input
                                        id='account-transaction-date-to'
                                        type='date'
                                        value={filters.customTo}
                                        onChange={handleCustomToChange}
                                        aria-invalid={invalidRange}
                                        aria-describedby={invalidRange ? 'account-transaction-date-error' : undefined}
                                    />
                                </div>
                            </>
                        )}
                        {hasActiveFilters(filters) && (
                            <Button
                                type='button'
                                emphasis='tertiary'
                                size='sm'
                                onClick={clearFilters}
                            >
                                <FormattedMessage
                                    id='account_detail.clear'
                                    defaultMessage='Clear filters'
                                />
                            </Button>
                        )}
                    </div>
                    {invalidRange && (
                        <p
                            id='account-transaction-date-error'
                            className='AccountDetail__error'
                            role='alert'
                        >
                            <FormattedMessage
                                id='account_detail.date.invalid'
                                defaultMessage='From date must be on or before the to date.'
                            />
                        </p>
                    )}
                    <p
                        className='AccountDetail__count'
                        aria-live='polite'
                    >
                        <FormattedMessage
                            id='account_detail.result_count'
                            defaultMessage='{count, plural, one {# transaction} other {# transactions}}'
                            values={{count: visible.length}}
                        />
                    </p>
                    {visible.length === 0 ? (
                        <p className='AccountDetail__empty'>
                            <FormattedMessage
                                id='account_detail.empty'
                                defaultMessage='No transactions match these filters.'
                            />
                        </p>
                    ) : (
                        <ul className='AccountDetail__list'>
                            {visible.map((transaction) => (
                                <li
                                    key={transaction.id}
                                    className='AccountDetail__row'
                                >
                                    <div>
                                        <p className='AccountDetail__description'>{transaction.description}</p>
                                        <p className='AccountDetail__meta'>
                                            <FormattedMessage
                                                id='account_detail.meta'
                                                defaultMessage='{date} · {category}'
                                                values={{
                                                    date: formatTransactionDate(transaction.date),
                                                    category: transaction.category,
                                                }}
                                            />
                                        </p>
                                    </div>
                                    <p className='AccountDetail__amount'>{formatNzd(transaction.amount)}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    );
}
