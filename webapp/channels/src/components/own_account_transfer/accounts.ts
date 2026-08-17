// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {OWN_ACCOUNT_IDS} from './types';
import type {OwnAccount, OwnAccountId, OwnAccountTransfer, OwnAccountTransferState, TransferResult} from './types';

export const OWN_ACCOUNT_TRANSFER_STORAGE_KEY = 'mm_own_account_transfer';

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'getItem' | 'setItem'>;

const SEED_ACCOUNTS: OwnAccount[] = [
    {
        id: 'youmoney',
        nameId: 'own_account_transfer.account.youmoney.name',
        name: 'YouMoney',
        typeId: 'own_account_transfer.account.youmoney.type',
        type: 'Transaction account',
        balanceCents: 428050,
    },
    {
        id: 'rapid-save',
        nameId: 'own_account_transfer.account.rapid_save.name',
        name: 'Rapid Save',
        typeId: 'own_account_transfer.account.rapid_save.type',
        type: 'Savings account',
        balanceCents: 1250000,
    },
    {
        id: 'online-account',
        nameId: 'own_account_transfer.account.online.name',
        name: 'Online Account',
        typeId: 'own_account_transfer.account.online.type',
        type: 'Transaction account',
        balanceCents: 89025,
    },
];

export function isOwnAccountId(value: string): value is OwnAccountId {
    return OWN_ACCOUNT_IDS.some((id) => id === value);
}

export function parseAmountCents(raw: string): number | null {
    const trimmed = raw.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
        return null;
    }

    const [dollars, cents = ''] = trimmed.split('.');
    const value = (Number(dollars) * 100) + Number(cents.padEnd(2, '0'));
    if (!Number.isInteger(value) || value <= 0) {
        return null;
    }

    return value;
}

export function formatNzdFromCents(amountCents: number): string {
    return new Intl.NumberFormat('en-NZ', {
        style: 'currency',
        currency: 'NZD',
    }).format(amountCents / 100);
}

export function seedOwnAccountTransferState(): OwnAccountTransferState {
    return {
        accounts: SEED_ACCOUNTS.map((account) => ({...account})),
        transfers: [],
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isParsedAccount(value: OwnAccount | null): value is OwnAccount {
    return value !== null;
}

function isParsedTransfer(value: OwnAccountTransfer | null): value is OwnAccountTransfer {
    return value !== null;
}

function parseStoredAccount(value: unknown): OwnAccount | null {
    if (!isRecord(value) || typeof value.id !== 'string' || !isOwnAccountId(value.id)) {
        return null;
    }
    if (typeof value.balanceCents !== 'number' || !Number.isInteger(value.balanceCents)) {
        return null;
    }

    const seed = SEED_ACCOUNTS.find((account) => account.id === value.id);
    if (!seed) {
        return null;
    }

    return {
        ...seed,
        balanceCents: value.balanceCents,
    };
}

function parseStoredTransfer(value: unknown): OwnAccountTransfer | null {
    if (!isRecord(value)) {
        return null;
    }
    if (typeof value.id !== 'string' || typeof value.createdAt !== 'string') {
        return null;
    }
    if (typeof value.fromAccountId !== 'string' || !isOwnAccountId(value.fromAccountId)) {
        return null;
    }
    if (typeof value.toAccountId !== 'string' || !isOwnAccountId(value.toAccountId)) {
        return null;
    }
    if (typeof value.amountCents !== 'number' || !Number.isInteger(value.amountCents) || value.amountCents <= 0) {
        return null;
    }

    return {
        id: value.id,
        fromAccountId: value.fromAccountId,
        toAccountId: value.toAccountId,
        amountCents: value.amountCents,
        createdAt: value.createdAt,
    };
}

export function loadOwnAccountTransferState(storage: ReadableStorage = localStorage): OwnAccountTransferState {
    const raw = storage.getItem(OWN_ACCOUNT_TRANSFER_STORAGE_KEY);
    if (!raw) {
        return seedOwnAccountTransferState();
    }

    try {
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed) || !Array.isArray(parsed.accounts) || !Array.isArray(parsed.transfers)) {
            return seedOwnAccountTransferState();
        }

        const accounts = parsed.accounts.map(parseStoredAccount);
        if (accounts.length !== SEED_ACCOUNTS.length || !accounts.every(isParsedAccount)) {
            return seedOwnAccountTransferState();
        }

        const transfers = parsed.transfers.map(parseStoredTransfer);
        if (!transfers.every(isParsedTransfer)) {
            return seedOwnAccountTransferState();
        }

        const ids = new Set(accounts.map((account) => account.id));
        if (SEED_ACCOUNTS.some((seed) => !ids.has(seed.id))) {
            return seedOwnAccountTransferState();
        }

        return {
            accounts,
            transfers,
        };
    } catch {
        return seedOwnAccountTransferState();
    }
}

export function saveOwnAccountTransferState(state: OwnAccountTransferState, storage: WritableStorage = localStorage): void {
    storage.setItem(OWN_ACCOUNT_TRANSFER_STORAGE_KEY, JSON.stringify(state));
}

export function applyOwnAccountTransfer(
    state: OwnAccountTransferState,
    fromAccountId: OwnAccountId,
    toAccountId: OwnAccountId,
    amountCents: number,
    now = new Date(),
): TransferResult {
    if (fromAccountId === toAccountId) {
        return {ok: false, error: 'same_account'};
    }
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
        return {ok: false, error: 'invalid_amount'};
    }

    const fromAccount = state.accounts.find((account) => account.id === fromAccountId);
    const toAccount = state.accounts.find((account) => account.id === toAccountId);
    if (!fromAccount || !toAccount) {
        return {ok: false, error: 'unknown_account'};
    }
    if (fromAccount.balanceCents < amountCents) {
        return {ok: false, error: 'insufficient'};
    }

    const transfer: OwnAccountTransfer = {
        id: `xfer-${now.getTime()}`,
        fromAccountId,
        toAccountId,
        amountCents,
        createdAt: now.toISOString(),
    };

    const nextState: OwnAccountTransferState = {
        accounts: state.accounts.map((account) => {
            if (account.id === fromAccountId) {
                return {...account, balanceCents: account.balanceCents - amountCents};
            }
            if (account.id === toAccountId) {
                return {...account, balanceCents: account.balanceCents + amountCents};
            }
            return account;
        }),
        transfers: [transfer, ...state.transfers],
    };

    return {ok: true, state: nextState, transfer};
}

export function submitOwnAccountTransfer(
    fromAccountId: OwnAccountId,
    toAccountId: OwnAccountId,
    amountRaw: string,
    storage: WritableStorage = localStorage,
    now = new Date(),
): TransferResult {
    const amountCents = parseAmountCents(amountRaw);
    if (amountCents === null) {
        return {ok: false, error: 'invalid_amount'};
    }

    const result = applyOwnAccountTransfer(
        loadOwnAccountTransferState(storage),
        fromAccountId,
        toAccountId,
        amountCents,
        now,
    );
    if (result.ok) {
        saveOwnAccountTransferState(result.state, storage);
    }

    return result;
}
