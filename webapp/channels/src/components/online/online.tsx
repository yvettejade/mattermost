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
    isLiabilityAccount,
    netPosition,
    ONLINE_ACCOUNTS,
    outstandingCents,
    savingsSubtotal,
    youHave,
    youOwe,
    type OnlineAccount,
} from './accounts';

import './online.scss';

function accountsOfType(type: OnlineAccount['type']): OnlineAccount[] {
    return ONLINE_ACCOUNTS.filter((account) => account.type === type);
}

function liabilityAccounts(): OnlineAccount[] {
    return ONLINE_ACCOUNTS.filter(isLiabilityAccount);
}

type AccountRowProps = {
    account: OnlineAccount;
    amountCents: number;
    amountLabel: {id: string; defaultMessage: string};
};

function AccountRow({account, amountCents, amountLabel}: AccountRowProps) {
    return (
        <li
            className='Online__account'
            data-testid='online-account'
        >
            <div className='Online__accountMain'>
                <h4 className='Online__accountName'>
                    <FormattedMessage {...account.name}/>
                </h4>
                <p className='Online__accountNumber'>{account.number}</p>
            </div>
            <p className='Online__accountAvailable'>
                <span className='Online__accountAvailableLabel'>
                    <FormattedMessage {...amountLabel}/>
                </span>
                {formatAudFromCents(amountCents)}
            </p>
        </li>
    );
}

type GroupProps = {
    headingId: string;
    heading: string;
    testId: string;
    subtotalCents: number;
    children: React.ReactNode;
};

function AccountGroup({headingId, heading, testId, subtotalCents, children}: GroupProps) {
    return (
        <section aria-labelledby={headingId}>
            <div className='Online__groupHeading'>
                <h3
                    id={headingId}
                    className='Online__sectionTitle'
                >
                    <FormattedMessage
                        id={headingId}
                        defaultMessage={heading}
                    />
                </h3>
                <p
                    className='Online__groupSubtotal'
                    data-testid={testId}
                >
                    {formatAudFromCents(subtotalCents)}
                </p>
            </div>
            <ul className='Online__accounts'>
                {children}
            </ul>
        </section>
    );
}

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
                        defaultMessage='Net position is what you have minus what you owe'
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
                            id='online.position.label'
                            defaultMessage='Net position'
                        />
                    </h3>
                    <p
                        className='Online__positionValue'
                        data-testid='online-position'
                    >
                        {formatAudFromCents(netPosition(ONLINE_ACCOUNTS))}
                    </p>
                    <dl className='Online__positionSplit'>
                        <div>
                            <dt>
                                <FormattedMessage
                                    id='online.position.have'
                                    defaultMessage='You have'
                                />
                            </dt>
                            <dd data-testid='online-you-have'>
                                {formatAudFromCents(youHave(ONLINE_ACCOUNTS))}
                            </dd>
                        </div>
                        <div>
                            <dt>
                                <FormattedMessage
                                    id='online.position.owe'
                                    defaultMessage='You owe'
                                />
                            </dt>
                            <dd data-testid='online-you-owe'>
                                {formatAudFromCents(youOwe(ONLINE_ACCOUNTS))}
                            </dd>
                        </div>
                    </dl>
                </section>
                <AccountGroup
                    headingId='online.accounts.everyday'
                    heading='Everyday'
                    testId='online-everyday-subtotal'
                    subtotalCents={everydaySubtotal(ONLINE_ACCOUNTS)}
                >
                    {accountsOfType('transaction').map((item) => (
                        <AccountRow
                            key={item.id}
                            account={item}
                            amountCents={item.balanceCents}
                            amountLabel={{
                                id: 'online.account.available',
                                defaultMessage: 'Available',
                            }}
                        />
                    ))}
                </AccountGroup>
                <AccountGroup
                    headingId='online.accounts.savings'
                    heading='Savings'
                    testId='online-savings-subtotal'
                    subtotalCents={savingsSubtotal(ONLINE_ACCOUNTS)}
                >
                    {accountsOfType('savings').map((item) => (
                        <AccountRow
                            key={item.id}
                            account={item}
                            amountCents={item.balanceCents}
                            amountLabel={{
                                id: 'online.account.available',
                                defaultMessage: 'Available',
                            }}
                        />
                    ))}
                </AccountGroup>
                <AccountGroup
                    headingId='online.accounts.cards_loans'
                    heading='Cards & loans'
                    testId='online-cards-loans-subtotal'
                    subtotalCents={cardsAndLoansSubtotal(ONLINE_ACCOUNTS)}
                >
                    {liabilityAccounts().map((item) => (
                        <AccountRow
                            key={item.id}
                            account={item}
                            amountCents={outstandingCents(item)}
                            amountLabel={{
                                id: 'online.account.outstanding',
                                defaultMessage: 'Outstanding',
                            }}
                        />
                    ))}
                </AccountGroup>
            </div>
        </div>
    );
}
