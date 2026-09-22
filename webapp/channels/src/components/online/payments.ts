// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PAY_ANYONE_STORAGE_KEY, readStoredRecord, writeStoredPatch} from './storage';

export {PAY_ANYONE_STORAGE_KEY};

export const PAY_ANYONE_TIME_ZONE = 'Pacific/Auckland';
export const PAY_ANYONE_CURRENCY = 'NZD';

export type PayFromAccount = {
    id: string;
    name: {id: string; defaultMessage: string};
    number: string;
    available: number;
};

export const PAY_FROM_ACCOUNTS: PayFromAccount[] = [
    {
        id: 'ACC-1001',
        name: {
            id: 'online.pay.account.everyday',
            defaultMessage: 'Everyday',
        },
        number: '12-3456-7890123-00',
        available: 4280.55,
    },
    {
        id: 'ACC-1002',
        name: {
            id: 'online.pay.account.savings',
            defaultMessage: 'Savings',
        },
        number: '12-3456-7890123-01',
        available: 18640,
    },
];

export type PayAnyoneStatus = 'sent' | 'scheduled';

export type PayAnyonePayment = {
    id: string;
    payeeName: string;
    payeeAccount: string;
    fromAccountId: string;
    amount: number;
    reference: string;
    when: string;
    status: PayAnyoneStatus;
    createdAt: string;
};

export type PayAnyoneDraft = {
    payeeName: string;
    payeeAccount: string;
    fromAccountId: string;
    amount: number;
    reference: string;
    when: string;
    newPayee?: boolean;
};

export type OwnTransfer = {
    id: string;
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    when: string;
    status: PayAnyoneStatus;
    createdAt: string;
};

export type OwnTransferDraft = {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    when: string;
};

export type PayAnyoneState = {
    balances: Record<string, number>;
    payments: PayAnyonePayment[];
    transfers: OwnTransfer[];
};

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function todayInAuckland(now: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: PAY_ANYONE_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(now);
}

export function resolvePaymentDate(when: string, now: Date = new Date()): string {
    return when || todayInAuckland(now);
}

export function paymentStatus(when: string, now: Date = new Date()): PayAnyoneStatus {
    return resolvePaymentDate(when, now) > todayInAuckland(now) ? 'scheduled' : 'sent';
}

export function formatNzd(amount: number): string {
    return new Intl.NumberFormat('en-NZ', {
        style: 'currency',
        currency: PAY_ANYONE_CURRENCY,
    }).format(amount);
}

export function defaultBalances(): Record<string, number> {
    return Object.fromEntries(PAY_FROM_ACCOUNTS.map((account) => [account.id, account.available]));
}

function isPayment(value: unknown): value is PayAnyonePayment {
    return Boolean(value) && typeof value === 'object' && typeof (value as PayAnyonePayment).id === 'string';
}

function isTransfer(value: unknown): value is OwnTransfer {
    return Boolean(value) && typeof value === 'object' && typeof (value as OwnTransfer).id === 'string';
}

export function getPayAnyoneState(storage: ReadableStorage = localStorage): PayAnyoneState {
    const record = readStoredRecord(storage);
    const balances = record.balances && typeof record.balances === 'object' && !Array.isArray(record.balances) ?
        {...defaultBalances(), ...(record.balances as Record<string, number>)} :
        defaultBalances();

    return {
        balances,
        payments: Array.isArray(record.payments) ? record.payments.filter(isPayment) : [],
        transfers: Array.isArray(record.transfers) ? record.transfers.filter(isTransfer) : [],
    };
}

export function getAccountBalance(accountId: string, storage: ReadableStorage = localStorage): number {
    const seeded = PAY_FROM_ACCOUNTS.find((account) => account.id === accountId)?.available ?? 0;
    return getPayAnyoneState(storage).balances[accountId] ?? seeded;
}

function persistState(state: PayAnyoneState, storage: WritableStorage): void {
    writeStoredPatch({
        balances: state.balances,
        payments: state.payments,
        transfers: state.transfers,
    }, storage);
}

