// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {searchSiteIndex} from './site_search_index';

describe('searchSiteIndex', () => {
    test('returns Tool results for repayments', () => {
        const results = searchSiteIndex('repayments');

        expect(results.length).toBeGreaterThan(0);
        expect(results.some((result) => result.kind === 'Tool' && result.href === '/calculators#repayments')).toBe(true);
    });

    test('returns Tool results for borrowing', () => {
        const results = searchSiteIndex('borrowing');

        expect(results.length).toBeGreaterThan(0);
        expect(results.some((result) => result.kind === 'Tool' && result.href === '/calculators#borrowing')).toBe(true);
    });

    test('returns Tool results for savings goal and foreign exchange', () => {
        const savings = searchSiteIndex('savings goal');
        const fx = searchSiteIndex('foreign exchange');

        expect(savings.some((result) => result.kind === 'Tool' && result.href === '/calculators#savings-goal')).toBe(true);
        expect(fx.some((result) => result.kind === 'Tool' && result.href === '/calculators#foreign-exchange')).toBe(true);
    });

    test('keeps product, support, news, and locate results', () => {
        expect(searchSiteIndex('home loan').some((result) => result.kind === 'Product')).toBe(true);
        expect(searchSiteIndex('password').some((result) => result.kind === 'Support')).toBe(true);
        expect(searchSiteIndex('cash rate').some((result) => result.kind === 'News')).toBe(true);
        expect(searchSiteIndex('sydney branch').some((result) => result.kind === 'Locate')).toBe(true);
    });

    test('returns no results for an empty query', () => {
        expect(searchSiteIndex('   ')).toEqual([]);
    });
});
