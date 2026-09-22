// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import {Button} from '@mattermost/shared/components/button';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';

import {BANK_PRODUCTS, RAPID_SAVE_PRODUCT_ID} from 'components/product_rates/product_rates';
import Header from 'components/widgets/header';

import {BANK_ACCOUNTS_URL_SUFFIX} from 'utils/constants';

import './home.scss';

export default function Home() {
    const dispatch = useDispatch();
    const history = useHistory();
    const currentTeam = useSelector(getCurrentTeam);
    const currentTeamName = currentTeam?.name ?? '';
    const [slideIndex, setSlideIndex] = useState(0);
    const slide = BANK_PRODUCTS[slideIndex] ?? BANK_PRODUCTS[0];

    useEffect(() => {
        dispatch(suppressRHS);

        return () => {
            dispatch(unsuppressRHS);
        };
    }, [dispatch]);

    const openBankAccounts = useCallback((hash = '') => {
        if (!currentTeamName) {
            return;
        }
        history.push(`/${currentTeamName}/${BANK_ACCOUNTS_URL_SUFFIX}${hash}`);
    }, [currentTeamName, history]);

    const showPrevious = useCallback(() => {
        setSlideIndex((index) => (index === 0 ? BANK_PRODUCTS.length - 1 : index - 1));
    }, []);

    const showNext = useCallback(() => {
        setSlideIndex((index) => (index === BANK_PRODUCTS.length - 1 ? 0 : index + 1));
    }, []);

    return (
        <div
            id='app-content'
            className='Home app__content'
        >
            <Header
                level={2}
                className='Home__header'
                heading={
                    <FormattedMessage
                        id='home.heading'
                        defaultMessage='Home'
                    />
                }
                subtitle={
                    <FormattedMessage
                        id='home.subtitle'
                        defaultMessage='Product discovery for bank accounts and rates'
                    />
                }
                right={
                    <Button
                        type='button'
                        emphasis='tertiary'
                        onClick={() => openBankAccounts()}
                    >
                        <FormattedMessage
                            id='home.bank_accounts'
                            defaultMessage='Bank accounts'
                        />
                    </Button>
                }
            />
            <div className='Home__body'>
                <section
                    className='Home__hero'
                    aria-roledescription='carousel'
                    aria-label={slide.name}
                    data-product={slide.id}
                >
                    <p className='Home__eyebrow'>
                        <FormattedMessage
                            id='home.hero.eyebrow'
                            defaultMessage='Featured account'
                        />
                    </p>
                    <h3 className='Home__heroTitle'>{slide.name}</h3>
                    <p className='Home__heroRate'>{slide.rateLabel}</p>
                    <p className='Home__heroSummary'>{slide.summary}</p>
                    {slide.id === RAPID_SAVE_PRODUCT_ID && (
                        <Button
                            type='button'
                            emphasis='primary'
                            onClick={() => openBankAccounts(`#${RAPID_SAVE_PRODUCT_ID}`)}
                        >
                            <FormattedMessage
                                id='home.view_rapid_save'
                                defaultMessage='View Rapid Save'
                            />
                        </Button>
                    )}
                    <div className='Home__heroControls'>
                        <Button
                            type='button'
                            emphasis='tertiary'
                            size='sm'
                            onClick={showPrevious}
                        >
                            <FormattedMessage
                                id='home.previous'
                                defaultMessage='Previous'
                            />
                        </Button>
                        <Button
                            type='button'
                            emphasis='tertiary'
                            size='sm'
                            onClick={showNext}
                        >
                            <FormattedMessage
                                id='home.next'
                                defaultMessage='Next'
                            />
                        </Button>
                    </div>
                </section>
                <section className='Home__cards'>
                    <h3 className='Home__sectionTitle'>
                        <FormattedMessage
                            id='home.product_cards'
                            defaultMessage='Accounts'
                        />
                    </h3>
                    <ul className='Home__cardList'>
                        {BANK_PRODUCTS.map((product) => (
                            <li
                                key={product.id}
                                className='Home__card'
                                data-product={product.id}
                            >
                                <h4 className='Home__cardTitle'>{product.name}</h4>
                                <p className='Home__cardRate'>{product.rateLabel}</p>
                                <p className='Home__cardSummary'>{product.summary}</p>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </div>
    );
}
