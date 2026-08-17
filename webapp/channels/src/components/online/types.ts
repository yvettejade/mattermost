// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const ACCOUNT_IDS = ['everyday', 'savings', 'credit-card', 'home-loan'] as const;

export type AccountId = typeof ACCOUNT_IDS[number];

export type AccountType = 'transaction' | 'savings' | 'credit' | 'loan';

export type Account = {
    id: AccountId;
    nameId: string;
    name: string;
    number: string;
    type: AccountType;
    availableCents: number;
    transferable: boolean;
};

export type TransactionKind = 'spend' | 'income' | 'transfer' | 'payment' | 'scheduled';

export type Transaction = {
    id: string;
    accountId: AccountId;
    description: string;
    amountCents: number;
    date: string;
    kind: TransactionKind;
    scheduled: boolean;
};

export type Payee = {
    id: string;
    name: string;
    accountNumber: string;
};

export type EverydayMoneySettings = {
    hideBalances: boolean;
    paymentAlerts: boolean;
};

export type EverydayMoneyState = {
    accounts: Account[];
    transactions: Transaction[];
    payees: Payee[];
    settings: EverydayMoneySettings;
};

export type TransferError = 'same_account' | 'invalid_amount' | 'insufficient' | 'unknown_account';

export type PayError = 'invalid_amount' | 'insufficient' | 'unknown_account' | 'invalid_payee' | 'invalid_account_number';

export type TransferResult =
    | {ok: true; state: EverydayMoneyState}
    | {ok: false; error: TransferError};

export type PayResult =
    | {ok: true; state: EverydayMoneyState}
    | {ok: false; error: PayError};
