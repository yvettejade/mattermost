// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const RAPID_SAVE_PRODUCT_ID = 'rapid-save';

export type BankProduct = {
    id: string;
    name: string;
    rateLabel: string;
    summary: string;
    rules: string[];
};

export const BANK_PRODUCTS: BankProduct[] = [
    {
        id: RAPID_SAVE_PRODUCT_ID,
        name: 'Rapid Save',
        rateLabel: '4.25% p.a. variable',
        summary: 'A savings account that pays a single variable rate.',
        rules: [
            'Variable rate credited monthly.',
            'Withdrawals available at any time.',
        ],
    },
    {
        id: 'youmoney',
        name: 'YouMoney',
        rateLabel: '0.05% p.a. variable',
        summary: 'Everyday spending with a debit card.',
        rules: [
            'No monthly account fee.',
            'Debit card included.',
        ],
    },
];

export function getBankProduct(id: string): BankProduct | undefined {
    return BANK_PRODUCTS.find((product) => product.id === id);
}

export function getRapidSaveProduct(): BankProduct {
    const product = getBankProduct(RAPID_SAVE_PRODUCT_ID);
    if (!product) {
        throw new Error('Rapid Save is missing from BANK_PRODUCTS');
    }
    return product;
}
