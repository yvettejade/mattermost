// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import type {ReactNode} from 'react';
import {FormattedMessage, FormattedNumber} from 'react-intl';
import {useDispatch} from 'react-redux';

import {selectLhsItem} from 'actions/views/lhs';
import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';

import Header from 'components/widgets/header';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import {
    accountsOfTypes,
    cardsAndLoansSubtotal,
    everydaySubtotal,
    EVERYDAY_TYPES,
    LIABILITY_TYPES,
    netPosition,
    ONLINE_ACCOUNTS,
    SAVINGS_TYPES,
    savingsSubtotal,
    youHave,
    youOwe,
    type Account,
} from './accounts';

import './online.scss';

function Money({cents}: {cents: number}) {
    return (
        <FormattedNumber
            value={cents / 100}

            // eslint-disable-next-line react/style-prop-object
            style='currency'
            currency='AUD'
        />
    );
}

function AccountRow({account, amountLabel}: {account: Account; amountLabel: ReactNode}) {
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
                    {amountLabel}
                </span>
                <Money cents={Math.abs(account.balanceCents)}/>
            </p>
        </li>
    );
}

export default function Online() {
    const dispatch = useDispatch();
    const accounts = ONLINE_ACCOUNTS;
    const position = netPosition(accounts);
    const have = youHave(accounts);
    const owe = youOwe(accounts);

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
                            id='online.overview.position.label'
                            defaultMessage='Net position'
                        />
                    </h3>
                    <p
                        className='Online__positionValue'
                        data-testid='online-position'
                    >
                        <Money cents={position}/>
                    </p>
                    <p
                        className='Online__positionSplit'
                        data-testid='online-position-split'
                    >
                        <span data-testid='online-you-have'>
                            <FormattedMessage
                                id='online.overview.youHave'
                                defaultMessage='You have {amount}'
                                values={{amount: <Money cents={have}/>}}
                            />
                        </span>
                        <span data-testid='online-you-owe'>
                            <FormattedMessage
                                id='online.overview.youOwe'
                                defaultMessage='You owe {amount}'
                                values={{amount: <Money cents={owe}/>}}
                            />
                        </span>
                    </p>
                </section>
                <section aria-labelledby='online-everyday-heading'>
                    <div className='Online__groupHeader'>
                        <h3
                            id='online-everyday-heading'
                            className='Online__sectionTitle'
                        >
                            <FormattedMessage
                                id='online.group.everyday'
                                defaultMessage='Everyday'
                            />
                        </h3>
                        <p
                            className='Online__groupSubtotal'
                            data-testid='online-everyday-subtotal'
                        >
                            <Money cents={everydaySubtotal(accounts)}/>
                        </p>
                    </div>
                    <ul
                        className='Online__accounts'
                        data-testid='online-everyday-accounts'
                    >
                        {accountsOfTypes(accounts, EVERYDAY_TYPES).map((account) => (
                            <AccountRow
                                key={account.id}
                                account={account}
                                amountLabel={
                                    <FormattedMessage
                                        id='online.account.available'
                                        defaultMessage='Available'
                                    />
                                }
                            />
                        ))}
                    </ul>
                </section>
                <section aria-labelledby='online-savings-heading'>
                    <div className='Online__groupHeader'>
                        <h3
                            id='online-savings-heading'
                            className='Online__sectionTitle'
                        >
                            <FormattedMessage
                                id='online.group.savings'
                                defaultMessage='Savings'
                            />
                        </h3>
                        <p
                            className='Online__groupSubtotal'
                            data-testid='online-savings-subtotal'
                        >
                            <Money cents={savingsSubtotal(accounts)}/>
                        </p>
                    </div>
                    <ul
                        className='Online__accounts'
                        data-testid='online-savings-accounts'
                    >
                        {accountsOfTypes(accounts, SAVINGS_TYPES).map((account) => (
                            <AccountRow
                                key={account.id}
                                account={account}
                                amountLabel={
                                    <FormattedMessage
                                        id='online.account.available'
                                        defaultMessage='Available'
                                    />
                                }
                            />
                        ))}
                    </ul>
                </section>
                <section aria-labelledby='online-cards-heading'>
                    <div className='Online__groupHeader'>
                        <h3
                            id='online-cards-heading'
                            className='Online__sectionTitle'
                        >
                            <FormattedMessage
                                id='online.group.cardsAndLoans'
                                defaultMessage='Cards & loans'
                            />
                        </h3>
                        <p
                            className='Online__groupSubtotal'
                            data-testid='online-cards-loans-subtotal'
                        >
                            <Money cents={cardsAndLoansSubtotal(accounts)}/>
                        </p>
                    </div>
                    <ul
                        className='Online__accounts'
                        data-testid='online-cards-loans-accounts'
                    >
                        {accountsOfTypes(accounts, LIABILITY_TYPES).map((account) => (
                            <AccountRow
                                key={account.id}
                                account={account}
                                amountLabel={
                                    <FormattedMessage
                                        id='online.account.outstanding'
                                        defaultMessage='Outstanding'
                                    />
                                }
                            />
                        ))}
                    </ul>
                </section>
            </div>
        </div>
    );
}
