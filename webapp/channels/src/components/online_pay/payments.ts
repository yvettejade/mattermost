// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const PAY_ANYONE_STORAGE_KEY = 'mm_online_pay_anyone';
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
};

export type PayAnyoneState = {
    balances: Record<string, number>;
    payments: PayAnyonePayment[];
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

export function defaultBalances(): Record<string, number> {
    return Object.fromEntries(PAY_FROM_ACCOUNTS.map((account) => [account.id, account.available]));
}

export function getPayAnyoneState(storage: ReadableStorage = localStorage): PayAnyoneState {
    const raw = storage.getItem(PAY_ANYONE_STORAGE_KEY);
    if (!raw) {
        return {
            balances: defaultBalances(),
            payments: [],
        };
    }

    try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
            return {
                balances: defaultBalances(),
                payments: [],
            };
        }

        const record = parsed as {balances?: unknown; payments?: unknown};
        const balances = record.balances && typeof record.balances === 'object' && !Array.isArray(record.balances) ?
            {...defaultBalances(), ...(record.balances as Record<string, number>)} :
            defaultBalances();

        return {
            balances,
            payments: Array.isArray(record.payments) ? record.payments as PayAnyonePayment[] : [],
        };
    } catch {
        return {
            balances: defaultBalances(),
            payments: [],
        };
    }
}

export function getAccountBalance(accountId: string, storage: ReadableStorage = localStorage): number {
    const seeded = PAY_FROM_ACCOUNTS.find((account) => account.id === accountId)?.available ?? 0;
    return getPayAnyoneState(storage).balances[accountId] ?? seeded;
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
    };

    storage.setItem(PAY_ANYONE_STORAGE_KEY, JSON.stringify(nextState));
    return {ok: true, payment, state: nextState};
}
