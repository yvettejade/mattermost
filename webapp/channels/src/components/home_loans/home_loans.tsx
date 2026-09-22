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
    formatHomeLoanComparisonLabel,
    formatHomeLoanRateLabel,
    formatHomeLoanTermLabel,
    HOME_LOAN_SPECIALS,
    HOME_LOANS_RATES_HASH,
} from 'components/home_loan_rates/home_loan_rates';
import HomeLoanSmallPrint from 'components/home_loan_rates/home_loan_small_print';
import Header from 'components/widgets/header';

import {HOME_URL_SUFFIX, RATES_URL_SUFFIX} from 'utils/constants';

import './home_loans.scss';

export default function HomeLoans() {
    const dispatch = useDispatch();
    const history = useHistory();
    const currentTeam = useSelector(getCurrentTeam);
    const currentTeamName = currentTeam?.name ?? '';

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

    const openRates = useCallback(() => {
        if (!currentTeamName) {
            return;
        }
        history.push(`/${currentTeamName}/${RATES_URL_SUFFIX}#${HOME_LOANS_RATES_HASH}`);
    }, [currentTeamName, history]);

    return (
        <div
            id='app-content'
            className='HomeLoans app__content'
        >
            <Header
                level={2}
                className='HomeLoans__header'
                heading={
                    <FormattedMessage
                        id='home_loans.heading'
                        defaultMessage='Home loans'
                    />
                }
                subtitle={
                    <FormattedMessage
                        id='home_loans.subtitle'
                        defaultMessage='Published specials from the shared rates catalog'
                    />
                }
                right={
                    <div className='HomeLoans__headerActions'>
                        <Button
                            type='button'
                            emphasis='tertiary'
                            onClick={openHome}
                        >
                            <FormattedMessage
                                id='home_loans.home'
                                defaultMessage='Home'
                            />
                        </Button>
                        <Button
                            type='button'
                            emphasis='tertiary'
                            onClick={openRates}
                        >
                            <FormattedMessage
                                id='home_loans.rates'
                                defaultMessage='Rates'
                            />
                        </Button>
                    </div>
                }
            />
            <div className='HomeLoans__body'>
                <ul
                    className='HomeLoans__specials'
                    data-testid='home-loan-specials'
                >
                    {HOME_LOAN_SPECIALS.map((special) => (
                        <li
                            key={special.id}
                            className='HomeLoans__special'
                            data-special={special.id}
                            data-testid={`home-loan-special-${special.id}`}
                        >
                            <div className='HomeLoans__specialMain'>
                                <h3 className='HomeLoans__specialName'>{special.name}</h3>
                                <p className='HomeLoans__specialMeta'>
                                    <span data-testid={`home-loan-special-term-${special.id}`}>{formatHomeLoanTermLabel(special)}</span>
                                    {' · '}
                                    <span data-testid={`home-loan-special-occupancy-${special.id}`}>{special.occupancy}</span>
                                    {' · '}
                                    {formatHomeLoanComparisonLabel(special)}
                                </p>
                            </div>
                            <p
                                className='HomeLoans__specialRate'
                                data-testid={`home-loan-special-rate-${special.id}`}
                            >
                                {formatHomeLoanRateLabel(special)}
                            </p>
                        </li>
                    ))}
                </ul>
                <HomeLoanSmallPrint/>
            </div>
        </div>
    );
}
