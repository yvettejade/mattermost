// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import Header from 'components/widgets/header';

import {
    DEMO_BORROWING_ASSUMPTIONS,
    estimateBorrowingPower,
    formatNzd,
} from './borrowing_power';

import './calculators.scss';

export default function Calculators() {
    const [annualIncome, setAnnualIncome] = useState(String(DEMO_BORROWING_ASSUMPTIONS.annualIncome));
    const [monthlyExpenses, setMonthlyExpenses] = useState(String(DEMO_BORROWING_ASSUMPTIONS.monthlyExpenses));
    const [monthlyLivingCosts, setMonthlyLivingCosts] = useState(String(DEMO_BORROWING_ASSUMPTIONS.monthlyLivingCosts));
    const [annualInterestRatePercent, setAnnualInterestRatePercent] = useState(String(DEMO_BORROWING_ASSUMPTIONS.annualInterestRatePercent));

    const estimate = useMemo(() => {
        return estimateBorrowingPower({
            annualIncome: Number(annualIncome) || 0,
            monthlyExpenses: Number(monthlyExpenses) || 0,
            monthlyLivingCosts: Number(monthlyLivingCosts) || 0,
            annualInterestRatePercent: Number(annualInterestRatePercent) || 0,
            termYears: DEMO_BORROWING_ASSUMPTIONS.termYears,
        });
    }, [annualIncome, annualInterestRatePercent, monthlyExpenses, monthlyLivingCosts]);

    const handleIncomeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setAnnualIncome(event.target.value);
    }, []);

    const handleExpensesChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setMonthlyExpenses(event.target.value);
    }, []);

    const handleLivingCostsChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setMonthlyLivingCosts(event.target.value);
    }, []);

    const handleRateChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setAnnualInterestRatePercent(event.target.value);
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
                        defaultMessage='Estimate borrowing power'
                    />
                }
            />
            <div className='Calculators__main'>
                <section
                    id='borrowing'
                    className='Calculators__section'
                    aria-labelledby='calculators-borrowing-heading'
                >
                    <h3
                        id='calculators-borrowing-heading'
                        className='Calculators__sectionTitle'
                    >
                        <FormattedMessage
                            id='calculators.borrowing.title'
                            defaultMessage='Borrowing power'
                        />
                    </h3>
                    <p className='Calculators__sectionBody'>
                        <FormattedMessage
                            id='calculators.borrowing.body'
                            defaultMessage='Estimate how much you may be able to borrow.'
                        />
                    </p>
                    <form
                        className='Calculators__form'
                        aria-labelledby='calculators-borrowing-heading'
                    >
                        <label
                            className='Calculators__field'
                            htmlFor='calculators-borrowing-income'
                        >
                            <span className='Calculators__label'>
                                <FormattedMessage
                                    id='calculators.borrowing.income'
                                    defaultMessage='Annual income'
                                />
                            </span>
                            <input
                                id='calculators-borrowing-income'
                                type='text'
                                inputMode='decimal'
                                autoComplete='off'
                                value={annualIncome}
                                onChange={handleIncomeChange}
                            />
                        </label>
                        <label
                            className='Calculators__field'
                            htmlFor='calculators-borrowing-expenses'
                        >
                            <span className='Calculators__label'>
                                <FormattedMessage
                                    id='calculators.borrowing.expenses'
                                    defaultMessage='Monthly expenses'
                                />
                            </span>
                            <input
                                id='calculators-borrowing-expenses'
                                type='text'
                                inputMode='decimal'
                                autoComplete='off'
                                value={monthlyExpenses}
                                onChange={handleExpensesChange}
                            />
                        </label>
                        <label
                            className='Calculators__field'
                            htmlFor='calculators-borrowing-living-costs'
                        >
                            <span className='Calculators__label'>
                                <FormattedMessage
                                    id='calculators.borrowing.living_costs'
                                    defaultMessage='Monthly living costs'
                                />
                            </span>
                            <input
                                id='calculators-borrowing-living-costs'
                                type='text'
                                inputMode='decimal'
                                autoComplete='off'
                                value={monthlyLivingCosts}
                                onChange={handleLivingCostsChange}
                            />
                        </label>
                        <label
                            className='Calculators__field'
                            htmlFor='calculators-borrowing-rate'
                        >
                            <span className='Calculators__label'>
                                <FormattedMessage
                                    id='calculators.borrowing.rate'
                                    defaultMessage='Interest rate (% p.a.)'
                                />
                            </span>
                            <input
                                id='calculators-borrowing-rate'
                                type='text'
                                inputMode='decimal'
                                autoComplete='off'
                                value={annualInterestRatePercent}
                                onChange={handleRateChange}
                            />
                        </label>
                    </form>
                    <p
                        className='Calculators__estimate'
                        role='status'
                        aria-live='polite'
                    >
                        <FormattedMessage
                            id='calculators.borrowing.estimate'
                            defaultMessage='Estimated borrowing power: {amount}'
                            values={{amount: formatNzd(estimate)}}
                        />
                    </p>
                    <aside
                        className='Calculators__disclosure'
                        aria-labelledby='calculators-borrowing-assumptions-heading'
                    >
                        <h4
                            id='calculators-borrowing-assumptions-heading'
                            className='Calculators__disclosureTitle'
                        >
                            <FormattedMessage
                                id='calculators.borrowing.assumptions.title'
                                defaultMessage='Assumptions'
                            />
                        </h4>
                        <ul className='Calculators__assumptions'>
                            <li>
                                <FormattedMessage
                                    id='calculators.borrowing.assumptions.income'
                                    defaultMessage='Example income: {amount} a year'
                                    values={{amount: formatNzd(DEMO_BORROWING_ASSUMPTIONS.annualIncome)}}
                                />
                            </li>
                            <li>
                                <FormattedMessage
                                    id='calculators.borrowing.assumptions.expenses'
                                    defaultMessage='Expenses: {amount} a month'
                                    values={{amount: formatNzd(DEMO_BORROWING_ASSUMPTIONS.monthlyExpenses)}}
                                />
                            </li>
                            <li>
                                <FormattedMessage
                                    id='calculators.borrowing.assumptions.living_costs'
                                    defaultMessage='Living costs: {amount} a month'
                                    values={{amount: formatNzd(DEMO_BORROWING_ASSUMPTIONS.monthlyLivingCosts)}}
                                />
                            </li>
                            <li>
                                <FormattedMessage
                                    id='calculators.borrowing.assumptions.rate'
                                    defaultMessage='Interest rate used: {rate}% p.a.'
                                    values={{rate: DEMO_BORROWING_ASSUMPTIONS.annualInterestRatePercent}}
                                />
                            </li>
                        </ul>
                        <p className='Calculators__disclaimer'>
                            <FormattedMessage
                                id='calculators.borrowing.disclaimer'
                                defaultMessage='This estimate is not a quote or approval. Lending criteria apply. This is not legal or financial advice.'
                            />
                        </p>
                    </aside>
                </section>
            </div>
        </div>
    );
}
