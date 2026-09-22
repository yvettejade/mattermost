// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const ACCOUNT_IDS = ['everyday', 'savings'] as const;
export const CARD_IDS = ['flexi-debit', 'credit'] as const;

export type AccountId = typeof ACCOUNT_IDS[number];
export type CardId = typeof CARD_IDS[number];

export type Account = {
    id: AccountId;
    nameId: string;
    name: string;
    number: string;
    availableCents: number;
};

export type Card = {
    id: CardId;
    nameId: string;
    name: string;
    lastFour: string;
    locked: boolean;
};

export type Payee = {
    id: string;
    name: string;
    accountNumber: string;
    referenceDefault: string;
    seeded: boolean;
};

export type PaymentStatus = 'sent' | 'scheduled';

export type Payment = {
    id: string;
    payeeName: string;
    payeeAccount: string;
    fromAccountId: AccountId;
    amountCents: number;
    reference: string;
    when: string;
    status: PaymentStatus;
};

export type CardsPaymentsState = {
    accounts: Account[];
    cards: Card[];
    payees: Payee[];
    payments: Payment[];
};

export type TransferError = 'same_account' | 'invalid_amount' | 'insufficient' | 'unknown_account';

export type PayError =
    | 'invalid_amount'
    | 'insufficient'
    | 'unknown_account'
    | 'invalid_payee'
    | 'invalid_account_number';

export type PayeeError = 'required' | 'invalid';

export type TransferResult =
    | {ok: true; state: CardsPaymentsState}
    | {ok: false; error: TransferError};

export type PayResult =
    | {ok: true; state: CardsPaymentsState; payment: Payment}
    | {ok: false; error: PayError};

export type AddPayeeResult =
    | {ok: true; state: CardsPaymentsState; payee: Payee}
    | {ok: false; field: 'name' | 'accountNumber'; reason: PayeeError};
