// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect} from 'react';
import {FormattedMessage, FormattedNumber} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import {Button} from '@mattermost/shared/components/button';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {selectLhsItem} from 'actions/views/lhs';
import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';

import {
    CALCULATORS_REPAYMENTS_HREF,
    EXAMPLE_HOME_LOAN_OCCUPANCY,
    EXAMPLE_HOME_LOAN_PRINCIPAL,
    EXAMPLE_HOME_LOAN_TERM_YEARS,
    indicativeWeeklyRepayment,
} from 'components/calculators/repayment_math';
import Header from 'components/widgets/header';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import {HOME_LOAN_SPECIALS} from './home_loan_specials';

import './home_loans.scss';

export default function HomeLoans() {
    const dispatch = useDispatch();
    const history = useHistory();
    const currentTeam = useSelector(getCurrentTeam);
    const currentTeamName = currentTeam?.name ?? '';

    useEffect(() => {
        dispatch(selectLhsItem(LhsItemType.Page, LhsPage.Drafts));
        dispatch(suppressRHS);

        return () => {
            dispatch(unsuppressRHS);
        };
    }, [dispatch]);

    const handleWorkOutRepayments = useCallback(() => {
        if (!currentTeamName) {
            return;
        }
        history.push(`/${currentTeamName}${CALCULATORS_REPAYMENTS_HREF}`);
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
                        defaultMessage='Featured specials with an indicative weekly repayment'
                    />
                }
                right={
                    <Button
                        emphasis='tertiary'
                        onClick={handleWorkOutRepayments}
                    >
                        <FormattedMessage
                            id='home_loans.work_out'
                            defaultMessage='Work out your repayments'
                        />
                    </Button>
                }
            />
            <div className='HomeLoans__body'>
                <p
                    className='HomeLoans__example'
                    data-testid='home-loans-example'
                >
                    <FormattedMessage
                        id='home_loans.example'
                        defaultMessage='Indicative weekly repayment on a {principal} {occupancy} loan over {years} years.'
                        values={{
                            principal: (
                                <FormattedNumber
                                    value={EXAMPLE_HOME_LOAN_PRINCIPAL}

                                    // eslint-disable-next-line react/style-prop-object
                                    style='currency'
                                    currency='AUD'
                                    maximumFractionDigits={0}
                                />
                            ),
                            occupancy: EXAMPLE_HOME_LOAN_OCCUPANCY,
                            years: EXAMPLE_HOME_LOAN_TERM_YEARS,
                        }}
                    />
                </p>
                <ul
                    className='HomeLoans__specials'
                    data-testid='home-loan-specials'
                >
                    {HOME_LOAN_SPECIALS.map((special) => {
                        const weeklyRepayment = indicativeWeeklyRepayment(special.annualRatePercent);

                        return (
                            <li
                                key={special.id}
                                className='HomeLoans__special'
                                data-testid='home-loan-special'
                            >
                                <div className='HomeLoans__specialMain'>
                                    <h3 className='HomeLoans__specialName'>
                                        <FormattedMessage {...special.name}/>
                                    </h3>
                                    <p className='HomeLoans__specialMeta'>
                                        <FormattedMessage {...special.rateType}/>
                                        {' · '}
                                        <FormattedMessage
                                            id='home_loans.comparison_rate'
                                            defaultMessage='Comparison {rate}'
                                            values={{
                                                rate: (
                                                    <FormattedNumber
                                                        value={special.comparisonRatePercent / 100}

                                                        // eslint-disable-next-line react/style-prop-object
                                                        style='percent'
                                                        minimumFractionDigits={2}
                                                        maximumFractionDigits={2}
                                                    />
                                                ),
                                            }}
                                        />
                                    </p>
                                </div>
                                <p className='HomeLoans__specialRate'>
                                    <span className='HomeLoans__specialRateLabel'>
                                        <FormattedMessage
                                            id='home_loans.advertised_rate'
                                            defaultMessage='Advertised rate'
                                        />
                                    </span>
                                    <FormattedNumber
                                        value={special.annualRatePercent / 100}

                                        // eslint-disable-next-line react/style-prop-object
                                        style='percent'
                                        minimumFractionDigits={2}
                                        maximumFractionDigits={2}
                                    />
                                </p>
                                <p
                                    className='HomeLoans__specialRepayment'
                                    data-testid={`home-loan-weekly-${special.id}`}
                                >
                                    <span className='HomeLoans__specialRepaymentLabel'>
                                        <FormattedMessage
                                            id='home_loans.weekly_repayment'
                                            defaultMessage='Indicative weekly'
                                        />
                                    </span>
                                    <FormattedNumber
                                        value={weeklyRepayment}

                                        // eslint-disable-next-line react/style-prop-object
                                        style='currency'
                                        currency='AUD'
                                    />
                                </p>
                            </li>
                        );
                    })}
                </ul>
                <p
                    className='HomeLoans__disclaimer'
                    data-testid='home-loans-disclaimer'
                >
                    <FormattedMessage
                        id='home_loans.disclaimer'
                        defaultMessage='This is not financial advice. Figures are indicative only and use the repayments calculator.'
                    />
                </p>
            </div>
        </div>
    );
}
