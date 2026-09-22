// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    calculateRepayment,
    EXAMPLE_HOME_LOAN_PRINCIPAL,
    EXAMPLE_HOME_LOAN_TERM_YEARS,
    indicativeWeeklyRepayment,
} from './repayment_math';

describe('calculators/repayment_math', () => {
    test('splits a zero-rate loan evenly across weekly periods', () => {
        expect(calculateRepayment({
            principal: EXAMPLE_HOME_LOAN_PRINCIPAL,
            annualRatePercent: 0,
            termYears: EXAMPLE_HOME_LOAN_TERM_YEARS,
            frequency: 'weekly',
        })).toBe(320.51);
    });

    test('uses reducing-balance PMT for a known weekly example', () => {
        expect(calculateRepayment({
            principal: EXAMPLE_HOME_LOAN_PRINCIPAL,
            annualRatePercent: 6,
            termYears: EXAMPLE_HOME_LOAN_TERM_YEARS,
            frequency: 'weekly',
        })).toBe(691.32);
    });

    test('scales the same principal across weekly, fortnightly, and monthly', () => {
        const shared = {
            principal: EXAMPLE_HOME_LOAN_PRINCIPAL,
            annualRatePercent: 6,
            termYears: EXAMPLE_HOME_LOAN_TERM_YEARS,
        };

        const weekly = calculateRepayment({...shared, frequency: 'weekly'});
        const fortnightly = calculateRepayment({...shared, frequency: 'fortnightly'});
        const monthly = calculateRepayment({...shared, frequency: 'monthly'});

        expect(fortnightly).toBeGreaterThan(weekly);
        expect(monthly).toBeGreaterThan(fortnightly);
        expect(weekly * 52).toBeCloseTo(monthly * 12, -2);
    });

    test('indicative weekly repayment is the advertised example', () => {
        expect(indicativeWeeklyRepayment(6)).toBe(calculateRepayment({
            principal: EXAMPLE_HOME_LOAN_PRINCIPAL,
            annualRatePercent: 6,
            termYears: EXAMPLE_HOME_LOAN_TERM_YEARS,
            frequency: 'weekly',
        }));
    });
});
