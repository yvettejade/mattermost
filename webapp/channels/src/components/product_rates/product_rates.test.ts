// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BANK_PRODUCTS, getRapidSaveProduct, RAPID_SAVE_PRODUCT_ID} from './product_rates';

describe('product_rates', () => {
    test('Rapid Save uses a single variable rate label with no bonus copy', () => {
        const rapidSave = getRapidSaveProduct();

        expect(rapidSave.id).toBe(RAPID_SAVE_PRODUCT_ID);
        expect(rapidSave.rateLabel).toBe('4.25% p.a. variable');
        expect(JSON.stringify(rapidSave).toLowerCase()).not.toContain('bonus');
    });

    test('every Rapid Save surface reads the same catalog entry', () => {
        const catalogMatches = BANK_PRODUCTS.filter((product) => product.id === RAPID_SAVE_PRODUCT_ID);

        expect(catalogMatches).toHaveLength(1);
        expect(catalogMatches[0].rateLabel).toBe(getRapidSaveProduct().rateLabel);
    });
});
