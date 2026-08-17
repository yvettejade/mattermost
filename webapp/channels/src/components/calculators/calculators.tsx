// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage, FormattedNumber, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {selectLhsItem} from 'actions/views/lhs';
import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';

import Header from 'components/widgets/header';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import {
    calculateRepayment,
    EXAMPLE_HOME_LOAN_PRINCIPAL,
    EXAMPLE_HOME_LOAN_TERM_YEARS,
    type RepaymentFrequency,
} from './repayment_math';

import './calculators.scss';

const OTHER_CALCULATOR_SECTIONS = [
    {
        id: 'borrowing',
        title: {id: 'calculators.borrowing.title', defaultMessage: 'Borrowing power'},
        body: {id: 'calculators.borrowing.body', defaultMessage: 'Estimate how much you may be able to borrow.'},
    },
    {
        id: 'savings-goal',
        title: {id: 'calculators.savings_goal.title', defaultMessage: 'Savings goal'},
        body: {id: 'calculators.savings_goal.body', defaultMessage: 'Plan deposits to reach a savings target.'},
    },
    {
        id: 'foreign-exchange',
        title: {id: 'calculators.foreign_exchange.title', defaultMessage: 'Foreign exchange'},
        body: {id: 'calculators.foreign_exchange.body', defaultMessage: 'Convert currencies and estimate transfer costs.'},
    },
] as const;

const FREQUENCIES: Array<{value: RepaymentFrequency; label: {id: string; defaultMessage: string}}> = [
    {value: 'weekly', label: {id: 'calculators.repayments.frequency.weekly', defaultMessage: 'Weekly'}},
    {value: 'fortnightly', label: {id: 'calculators.repayments.frequency.fortnightly', defaultMessage: 'Fortnightly'}},
    {value: 'monthly', label: {id: 'calculators.repayments.frequency.monthly', defaultMessage: 'Monthly'}},
];

export default function Calculators() {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const [principal, setPrincipal] = useState(String(EXAMPLE_HOME_LOAN_PRINCIPAL));
    const [annualRatePercent, setAnnualRatePercent] = useState('5.99');
    const [termYears, setTermYears] = useState(String(EXAMPLE_HOME_LOAN_TERM_YEARS));
    const [frequency, setFrequency] = useState<RepaymentFrequency>('weekly');

    useEffect(() => {
        dispatch(selectLhsItem(LhsItemType.Page, LhsPage.Drafts));
        dispatch(suppressRHS);

        return () => {
            dispatch(unsuppressRHS);
        };
    }, [dispatch]);

    useEffect(() => {
        const hash = window.location.hash.replace('#', '');
        if (!hash) {
            return;
        }
        document.getElementById(hash)?.scrollIntoView();
    }, []);

    const repayment = useMemo(() => {
        const parsedPrincipal = Number(principal);
        const parsedRate = Number(annualRatePercent);
        const parsedTerm = Number(termYears);
        if (!Number.isFinite(parsedPrincipal) || !Number.isFinite(parsedRate) || !Number.isFinite(parsedTerm)) {
            return null;
        }
        if (parsedPrincipal <= 0 || parsedTerm <= 0 || parsedRate < 0) {
            return null;
        }
        return calculateRepayment({
            principal: parsedPrincipal,
            annualRatePercent: parsedRate,
            termYears: parsedTerm,
            frequency,
        });
    }, [annualRatePercent, frequency, principal, termYears]);

    const handleFrequencyChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        setFrequency(event.target.value as RepaymentFrequency);
    }, []);

    return (
        <div
            id='app-content'
            className='Calculators app__content'
        >
            <Header
                level={2}
                className='Calculators__header'
                heading={
                    <FormattedMessage
                        id='calculators.heading'
                        defaultMessage='Calculators'
                    />
                }
                subtitle={
                    <FormattedMessage
                        id='calculators.subtitle'
                        defaultMessage='Tools for repayments, borrowing power, savings, and foreign exchange'
                    />
                }
            />
            <div className='Calculators__body'>
                <section
                    id='repayments'
                    className='Calculators__item'
                    aria-labelledby='calculators-repayments-heading'
                >
                    <h3
                        id='calculators-repayments-heading'
                        className='Calculators__itemTitle'
                    >
                        <FormattedMessage
                            id='calculators.repayments.title'
                            defaultMessage='Repayments'
                        />
                    </h3>
                    <p className='Calculators__itemBody'>
                        <FormattedMessage
                            id='calculators.repayments.body'
                            defaultMessage='Estimate weekly, fortnightly, or monthly loan repayments.'
                        />
                    </p>
                    <form className='Calculators__form'>
                        <label className='Calculators__field'>
                            <span>
                                <FormattedMessage
                                    id='calculators.repayments.amount'
                                    defaultMessage='Loan amount'
                                />
                            </span>
                            <input
                                type='number'
                                min={1}
                                step={1000}
                                value={principal}
                                onChange={(event) => setPrincipal(event.target.value)}
                            />
                        </label>
                        <label className='Calculators__field'>
                            <span>
                                <FormattedMessage
                                    id='calculators.repayments.rate'
                                    defaultMessage='Interest rate (% p.a.)'
                                />
                            </span>
                            <input
                                type='number'
                                min={0}
                                step={0.01}
                                value={annualRatePercent}
                                onChange={(event) => setAnnualRatePercent(event.target.value)}
                            />
                        </label>
                        <label className='Calculators__field'>
                            <span>
                                <FormattedMessage
                                    id='calculators.repayments.term'
                                    defaultMessage='Term (years)'
                                />
                            </span>
                            <input
                                type='number'
                                min={1}
                                step={1}
                                value={termYears}
                                onChange={(event) => setTermYears(event.target.value)}
                            />
                        </label>
                        <label className='Calculators__field'>
                            <span>
                                <FormattedMessage
                                    id='calculators.repayments.frequency'
                                    defaultMessage='Frequency'
                                />
                            </span>
                            <select
                                value={frequency}
                                onChange={handleFrequencyChange}
                            >
                                {FREQUENCIES.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {formatMessage(option.label)}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </form>
                    {repayment !== null && (
                        <p
                            className='Calculators__result'
                            data-testid='calculators-repayment-result'
                        >
                            <FormattedMessage
                                id='calculators.repayments.result'
                                defaultMessage='Indicative repayment: {amount}'
                                values={{
                                    amount: (
                                        <FormattedNumber
                                            value={repayment}

                                            // eslint-disable-next-line react/style-prop-object
                                            style='currency'
                                            currency='AUD'
                                        />
                                    ),
                                }}
                            />
                        </p>
                    )}
                    <p className='Calculators__disclaimer'>
                        <FormattedMessage
                            id='calculators.disclaimer'
                            defaultMessage='This is not financial advice. Figures are indicative only.'
                        />
                    </p>
                </section>
                {OTHER_CALCULATOR_SECTIONS.map((section) => (
                    <section
                        key={section.id}
                        id={section.id}
                        className='Calculators__item'
                    >
                        <h3 className='Calculators__itemTitle'>
                            <FormattedMessage {...section.title}/>
                        </h3>
                        <p className='Calculators__itemBody'>
                            <FormattedMessage {...section.body}/>
                        </p>
                    </section>
                ))}
            </div>
        </div>
    );
}
