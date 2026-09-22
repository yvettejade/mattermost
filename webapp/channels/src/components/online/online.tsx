// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage, FormattedNumber, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';

import {selectLhsItem} from 'actions/views/lhs';
import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';

import Header from 'components/widgets/header';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import {
    getOnlineAccountsView,
    ONLINE_ACCOUNTS,
    setOnlineAccountsView,
    type OnlineAccountsView,
} from './accounts';

import './online.scss';

export default function Online() {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const [view, setView] = useState<OnlineAccountsView>(getOnlineAccountsView);

    useEffect(() => {
        dispatch(selectLhsItem(LhsItemType.Page, LhsPage.Drafts));
        dispatch(suppressRHS);

        return () => {
            dispatch(unsuppressRHS);
        };
    }, [dispatch]);

    const handleViewChange = useCallback((nextView: OnlineAccountsView) => {
        setOnlineAccountsView(nextView);
        setView(nextView);
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
                        defaultMessage='Switch the overview between tiles and a compact list'
                    />
                }
                right={
                    <div
                        className='Online__viewToggle'
                        role='radiogroup'
                        aria-label={formatMessage({
                            id: 'online.view.label',
                            defaultMessage: 'Account layout',
                        })}
                    >
                        <Button
                            emphasis={view === 'tiles' ? 'primary' : 'tertiary'}
                            role='radio'
                            aria-checked={view === 'tiles'}
                            onClick={() => handleViewChange('tiles')}
                        >
                            <FormattedMessage
                                id='online.view.tiles'
                                defaultMessage='Tiles'
                            />
                        </Button>
                        <Button
                            emphasis={view === 'list' ? 'primary' : 'tertiary'}
                            role='radio'
                            aria-checked={view === 'list'}
                            onClick={() => handleViewChange('list')}
                        >
                            <FormattedMessage
                                id='online.view.list'
                                defaultMessage='List'
                            />
                        </Button>
                    </div>
                }
            />
            <div className='Online__body'>
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
                        className={classNames('Online__accounts', view)}
                        data-testid='online-accounts'
                    >
                        {ONLINE_ACCOUNTS.map((account) => (
                            <li
                                key={account.id}
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
                                        <FormattedMessage
                                            id='online.account.available'
                                            defaultMessage='Available'
                                        />
                                    </span>
                                    <FormattedNumber
                                        value={account.available}

                                        // eslint-disable-next-line react/style-prop-object
                                        style='currency'
                                        currency='AUD'
                                    />
                                </p>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </div>
    );
}
