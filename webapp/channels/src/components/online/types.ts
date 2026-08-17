// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const ACCOUNT_IDS = ['everyday', 'savings', 'credit-card', 'home-loan'] as const;

export type AccountId = typeof ACCOUNT_IDS[number];

export const RAPID_SAVE_ACCOUNT_ID: AccountId = 'savings';

export type AccountType = 'transaction' | 'savings' | 'credit' | 'loan';

export type Account = {
    id: AccountId;
    nameId: string;
    name: string;
    number: string;
    type: AccountType;
    availableCents: number;
};

export type SavingsGoal = {
    amountCents: number;
    label: string;
};

export type EverydayMoneySettings = {
    hideBalances: boolean;
};

export type EverydayMoneyState = {
    accounts: Account[];
    goals: Partial<Record<AccountId, SavingsGoal>>;
    settings: EverydayMoneySettings;
};
