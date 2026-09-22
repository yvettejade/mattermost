// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type BorrowingPowerInputs = {
    annualIncome: number;
    monthlyExpenses: number;
    monthlyLivingCosts: number;
    annualInterestRatePercent: number;
    termYears: number;
};

export const DEMO_BORROWING_ASSUMPTIONS: BorrowingPowerInputs = {
    annualIncome: 95000,
    monthlyExpenses: 450,
    monthlyLivingCosts: 2800,
    annualInterestRatePercent: 6.29,
    termYears: 30,
};

export function formatNzd(amount: number): string {
    return new Intl.NumberFormat('en-NZ', {
        style: 'currency',
        currency: 'NZD',
        maximumFractionDigits: 0,
    }).format(amount);
}

export function estimateBorrowingPower(inputs: BorrowingPowerInputs): number {
    const surplus = (inputs.annualIncome / 12) - inputs.monthlyExpenses - inputs.monthlyLivingCosts;
    if (surplus <= 0) {
        return 0;
    }

    const periods = inputs.termYears * 12;
    const monthlyRate = inputs.annualInterestRatePercent / 100 / 12;
    if (monthlyRate === 0) {
        return Math.round(surplus * periods);
    }

    const factor = (1 - ((1 + monthlyRate) ** -periods)) / monthlyRate;
    return Math.round(surplus * factor);
}
