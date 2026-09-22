// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {FormattedMessage, FormattedNumber} from 'react-intl';
import {Link, useHistory} from 'react-router-dom';

import {PAY_ANYONE_CURRENCY, PAY_FROM_ACCOUNTS, scheduledItems} from './payments';

type Props = {
    baseUrl: string;
};

export default function Overview({baseUrl}: Props) {
    const history = useHistory();
    const scheduled = useMemo(() => scheduledItems(), []);

    return (
        <>
            <ul
                className='Online__tiles'
                data-testid='online-overview'
            >
                <li>
                    <Link
                        className='Online__tile'
                        to={`${baseUrl}/cards`}
                    >
                        <h3 className='Online__sectionTitle'>
                            <FormattedMessage
                                id='online.overview.cards'
                                defaultMessage='Cards'
                            />
                        </h3>
                        <p className='Online__muted'>
                            <FormattedMessage
                                id='online.overview.cards.help'
                                defaultMessage='Lock a missing card in one tap'
                            />
                        </p>
                    </Link>
                </li>
                <li>
                    <Link
                        className='Online__tile'
                        to={`${baseUrl}/pay`}
                    >
                        <h3 className='Online__sectionTitle'>
                            <FormattedMessage
                                id='online.overview.pay'
                                defaultMessage='Pay anyone'
                            />
                        </h3>
                        <p className='Online__muted'>
                            <FormattedMessage
                                id='online.overview.pay.help'
                                defaultMessage='New payees, scheduled payments, and a scam warning before money moves'
                            />
                        </p>
                    </Link>
                </li>
                <li>
                    <Link
                        className='Online__tile'
                        to={`${baseUrl}/transfer`}
                    >
                        <h3 className='Online__sectionTitle'>
                            <FormattedMessage
                                id='online.overview.transfer'
                                defaultMessage='Transfer'
                            />
                        </h3>
                        <p className='Online__muted'>
                            <FormattedMessage
                                id='online.overview.transfer.help'
                                defaultMessage='Move money between your own accounts after review'
                            />
                        </p>
                    </Link>
                </li>
                <li>
                    <button
                        type='button'
                        className='Online__tile'
                        onClick={() => history.push('/international')}
                    >
                        <h3 className='Online__sectionTitle'>
                            <FormattedMessage
                                id='online.overview.international'
                                defaultMessage='International'
                            />
                        </h3>
                        <p className='Online__muted'>
                            <FormattedMessage
                                id='online.overview.international.help'
                                defaultMessage='Indicative FX quote before you log on'
                            />
                        </p>
                    </button>
                </li>
            </ul>
            <section
                className='Online__scheduled'
                data-testid='online-scheduled'
            >
                <h3 className='Online__sectionTitle'>
                    <FormattedMessage
                        id='online.overview.scheduled'
                        defaultMessage='Scheduled payments'
                    />
                </h3>
                {scheduled.length === 0 ? (
                    <p className='Online__muted'>
                        <FormattedMessage
                            id='online.overview.scheduled.empty'
                            defaultMessage='No scheduled payments yet. Choose a future date when you pay anyone or transfer.'
                        />
                    </p>
                ) : (
                    <ul className='Online__list'>
                        {scheduled.map((entry) => {
                            if (entry.kind === 'payment') {
                                return (
                                    <li
                                        key={entry.item.id}
                                        className='Online__row'
                                    >
                                        <span>
                                            {entry.item.payeeName}
                                        </span>
                                        <span>
                                            <FormattedNumber
                                                value={entry.item.amount}

                                                // eslint-disable-next-line react/style-prop-object
                                                style='currency'
                                                currency={PAY_ANYONE_CURRENCY}
                                            />
                                            {' · '}
                                            {entry.item.when}
                                        </span>
                                    </li>
                                );
                            }

                            const fromAccount = PAY_FROM_ACCOUNTS.find((account) => account.id === entry.item.fromAccountId);
                            const toAccount = PAY_FROM_ACCOUNTS.find((account) => account.id === entry.item.toAccountId);
                            return (
                                <li
                                    key={entry.item.id}
                                    className='Online__row'
                                >
                                    <span>
                                        {fromAccount?.name.defaultMessage}{' → '}{toAccount?.name.defaultMessage}
                                    </span>
                                    <span>
                                        <FormattedNumber
                                            value={entry.item.amount}

                                            // eslint-disable-next-line react/style-prop-object
                                            style='currency'
                                            currency={PAY_ANYONE_CURRENCY}
                                        />
                                        {' · '}
                                        {entry.item.when}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </>
    );
}
