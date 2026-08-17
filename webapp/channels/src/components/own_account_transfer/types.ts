// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const OWN_ACCOUNT_IDS = ['youmoney', 'rapid-save', 'online-account'] as const;

export type OwnAccountId = typeof OWN_ACCOUNT_IDS[number];

export type OwnAccount = {
    id: OwnAccountId;
    nameId: string;
    name: string;
    typeId: string;
    type: string;
    balanceCents: number;
};

export type OwnAccountTransfer = {
    id: string;
    fromAccountId: OwnAccountId;
    toAccountId: OwnAccountId;
    amountCents: number;
    createdAt: string;
};

export type OwnAccountTransferState = {
    accounts: OwnAccount[];
    transfers: OwnAccountTransfer[];
};

export type TransferError = 'same_account' | 'invalid_amount' | 'insufficient' | 'unknown_account';

export type TransferResult =
    | {ok: true; state: OwnAccountTransferState; transfer: OwnAccountTransfer}
    | {ok: false; error: TransferError};
