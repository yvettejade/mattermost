// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const EXAMPLE_HOME_LOAN_PRINCIPAL = 500_000;
export const EXAMPLE_HOME_LOAN_TERM_YEARS = 30;
export const EXAMPLE_HOME_LOAN_OCCUPANCY = 'owner-occupied';

export const CALCULATORS_REPAYMENTS_HREF = '/calculators#repayments';

export type RepaymentFrequency = 'weekly' | 'fortnightly' | 'monthly';

export const PERIODS_PER_YEAR: Record<RepaymentFrequency, number> = {
    weekly: 52,
    fortnightly: 26,
    monthly: 12,
};

export type CalculateRepaymentParams = {
    principal: number;
    annualRatePercent: number;
    termYears: number;
    frequency: RepaymentFrequency;
};

export function roundToCents(amount: number): number {
    return Math.round(amount * 100) / 100;
}

export function calculateRepayment({
    principal,
    annualRatePercent,
    termYears,
    frequency,
}: CalculateRepaymentParams): number {
    const periodsPerYear = PERIODS_PER_YEAR[frequency];
    const periods = termYears * periodsPerYear;
    if (principal <= 0 || termYears <= 0 || periods <= 0) {
        return 0;
    }

    const periodicRate = (annualRatePercent / 100) / periodsPerYear;
    if (periodicRate === 0) {
        return roundToCents(principal / periods);
    }

    const growth = Math.pow(1 + periodicRate, periods);
    return roundToCents((principal * periodicRate * growth) / (growth - 1));
}

export function indicativeWeeklyRepayment(annualRatePercent: number): number {
    return calculateRepayment({
        principal: EXAMPLE_HOME_LOAN_PRINCIPAL,
        annualRatePercent,
        termYears: EXAMPLE_HOME_LOAN_TERM_YEARS,
        frequency: 'weekly',
    });
}
