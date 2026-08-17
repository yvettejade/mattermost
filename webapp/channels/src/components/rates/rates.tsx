// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import {Button} from '@mattermost/shared/components/button';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';

import HomeLoanSmallPrint from 'components/home_loan_rates/home_loan_small_print';
import {
    formatHomeLoanComparisonLabel,
    formatHomeLoanRateLabel,
    formatHomeLoanTermLabel,
    HOME_LOAN_SPECIALS,
    HOME_LOANS_RATES_HASH,
} from 'components/home_loan_rates/home_loan_rates';
import Header from 'components/widgets/header';

import {HOME_LOANS_URL_SUFFIX, HOME_URL_SUFFIX} from 'utils/constants';

import './rates.scss';

export default function Rates() {
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

    const openHomeLoans = useCallback(() => {
        if (!currentTeamName) {
            return;
        }
        history.push(`/${currentTeamName}/${HOME_LOANS_URL_SUFFIX}`);
    }, [currentTeamName, history]);

    return (
        <div
            id='app-content'
            className='Rates app__content'
        >
            <Header
                level={2}
                className='Rates__header'
                heading={
                    <FormattedMessage
                        id='rates.heading'
                        defaultMessage='Rates'
                    />
                }
                subtitle={
                    <FormattedMessage
                        id='rates.subtitle'
                        defaultMessage='Published home-loan specials'
                    />
                }
                right={
                    <div className='Rates__headerActions'>
                        <Button
                            type='button'
                            emphasis='tertiary'
                            onClick={openHome}
                        >
                            <FormattedMessage
                                id='rates.home'
                                defaultMessage='Home'
                            />
                        </Button>
                        <Button
                            type='button'
                            emphasis='tertiary'
                            onClick={openHomeLoans}
                        >
                            <FormattedMessage
                                id='rates.home_loans'
                                defaultMessage='Home loans'
                            />
                        </Button>
                    </div>
                }
            />
            <div className='Rates__body'>
                <section
                    id={HOME_LOANS_RATES_HASH}
                    className='Rates__homeLoans'
                    data-testid='home-loans-rates'
                >
                    <h3 className='Rates__sectionTitle'>
                        <FormattedMessage
                            id='rates.home_loans_section'
                            defaultMessage='Home loans'
                        />
                    </h3>
                    <table className='Rates__table'>
                        <caption className='Rates__caption'>
                            <FormattedMessage
                                id='rates.home_loans_caption'
                                defaultMessage='Published home-loan specials'
                            />
                        </caption>
                        <thead>
                            <tr>
                                <th scope='col'>
                                    <FormattedMessage
                                        id='rates.special'
                                        defaultMessage='Special'
                                    />
                                </th>
                                <th scope='col'>
                                    <FormattedMessage
                                        id='rates.rate'
                                        defaultMessage='Rate'
                                    />
                                </th>
                                <th scope='col'>
                                    <FormattedMessage
                                        id='rates.term'
                                        defaultMessage='Term'
                                    />
                                </th>
                                <th scope='col'>
                                    <FormattedMessage
                                        id='rates.occupancy'
                                        defaultMessage='Occupancy'
                                    />
                                </th>
                                <th scope='col'>
                                    <FormattedMessage
                                        id='rates.comparison'
                                        defaultMessage='Comparison'
                                    />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {HOME_LOAN_SPECIALS.map((special) => (
                                <tr
                                    key={special.id}
                                    data-special={special.id}
                                    data-testid={`home-loan-rate-row-${special.id}`}
                                >
                                    <th scope='row'>{special.name}</th>
                                    <td data-testid={`home-loan-rate-${special.id}`}>{formatHomeLoanRateLabel(special)}</td>
                                    <td data-testid={`home-loan-term-${special.id}`}>{formatHomeLoanTermLabel(special)}</td>
                                    <td data-testid={`home-loan-occupancy-${special.id}`}>{special.occupancy}</td>
                                    <td>{formatHomeLoanComparisonLabel(special)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <HomeLoanSmallPrint/>
                </section>
            </div>
        </div>
    );
}
