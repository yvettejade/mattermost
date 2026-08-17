// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type HomeLoanSpecial = {
    id: string;
    name: {id: string; defaultMessage: string};
    rateType: {id: string; defaultMessage: string};
    annualRatePercent: number;
    comparisonRatePercent: number;
};

export const HOME_LOAN_SPECIALS: HomeLoanSpecial[] = [
    {
        id: 'special-variable',
        name: {
            id: 'home_loans.special.variable',
            defaultMessage: 'Special variable',
        },
        rateType: {
            id: 'home_loans.rate_type.variable',
            defaultMessage: 'Variable',
        },
        annualRatePercent: 5.99,
        comparisonRatePercent: 6.12,
    },
    {
        id: 'fixed-1',
        name: {
            id: 'home_loans.special.fixed_1',
            defaultMessage: '1 year fixed',
        },
        rateType: {
            id: 'home_loans.rate_type.fixed',
            defaultMessage: 'Fixed',
        },
        annualRatePercent: 5.69,
        comparisonRatePercent: 6.05,
    },
    {
        id: 'fixed-2',
        name: {
            id: 'home_loans.special.fixed_2',
            defaultMessage: '2 year fixed',
        },
        rateType: {
            id: 'home_loans.rate_type.fixed',
            defaultMessage: 'Fixed',
        },
        annualRatePercent: 5.79,
        comparisonRatePercent: 6.08,
    },
    {
        id: 'fixed-3',
        name: {
            id: 'home_loans.special.fixed_3',
            defaultMessage: '3 year fixed',
        },
        rateType: {
            id: 'home_loans.rate_type.fixed',
            defaultMessage: 'Fixed',
        },
        annualRatePercent: 5.89,
        comparisonRatePercent: 6.10,
    },
];
