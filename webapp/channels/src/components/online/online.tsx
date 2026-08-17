// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {selectLhsItem} from 'actions/views/lhs';
import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';

import Header from 'components/widgets/header';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import {
    formatNzdFromCents,
    loadEverydayAccounts,
    YOU_MONEY_ACCOUNT_CAP,
    youMoneyAccounts,
    type EverydayAccount,
} from './accounts';
import OpenAccount from './open_account';

import './online.scss';

export default function Online() {
    const dispatch = useDispatch();
    const [accounts, setAccounts] = useState<EverydayAccount[]>(loadEverydayAccounts);
    const [opening, setOpening] = useState(false);
    const [capError, setCapError] = useState(false);

    useEffect(() => {
        dispatch(selectLhsItem(LhsItemType.Page, LhsPage.Drafts));
        dispatch(suppressRHS);

        return () => {
            dispatch(unsuppressRHS);
        };
    }, [dispatch]);

    const everydayAccounts = youMoneyAccounts(accounts);

    const handleAddAccount = useCallback(() => {
        if (everydayAccounts.length >= YOU_MONEY_ACCOUNT_CAP) {
            setCapError(true);
            return;
        }
        setCapError(false);
        setOpening(true);
    }, [everydayAccounts.length]);

    const handleCancel = useCallback(() => {
        setOpening(false);
        setAccounts(loadEverydayAccounts());
    }, []);

    const handleOpened = useCallback((nextAccounts: EverydayAccount[]) => {
        setAccounts(nextAccounts);
        setOpening(false);
        setCapError(false);
    }, []);

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
                        defaultMessage='Open another YouMoney account without leaving Internet Banking'
                    />
                }
            />
            <div className='Online__body'>
                {opening ? (
                    <OpenAccount
                        onCancel={handleCancel}
                        onOpened={handleOpened}
                    />
                ) : (
                    <section aria-labelledby='online-everyday-heading'>
                        <h3
                            id='online-everyday-heading'
                            className='Online__sectionTitle'
                        >
                            <FormattedMessage
                                id='online.everyday.heading'
                                defaultMessage='Everyday'
                            />
                        </h3>
                        {capError && (
                            <p
                                className='Online__error'
                                role='alert'
                            >
                                <FormattedMessage
                                    id='online.open.cap'
                                    defaultMessage='You can have up to 25 YouMoney accounts.'
                                />
                            </p>
                        )}
                        <ul
                            className='Online__accounts'
                            data-testid='online-accounts'
                        >
                            {everydayAccounts.map((account) => (
                                <li
                                    key={account.id}
                                    className={classNames('Online__account', account.colour)}
                                    data-testid='online-account'
                                >
                                    <div className='Online__accountMain'>
                                        <h4 className='Online__accountName'>{account.name}</h4>
                                        <p className='Online__accountNumber'>{account.number}</p>
                                    </div>
                                    <p className='Online__accountAvailable'>
                                        <span className='Online__accountAvailableLabel'>
                                            <FormattedMessage
                                                id='online.account.available'
                                                defaultMessage='Available'
                                            />
                                        </span>
                                        {formatNzdFromCents(account.availableCents)}
                                    </p>
                                </li>
                            ))}
                            <li>
                                <button
                                    type='button'
                                    className='Online__addAccount'
                                    data-testid='online-add-account'
                                    onClick={handleAddAccount}
                                >
                                    <span
                                        className='Online__addAccountPlus'
                                        aria-hidden={true}
                                    >
                                        {'+'}
                                    </span>
                                    <FormattedMessage
                                        id='online.addAccount'
                                        defaultMessage='Add an account'
                                    />
                                </button>
                            </li>
                        </ul>
                    </section>
                )}
            </div>
        </div>
    );
}