export function applyPayAnyonePayment(
    draft: PayAnyoneDraft,
    storage: WritableStorage = localStorage,
    now: Date = new Date(),
): {ok: true; payment: PayAnyonePayment; state: PayAnyoneState} | {ok: false; reason: 'unknown_account' | 'insufficient'} {
    const fromAccount = PAY_FROM_ACCOUNTS.find((account) => account.id === draft.fromAccountId);
    if (!fromAccount) {
        return {ok: false, reason: 'unknown_account'};
    }

    const state = getPayAnyoneState(storage);
    const available = state.balances[draft.fromAccountId] ?? fromAccount.available;
    const status = paymentStatus(draft.when, now);

    if (status === 'sent' && draft.amount > available) {
        return {ok: false, reason: 'insufficient'};
    }

    const when = resolvePaymentDate(draft.when, now);
    const payment: PayAnyonePayment = {
        id: `pay-${now.getTime()}`,
        payeeName: draft.payeeName.trim(),
        payeeAccount: draft.payeeAccount.trim(),
        fromAccountId: draft.fromAccountId,
        amount: draft.amount,
        reference: draft.reference.trim(),
        when,
        status,
        createdAt: now.toISOString(),
    };

    const nextState: PayAnyoneState = {
        balances: {
            ...state.balances,
            [draft.fromAccountId]: status === 'sent' ? Number((available - draft.amount).toFixed(2)) : available,
        },
        payments: [...state.payments, payment],
        transfers: state.transfers,
    };

    persistState(nextState, storage);
    return {ok: true, payment, state: nextState};
}

export function applyOwnTransfer(
    draft: OwnTransferDraft,
    storage: WritableStorage = localStorage,
    now: Date = new Date(),
): {ok: true; transfer: OwnTransfer; state: PayAnyoneState} | {ok: false; reason: 'same_account' | 'unknown_account' | 'insufficient'} {
    if (draft.fromAccountId === draft.toAccountId) {
        return {ok: false, reason: 'same_account'};
    }

    const fromAccount = PAY_FROM_ACCOUNTS.find((account) => account.id === draft.fromAccountId);
    const toAccount = PAY_FROM_ACCOUNTS.find((account) => account.id === draft.toAccountId);
    if (!fromAccount || !toAccount) {
        return {ok: false, reason: 'unknown_account'};
    }

    const state = getPayAnyoneState(storage);
    const fromAvailable = state.balances[draft.fromAccountId] ?? fromAccount.available;
    const toAvailable = state.balances[draft.toAccountId] ?? toAccount.available;
    const status = paymentStatus(draft.when, now);

    if (status === 'sent' && draft.amount > fromAvailable) {
        return {ok: false, reason: 'insufficient'};
    }

    const when = resolvePaymentDate(draft.when, now);
    const transfer: OwnTransfer = {
        id: `xfer-${now.getTime()}`,
        fromAccountId: draft.fromAccountId,
        toAccountId: draft.toAccountId,
        amount: draft.amount,
        when,
        status,
        createdAt: now.toISOString(),
    };

    const nextState: PayAnyoneState = {
        balances: status === 'sent' ? {
            ...state.balances,
            [draft.fromAccountId]: Number((fromAvailable - draft.amount).toFixed(2)),
            [draft.toAccountId]: Number((toAvailable + draft.amount).toFixed(2)),
        } : state.balances,
        payments: state.payments,
        transfers: [...state.transfers, transfer],
    };

    persistState(nextState, storage);
    return {ok: true, transfer, state: nextState};
}

export function scheduledItems(storage: ReadableStorage = localStorage): Array<
    | {kind: 'payment'; item: PayAnyonePayment}
    | {kind: 'transfer'; item: OwnTransfer}
> {
    const state = getPayAnyoneState(storage);
    return [
        ...state.payments.filter((payment) => payment.status === 'scheduled').map((item) => ({kind: 'payment' as const, item})),
        ...state.transfers.filter((transfer) => transfer.status === 'scheduled').map((item) => ({kind: 'transfer' as const, item})),
    ];
}
