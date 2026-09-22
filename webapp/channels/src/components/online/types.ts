// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const ACCOUNT_IDS = ['everyday', 'savings'] as const;

export type AccountId = typeof ACCOUNT_IDS[number];

export type Account = {
    id: AccountId;
    nameId: string;
    name: string;
    number: string;
};

export type Transaction = {
    id: string;
    accountId: AccountId;
    date: string;
    description: string;
    merchant: string;
    category: string;
    amountCents: number;
};

export type TransactionFilter = {
    query: string;
    category: string;
};
