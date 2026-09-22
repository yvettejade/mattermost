// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {FormattedMessage} from 'react-intl';

import {buildDemoTransactions, formatNzd, summarizeThisMonthSpend} from './transactions';
import type {AccountKind, DemoTransaction} from './types';

import './this_month_spend_panel.scss';

type Props = {
    accountKind: AccountKind;
    now?: Date;
    transactions?: DemoTransaction[];
};

export default function ThisMonthSpendPanel({accountKind, now, transactions}: Props) {
    const summary = useMemo(() => {
        const source = transactions ?? buildDemoTransactions(now);
        return summarizeThisMonthSpend(source, accountKind, now);
    }, [accountKind, now, transactions]);

    return (
        <section
            className='ThisMonthSpendPanel'
            aria-labelledby={`this-month-spend-heading-${accountKind}`}
        >
            <h3
                id={`this-month-spend-heading-${accountKind}`}
                className='ThisMonthSpendPanel__heading'
            >
                <FormattedMessage
                    id='account_detail.spend.title'
                    defaultMessage='This month'
                />
            </h3>
            {summary.spend.length === 0 ? (
                <p className='ThisMonthSpendPanel__empty'>
                    <FormattedMessage
                        id='account_detail.spend.empty'
                        defaultMessage='No spend this month.'
                    />
                </p>
            ) : (
                <table className='ThisMonthSpendPanel__table'>
                    <caption className='ThisMonthSpendPanel__caption'>
                        <FormattedMessage
                            id='account_detail.spend.caption'
                            defaultMessage='This month spend by category'
                        />
                    </caption>
                    <thead>
                        <tr>
                            <th scope='col'>
                                <FormattedMessage
                                    id='account_detail.spend.category'
                                    defaultMessage='Category'
                                />
                            </th>
                            <th scope='col'>
                                <FormattedMessage
                                    id='account_detail.spend.amount'
                                    defaultMessage='Amount'
                                />
                            </th>
                            <th scope='col'>
                                <FormattedMessage
                                    id='account_detail.spend.share'
                                    defaultMessage='Share'
                                />
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {summary.spend.map((row) => (
                            <tr key={row.category}>
                                <th scope='row'>{row.category}</th>
                                <td>{formatNzd(row.amount)}</td>
                                <td>
                                    <div className='ThisMonthSpendPanel__share'>
                                        <div
                                            className='ThisMonthSpendPanel__bar'
                                            role='meter'
                                            aria-valuemin={0}
                                            aria-valuemax={100}
                                            aria-valuenow={row.percent}
                                            aria-label={`${row.category} ${row.percent}%`}
                                        >
                                            <span
                                                className='ThisMonthSpendPanel__barFill'
                                                style={{width: `${row.percent}%`}}
                                            />
                                        </div>
                                        <span className='ThisMonthSpendPanel__percent'>{`${row.percent}%`}</span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <th scope='row'>
                                <FormattedMessage
                                    id='account_detail.spend.total'
                                    defaultMessage='Total'
                                />
                            </th>
                            <td>{formatNzd(summary.spendTotal)}</td>
                            <td>{'100%'}</td>
                        </tr>
                    </tfoot>
                </table>
            )}
            {summary.other.length > 0 && (
                <div className='ThisMonthSpendPanel__other'>
                    <h4 className='ThisMonthSpendPanel__otherHeading'>
                        <FormattedMessage
                            id='account_detail.other.title'
                            defaultMessage='Income and transfers'
                        />
                    </h4>
                    <ul className='ThisMonthSpendPanel__otherList'>
                        {summary.other.map((row) => (
                            <li key={row.kind}>
                                <FormattedMessage
                                    id='account_detail.other.row'
                                    defaultMessage='{kind}: {amount}'
                                    values={{
                                        kind: row.kind === 'income' ? (
                                            <FormattedMessage
                                                id='account_detail.other.income'
                                                defaultMessage='Income'
                                            />
                                        ) : (
                                            <FormattedMessage
                                                id='account_detail.other.transfers'
                                                defaultMessage='Transfers'
                                            />
                                        ),
                                        amount: formatNzd(row.amount),
                                    }}
                                />
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}
