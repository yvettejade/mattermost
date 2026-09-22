// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type AccountKind = 'transaction' | 'credit';

export type TransactionKind = 'spend' | 'income' | 'transfer';

export type DemoTransaction = {
    id: string;
    accountKind: AccountKind;
    category: string;
    amount: number;
    type: TransactionKind;
    date: string;
};

export type SpendCategoryTotal = {
    category: string;
    amount: number;
    percent: number;
};

export type OtherThisMonth = {
    kind: Exclude<TransactionKind, 'spend'>;
    amount: number;
};

export type ThisMonthSpendSummary = {
    spend: SpendCategoryTotal[];
    spendTotal: number;
    other: OtherThisMonth[];
};
