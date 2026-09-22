// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const FEATURED_HOME_LOAN_SPECIAL_ID = 'fixed-2-owner';
export const HOME_LOANS_RATES_HASH = 'home-loans';

export type HomeLoanOccupancy = 'owner-occupied' | 'investment';
export type HomeLoanRateType = 'fixed' | 'variable';

export type HomeLoanSpecial = {
    id: string;
    name: string;
    annualRatePercent: number;
    comparisonRatePercent: number;
    termYears: number;
    occupancy: HomeLoanOccupancy;
    rateType: HomeLoanRateType;
};

export const HOME_LOAN_SMALL_PRINT = {
    establishmentFee: '$600 establishment fee',
    terms: 'Terms and conditions apply. Owner-occupied specials are principal and interest. Comparison rates are based on a $150,000 loan over 25 years.',
};

export const HOME_LOAN_SPECIALS: HomeLoanSpecial[] = [
    {
        id: FEATURED_HOME_LOAN_SPECIAL_ID,
        name: '2-year owner-occupied',
        annualRatePercent: 4.79,
        comparisonRatePercent: 5.21,
        termYears: 2,
        occupancy: 'owner-occupied',
        rateType: 'fixed',
    },
    {
        id: 'fixed-1-owner',
        name: '1-year fixed',
        annualRatePercent: 4.99,
        comparisonRatePercent: 5.28,
        termYears: 1,
        occupancy: 'owner-occupied',
        rateType: 'fixed',
    },
    {
        id: 'fixed-3-owner',
        name: '3-year owner-occupied',
        annualRatePercent: 4.89,
        comparisonRatePercent: 5.24,
        termYears: 3,
        occupancy: 'owner-occupied',
        rateType: 'fixed',
    },
];

export function formatHomeLoanRateLabel(special: HomeLoanSpecial): string {
    return `${special.annualRatePercent.toFixed(2)}% p.a.`;
}

export function formatHomeLoanComparisonLabel(special: HomeLoanSpecial): string {
    return `${special.comparisonRatePercent.toFixed(2)}% p.a. comparison`;
}

export function formatHomeLoanTermLabel(special: HomeLoanSpecial): string {
    return `${special.termYears}-year ${special.rateType}`;
}

export function formatHomeLoanSpecialLine(special: HomeLoanSpecial): string {
    return `${formatHomeLoanRateLabel(special)} ${special.termYears}-year ${special.occupancy}`;
}

export function getHomeLoanSpecial(id: string): HomeLoanSpecial | undefined {
    return HOME_LOAN_SPECIALS.find((special) => special.id === id);
}

export function getFeaturedHomeLoanSpecial(): HomeLoanSpecial {
    const special = getHomeLoanSpecial(FEATURED_HOME_LOAN_SPECIAL_ID);
    if (!special) {
        throw new Error('Featured home-loan special is missing from HOME_LOAN_SPECIALS');
    }
    return special;
}
