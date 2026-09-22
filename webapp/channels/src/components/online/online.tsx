// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {selectLhsItem} from 'actions/views/lhs';
import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';

import Header from 'components/widgets/header';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import {
    cardsAndLoansSubtotal,
    everydaySubtotal,
    formatAudFromCents,
    netPosition,
    ONLINE_ACCOUNTS,
    savingsSubtotal,
    youHaveCents,
    youOweCents,
} from './accounts';

import './online.scss';

export default function Online() {
    const dispatch = useDispatch();

    useEffect(() => {
        dispatch(selectLhsItem(LhsItemType.Page, LhsPage.Drafts));
        dispatch(suppressRHS);

        return () => {
            dispatch(unsuppressRHS);
        };
    }, [dispatch]);

    return (
        <div
            id='app-content'
            className='Online app__content'
        >
            <Header
                level={2}
                className='Online__header'
                heading={
                    <FormattedMessage
                        id='online.heading'
                        defaultMessage='Everyday money'
                    />
                }
                subtitle={
                    <FormattedMessage
                        id='online.subtitle'
                        defaultMessage='Net position is assets minus what you owe'
                    />
                }
            />
            <div className='Online__body'>
                <section
                    className='Online__position'
                    aria-labelledby='online-position-heading'
                >
                    <h3
                        id='online-position-heading'
                        className='Online__positionLabel'
                    >
                        <FormattedMessage
                            id='online.overview.net'
                            defaultMessage='Net position'
                        />
                    </h3>
                    <p
                        className='Online__positionValue'
                        data-testid='online-position'
                    >
                        {formatAudFromCents(netPosition(ONLINE_ACCOUNTS))}
                    </p>
                    <dl className='Online__haveOwe'>
                        <div>
                            <dt>
                                <FormattedMessage
                                    id='online.overview.you_have'
                                    defaultMessage='You have'
                                />
                            </dt>
                            <dd data-testid='online-you-have'>
                                {formatAudFromCents(youHaveCents(ONLINE_ACCOUNTS))}
                            </dd>
                        </div>
                        <div>
                            <dt>
                                <FormattedMessage
                                    id='online.overview.you_owe'
                                    defaultMessage='You owe'
                                />
                            </dt>
                            <dd data-testid='online-you-owe'>
                                {formatAudFromCents(youOweCents(ONLINE_ACCOUNTS))}
                            </dd>
                        </div>
                    </dl>
                </section>
                <section aria-labelledby='online-subtotals-heading'>
                    <h3
                        id='online-subtotals-heading'
                        className='Online__sectionTitle'
                    >
                        <FormattedMessage
                            id='online.overview.subtotals'
                            defaultMessage='Subtotals'
                        />
                    </h3>
                    <ul
                        className='Online__subtotals'
                        data-testid='online-subtotals'
                    >
                        <li data-testid='online-subtotal-everyday'>
                            <span>
                                <FormattedMessage
                                    id='online.overview.everyday'
                                    defaultMessage='Everyday'
                                />
                            </span>
                            <strong>{formatAudFromCents(everydaySubtotal(ONLINE_ACCOUNTS))}</strong>
                        </li>
                        <li data-testid='online-subtotal-savings'>
                            <span>
                                <FormattedMessage
                                    id='online.overview.savings'
                                    defaultMessage='Savings'
                                />
                            </span>
                            <strong>{formatAudFromCents(savingsSubtotal(ONLINE_ACCOUNTS))}</strong>
                        </li>
                        <li data-testid='online-subtotal-cards-loans'>
                            <span>
                                <FormattedMessage
                                    id='online.overview.cards_loans'
                                    defaultMessage='Cards & loans'
                                />
                            </span>
                            <strong>{formatAudFromCents(cardsAndLoansSubtotal(ONLINE_ACCOUNTS))}</strong>
                        </li>
                    </ul>
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
                        {ONLINE_ACCOUNTS.map((item) => (
                            <li
                                key={item.id}
                                className='Online__account'
                                data-testid='online-account'
                            >
                                <div className='Online__accountMain'>
                                    <h4 className='Online__accountName'>
                                        <FormattedMessage {...item.name}/>
                                    </h4>
                                    <p className='Online__accountNumber'>{item.number}</p>
                                </div>
                                <p className='Online__accountAvailable'>
                                    <span className='Online__accountAvailableLabel'>
                                        <FormattedMessage
                                            id='online.account.available'
                                            defaultMessage='Available'
                                        />
                                    </span>
                                    {formatAudFromCents(item.balanceCents)}
                                </p>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </div>
    );
}
