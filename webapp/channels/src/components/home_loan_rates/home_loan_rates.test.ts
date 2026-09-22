// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    FEATURED_HOME_LOAN_SPECIAL_ID,
    formatHomeLoanSpecialLine,
    getFeaturedHomeLoanSpecial,
    HOME_LOAN_SMALL_PRINT,
    HOME_LOAN_SPECIALS,
} from './home_loan_rates';

describe('home_loan_rates', () => {
    test('featured special is the 2-year owner-occupied rate', () => {
        const featured = getFeaturedHomeLoanSpecial();

        expect(featured.id).toBe(FEATURED_HOME_LOAN_SPECIAL_ID);
        expect(featured.annualRatePercent).toBe(4.79);
        expect(featured.termYears).toBe(2);
        expect(featured.occupancy).toBe('owner-occupied');
        expect(formatHomeLoanSpecialLine(featured)).toBe('4.79% p.a. 2-year owner-occupied');
    });

    test('catalog has a single featured entry and shared small print', () => {
        const featuredMatches = HOME_LOAN_SPECIALS.filter((special) => special.id === FEATURED_HOME_LOAN_SPECIAL_ID);

        expect(featuredMatches).toHaveLength(1);
        expect(featuredMatches[0]).toEqual(getFeaturedHomeLoanSpecial());
        expect(HOME_LOAN_SMALL_PRINT.establishmentFee).toBe('$600 establishment fee');
        expect(HOME_LOAN_SMALL_PRINT.terms).toContain('Terms and conditions apply');
    });
});
