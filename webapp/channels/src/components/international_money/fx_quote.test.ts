// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    DEMO_FX_FEE_NZD_CENTS,
    DEMO_FX_RATES,
    formatForeignFromMinor,
    formatFxRate,
    formatNzdFromCents,
    isFxCurrency,
    parseAmountCents,
    quoteFromAmountInput,
    quoteNzdToForeign,
} from './fx_quote';

describe('fx_quote', () => {
    test('quotes NZD to AUD after the flat demo fee', () => {
        const quote = quoteNzdToForeign(100000, 'AUD');

        expect(quote.feeNzdCents).toBe(DEMO_FX_FEE_NZD_CENTS);
        expect(quote.convertibleNzdCents).toBe(99100);
        expect(quote.rate).toBe(DEMO_FX_RATES.AUD);
        expect(quote.receiveMinorUnits).toBe(90181);
        expect(formatForeignFromMinor(quote.receiveMinorUnits, 'AUD')).toBe('A$901.81');
        expect(formatFxRate(quote.rate, 'AUD')).toBe('1 NZD = 0.9100 AUD');
    });

    test('covers the minimum demo currencies from one rate table', () => {
        expect(quoteNzdToForeign(100000, 'USD').receiveMinorUnits).toBe(59460);
        expect(quoteNzdToForeign(100000, 'GBP').receiveMinorUnits).toBe(46577);
        expect(quoteNzdToForeign(100000, 'EUR').receiveMinorUnits).toBe(54505);
    });

    test('quoteFromAmountInput reuses quoteNzdToForeign', () => {
        expect(quoteFromAmountInput('1000', 'AUD')).toEqual({
            ok: true,
            quote: quoteNzdToForeign(100000, 'AUD'),
        });
        expect(quoteFromAmountInput('9', 'USD')).toEqual({ok: false, error: 'amount_too_small'});
        expect(quoteFromAmountInput('abc', 'GBP')).toEqual({ok: false, error: 'invalid_amount'});
    });

    test('parseAmountCents accepts dollars and cents', () => {
        expect(parseAmountCents('250')).toBe(25000);
        expect(parseAmountCents('12.5')).toBe(1250);
        expect(parseAmountCents('0.09')).toBe(9);
        expect(parseAmountCents('0')).toBeNull();
        expect(parseAmountCents('12.345')).toBeNull();
    });

    test('isFxCurrency accepts the demo table only', () => {
        expect(isFxCurrency('AUD')).toBe(true);
        expect(isFxCurrency('JPY')).toBe(false);
    });

    test('formatNzdFromCents uses en-NZ currency', () => {
        expect(formatNzdFromCents(900)).toBe('$9.00');
    });
});
