// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const ACCOUNT_IDS = ['youmoney', 'rapid-save'] as const;

export type AccountId = typeof ACCOUNT_IDS[number];

export type DateRangePreset = '' | 'this-month' | 'last-30' | 'last-90' | 'custom';

export type DemoTransaction = {
    id: string;
    accountId: AccountId;
    description: string;
    category: string;
    amount: number;
    date: string;
};

export type TransactionFilters = {
    query: string;
    category: string;
    datePreset: DateRangePreset;
    customFrom: string;
    customTo: string;
};

export type ResolvedDateRange =
    | {kind: 'none'}
    | {kind: 'range'; from: string; to: string}
    | {kind: 'invalid'};
