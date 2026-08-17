// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const PAY_ANYONE_STORAGE_KEY = 'mm_online_pay_anyone';
export const PAY_ANYONE_TIME_ZONE = 'Pacific/Auckland';
export const PAY_ANYONE_CURRENCY = 'NZD';
export const PAY_ANYONE_MAX_MONTHS_AHEAD = 12;

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

export type PaymentDateError = 'past' | 'too_far';

export type ApplyPayAnyoneFailure = 'unknown_account' | 'insufficient' | PaymentDateError;

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isPayAnyoneStatus(value: unknown): value is PayAnyoneStatus {
    return value === 'sent' || value === 'scheduled';
}

function isPayAnyonePayment(value: unknown): value is PayAnyonePayment {
    if (!isRecord(value)) {
        return false;
    }

    return typeof value.id === 'string' &&
        typeof value.payeeName === 'string' &&
        typeof value.payeeAccount === 'string' &&
        typeof value.fromAccountId === 'string' &&
        typeof value.amount === 'number' &&
        Number.isFinite(value.amount) &&
        typeof value.reference === 'string' &&
        typeof value.when === 'string' &&
        isPayAnyoneStatus(value.status) &&
        typeof value.createdAt === 'string';
}

export function todayInAuckland(now: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: PAY_ANYONE_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(now);
}

export function addCalendarMonths(isoDate: string, months: number): string {
    const [year, month, day] = isoDate.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1 + months, day)).toISOString().slice(0, 10);
}

export function maxPaymentDate(now: Date = new Date()): string {
    return addCalendarMonths(todayInAuckland(now), PAY_ANYONE_MAX_MONTHS_AHEAD);
}

export function resolvePaymentDate(when: string, now: Date = new Date()): string {
    return when || todayInAuckland(now);
}

export function paymentStatus(when: string, now: Date = new Date()): PayAnyoneStatus {
    return resolvePaymentDate(when, now) > todayInAuckland(now) ? 'scheduled' : 'sent';
}

export function validatePaymentDate(when: string, now: Date = new Date()): PaymentDateError | null {
    const date = resolvePaymentDate(when, now);
    const today = todayInAuckland(now);
    if (date < today) {
        return 'past';
    }
    if (date > maxPaymentDate(now)) {
        return 'too_far';
    }
    return null;
}

const MONTH_MMM = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function formatPaymentDateDisplay(isoDate: string): string {
    const [year, month, day] = isoDate.split('-').map(Number);
    return `${String(day).padStart(2, '0')} ${MONTH_MMM[month - 1]} ${year}`;
}

export function defaultBalances(): Record<string, number> {
    return Object.fromEntries(PAY_FROM_ACCOUNTS.map((account) => [account.id, account.available]));
}

export function emptyPayAnyoneState(): PayAnyoneState {
    return {
        balances: defaultBalances(),
        payments: [],
    };
}

export function getPayAnyoneState(storage: ReadableStorage = localStorage): PayAnyoneState {
    const raw = storage.getItem(PAY_ANYONE_STORAGE_KEY);
    if (!raw) {
        return emptyPayAnyoneState();
    }

    try {
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed)) {
            return emptyPayAnyoneState();
        }

        const balances = isRecord(parsed.balances) && !Array.isArray(parsed.balances) ?
            {...defaultBalances(), ...Object.fromEntries(
                Object.entries(parsed.balances).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
            )} :
            defaultBalances();

        const payments = Array.isArray(parsed.payments) ? parsed.payments.filter(isPayAnyonePayment) : [];

        return {balances, payments};
    } catch {
        return emptyPayAnyoneState();
    }
}

export function getAccountBalance(accountId: string, storage: ReadableStorage = localStorage): number {
    const seeded = PAY_FROM_ACCOUNTS.find((account) => account.id === accountId)?.available ?? 0;
    return getPayAnyoneState(storage).balances[accountId] ?? seeded;
}

export function listScheduledPayments(payments: PayAnyonePayment[], fromAccountId?: string): PayAnyonePayment[] {
    return payments.
        filter((payment) => payment.status === 'scheduled' && (!fromAccountId || payment.fromAccountId === fromAccountId)).
        sort((left, right) => left.when.localeCompare(right.when) || left.createdAt.localeCompare(right.createdAt));
}

export function resetPayAnyoneState(storage: WritableStorage = localStorage): PayAnyoneState {
    storage.removeItem(PAY_ANYONE_STORAGE_KEY);
    return emptyPayAnyoneState();
}

export function applyPayAnyonePayment(
    draft: PayAnyoneDraft,
    storage: WritableStorage = localStorage,
    now: Date = new Date(),
): {ok: true; payment: PayAnyonePayment; state: PayAnyoneState} | {ok: false; reason: ApplyPayAnyoneFailure} {
    const fromAccount = PAY_FROM_ACCOUNTS.find((account) => account.id === draft.fromAccountId);
    if (!fromAccount) {
        return {ok: false, reason: 'unknown_account'};
    }

    const dateError = validatePaymentDate(draft.when, now);
    if (dateError) {
        return {ok: false, reason: dateError};
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
