// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const FX_CURRENCIES = ['AUD', 'USD', 'GBP', 'EUR'] as const;

export type FxCurrency = typeof FX_CURRENCIES[number];

export const DEMO_FX_RATES: Record<FxCurrency, number> = {
    AUD: 0.91,
    USD: 0.6,
    GBP: 0.47,
    EUR: 0.55,
};

export const DEMO_FX_FEE_NZD_CENTS = 900;

export type FxQuote = {
    sendNzdCents: number;
    feeNzdCents: number;
    convertibleNzdCents: number;
    rate: number;
    currency: FxCurrency;
    receiveMinorUnits: number;
};

export type FxQuoteError = 'invalid_amount' | 'amount_too_small';

export type FxQuoteResult =
    | {ok: true; quote: FxQuote}
    | {ok: false; error: FxQuoteError};

export function isFxCurrency(value: string): value is FxCurrency {
    return FX_CURRENCIES.some((currency) => currency === value);
}

export function parseAmountCents(raw: string): number | null {
    const trimmed = raw.trim();
    if (!(/^\d+(\.\d{1,2})?$/).test(trimmed)) {
        return null;
    }

    const [dollars, cents = ''] = trimmed.split('.');
    const value = (Number(dollars) * 100) + Number(cents.padEnd(2, '0'));
    if (!Number.isInteger(value) || value <= 0) {
        return null;
    }

    return value;
}

export function quoteNzdToForeign(sendNzdCents: number, currency: FxCurrency): FxQuote {
    const rate = DEMO_FX_RATES[currency];
    const feeNzdCents = DEMO_FX_FEE_NZD_CENTS;
    const convertibleNzdCents = Math.max(0, sendNzdCents - feeNzdCents);

    return {
        sendNzdCents,
        feeNzdCents,
        convertibleNzdCents,
        rate,
        currency,
        receiveMinorUnits: Math.round(convertibleNzdCents * rate),
    };
}

export function quoteFromAmountInput(raw: string, currency: FxCurrency): FxQuoteResult {
    const sendNzdCents = parseAmountCents(raw);
    if (sendNzdCents === null) {
        return {ok: false, error: 'invalid_amount'};
    }
    if (sendNzdCents <= DEMO_FX_FEE_NZD_CENTS) {
        return {ok: false, error: 'amount_too_small'};
    }

    return {ok: true, quote: quoteNzdToForeign(sendNzdCents, currency)};
}

export function formatNzdFromCents(amountCents: number): string {
    return new Intl.NumberFormat('en-NZ', {
        style: 'currency',
        currency: 'NZD',
    }).format(amountCents / 100);
}

export function formatForeignFromMinor(amountMinor: number, currency: FxCurrency): string {
    return new Intl.NumberFormat('en-NZ', {
        style: 'currency',
        currency,
    }).format(amountMinor / 100);
}

export function formatFxRate(rate: number, currency: FxCurrency): string {
    const formattedRate = new Intl.NumberFormat('en-NZ', {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
    }).format(rate);

    return `1 NZD = ${formattedRate} ${currency}`;
}
