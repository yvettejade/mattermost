// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import {Button} from '@mattermost/shared/components/button';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';

import {BANK_PRODUCTS, getRapidSaveProduct, RAPID_SAVE_PRODUCT_ID} from 'components/product_rates/product_rates';
import Header from 'components/widgets/header';

import {HOME_URL_SUFFIX} from 'utils/constants';

import './bank_accounts.scss';

export default function BankAccounts() {
    const dispatch = useDispatch();
    const history = useHistory();
    const currentTeam = useSelector(getCurrentTeam);
    const currentTeamName = currentTeam?.name ?? '';
    const rapidSave = getRapidSaveProduct();

    useEffect(() => {
        dispatch(suppressRHS);

        return () => {
            dispatch(unsuppressRHS);
        };
    }, [dispatch]);

    const openHome = useCallback(() => {
        if (!currentTeamName) {
            return;
        }
        history.push(`/${currentTeamName}/${HOME_URL_SUFFIX}`);
    }, [currentTeamName, history]);

    return (
        <div
            id='app-content'
            className='BankAccounts app__content'
        >
            <Header
                level={2}
                className='BankAccounts__header'
                heading={
                    <FormattedMessage
                        id='bank_accounts.heading'
                        defaultMessage='Bank accounts'
                    />
                }
                subtitle={
                    <FormattedMessage
                        id='bank_accounts.subtitle'
                        defaultMessage='Compare accounts and published rates'
                    />
                }
                right={
                    <Button
                        type='button'
                        emphasis='tertiary'
                        onClick={openHome}
                    >
                        <FormattedMessage
                            id='bank_accounts.home'
                            defaultMessage='Home'
                        />
                    </Button>
                }
            />
            <div className='BankAccounts__body'>
                <section className='BankAccounts__cards'>
                    <h3 className='BankAccounts__sectionTitle'>
                        <FormattedMessage
                            id='bank_accounts.product_cards'
                            defaultMessage='Accounts'
                        />
                    </h3>
                    <ul className='BankAccounts__cardList'>
                        {BANK_PRODUCTS.map((product) => (
                            <li
                                key={product.id}
                                className='BankAccounts__card'
                                data-product={product.id}
                            >
                                <h4 className='BankAccounts__cardTitle'>{product.name}</h4>
                                <p className='BankAccounts__cardRate'>{product.rateLabel}</p>
                                <p className='BankAccounts__cardSummary'>{product.summary}</p>
                            </li>
                        ))}
                    </ul>
                </section>
                <section
                    id={RAPID_SAVE_PRODUCT_ID}
                    className='BankAccounts__detail'
                    data-product={RAPID_SAVE_PRODUCT_ID}
                >
                    <h3 className='BankAccounts__sectionTitle'>{rapidSave.name}</h3>
                    <p className='BankAccounts__detailRate'>{rapidSave.rateLabel}</p>
                    <p className='BankAccounts__detailSummary'>{rapidSave.summary}</p>
                    <h4 className='BankAccounts__rulesTitle'>
                        <FormattedMessage
                            id='bank_accounts.product_rules'
                            defaultMessage='Product rules'
                        />
                    </h4>
                    <ul className='BankAccounts__rules'>
                        {rapidSave.rules.map((rule) => (
                            <li key={rule}>{rule}</li>
                        ))}
                    </ul>
                </section>
                <section className='BankAccounts__rates'>
                    <h3 className='BankAccounts__sectionTitle'>
                        <FormattedMessage
                            id='bank_accounts.rates'
                            defaultMessage='Rates'
                        />
                    </h3>
                    <table className='BankAccounts__table'>
                        <caption className='BankAccounts__caption'>
                            <FormattedMessage
                                id='bank_accounts.rates_caption'
                                defaultMessage='Published variable rates'
                            />
                        </caption>
                        <thead>
                            <tr>
                                <th scope='col'>
                                    <FormattedMessage
                                        id='bank_accounts.rates_account'
                                        defaultMessage='Account'
                                    />
                                </th>
                                <th scope='col'>
                                    <FormattedMessage
                                        id='bank_accounts.rates_label'
                                        defaultMessage='Rate'
                                    />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {BANK_PRODUCTS.map((product) => (
                                <tr
                                    key={product.id}
                                    data-product={product.id}
                                >
                                    <th scope='row'>{product.name}</th>
                                    <td>{product.rateLabel}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            </div>
        </div>
    );
}
