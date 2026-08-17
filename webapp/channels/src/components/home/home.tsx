// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import {Button} from '@mattermost/shared/components/button';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';

import {
    formatHomeLoanRateLabel,
    formatHomeLoanSpecialLine,
    formatHomeLoanTermLabel,
    getFeaturedHomeLoanSpecial,
    HOME_LOAN_SPECIALS,
    HOME_LOANS_RATES_HASH,
} from 'components/home_loan_rates/home_loan_rates';
import HomeLoanSmallPrint from 'components/home_loan_rates/home_loan_small_print';
import Header from 'components/widgets/header';

import {HOME_LOANS_URL_SUFFIX, RATES_URL_SUFFIX} from 'utils/constants';

import './home.scss';

export default function Home() {
    const dispatch = useDispatch();
    const history = useHistory();
    const currentTeam = useSelector(getCurrentTeam);
    const currentTeamName = currentTeam?.name ?? '';
    const featured = getFeaturedHomeLoanSpecial();

    useEffect(() => {
        dispatch(suppressRHS);

        return () => {
            dispatch(unsuppressRHS);
        };
    }, [dispatch]);

    const openRates = useCallback(() => {
        if (!currentTeamName) {
            return;
        }
        history.push(`/${currentTeamName}/${RATES_URL_SUFFIX}#${HOME_LOANS_RATES_HASH}`);
    }, [currentTeamName, history]);

    const openHomeLoans = useCallback(() => {
        if (!currentTeamName) {
            return;
        }
        history.push(`/${currentTeamName}/${HOME_LOANS_URL_SUFFIX}`);
    }, [currentTeamName, history]);

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
                        defaultMessage='Home-loan specials and published rates'
                    />
                }
                right={
                    <div className='Home__headerActions'>
                        <Button
                            type='button'
                            emphasis='tertiary'
                            onClick={openHomeLoans}
                        >
                            <FormattedMessage
                                id='home.home_loans'
                                defaultMessage='Home loans'
                            />
                        </Button>
                        <Button
                            type='button'
                            emphasis='tertiary'
                            onClick={openRates}
                        >
                            <FormattedMessage
                                id='home.rates'
                                defaultMessage='Rates'
                            />
                        </Button>
                    </div>
                }
            />
            <div className='Home__body'>
                <section
                    className='Home__hero'
                    data-special={featured.id}
                    data-testid='home-loan-hero'
                >
                    <p className='Home__eyebrow'>
                        <FormattedMessage
                            id='home.hero.eyebrow'
                            defaultMessage='Welcome special'
                        />
                    </p>
                    <h3 className='Home__heroTitle'>{featured.name}</h3>
                    <p
                        className='Home__heroRate'
                        data-testid='home-loan-hero-line'
                    >
                        {formatHomeLoanSpecialLine(featured)}
                    </p>
                    <p className='Home__heroMeta'>
                        <span data-testid='home-loan-hero-rate'>{formatHomeLoanRateLabel(featured)}</span>
                        {' · '}
                        <span data-testid='home-loan-hero-term'>{formatHomeLoanTermLabel(featured)}</span>
                        {' · '}
                        <span data-testid='home-loan-hero-occupancy'>{featured.occupancy}</span>
                    </p>
                    <HomeLoanSmallPrint/>
                </section>
                <section className='Home__promos'>
                    <h3 className='Home__sectionTitle'>
                        <FormattedMessage
                            id='home.promo_tiles'
                            defaultMessage='Home-loan specials'
                        />
                    </h3>
                    <ul className='Home__promoList'>
                        {HOME_LOAN_SPECIALS.map((special) => (
                            <li
                                key={special.id}
                                className='Home__promo'
                                data-special={special.id}
                                data-testid={`home-loan-promo-${special.id}`}
                            >
                                <p className='Home__promoRate'>{formatHomeLoanRateLabel(special)}</p>
                                <p className='Home__promoTerm'>{formatHomeLoanTermLabel(special)}</p>
                                <p className='Home__promoOccupancy'>{special.occupancy}</p>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </div>
    );
}
