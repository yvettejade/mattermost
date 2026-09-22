// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ACCOUNT_IDS} from './types';
import type {
    Account,
    AccountId,
    EverydayMoneySettings,
    EverydayMoneyState,
    Payee,
    PayResult,
    Transaction,
    TransferResult,
} from './types';

export const EVERYDAY_MONEY_STORAGE_KEY = 'mm_everyday_money';

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'getItem' | 'setItem'>;

const SEED_ACCOUNTS: Account[] = [
    {
        id: 'everyday',
        nameId: 'online.account.everyday',
        name: 'Everyday',
        number: '012-345 6789',
        type: 'transaction',
        availableCents: 428055,
        transferable: true,
    },
    {
        id: 'savings',
        nameId: 'online.account.savings',
        name: 'Savings',
        number: '012-345 6790',
        type: 'savings',
        availableCents: 1864000,
        transferable: true,
    },
    {
        id: 'credit-card',
        nameId: 'online.account.credit_card',
        name: 'Credit card',
        number: '4321',
        type: 'credit',
        availableCents: -61240,
        transferable: false,
    },
    {
        id: 'home-loan',
        nameId: 'online.account.home_loan',
        name: 'Home loan',
        number: '012-345 6792',
        type: 'loan',
        availableCents: -41200000,
        transferable: false,
    },
];

const SEED_PAYEES: Payee[] = [
    {
        id: 'payee-alex',
        name: 'Alex Chen',
        accountNumber: '12345678',
    },
];

function padMonth(month: number): string {
    return String(month).padStart(2, '0');
}

export function getYearMonth(date: Date): {year: number; month: number} {
    return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
    };
}

function nextMonth(year: number, month: number): {year: number; month: number} {
    if (month === 12) {
        return {year: year + 1, month: 1};
    }

    return {year, month: month + 1};
}

export function seedTransactions(now = new Date()): Transaction[] {
    const {year, month} = getYearMonth(now);
    const upcoming = nextMonth(year, month);
    const thisMonth = `${year}-${padMonth(month)}`;
    const next = `${upcoming.year}-${padMonth(upcoming.month)}`;

    return [
        {id: 'tx-groceries', accountId: 'everyday', description: 'Groceries — Woolworths', amountCents: -18640, date: `${thisMonth}-03`, kind: 'spend', scheduled: false},
        {id: 'tx-bills', accountId: 'everyday', description: 'Electricity bill', amountCents: -12900, date: `${thisMonth}-02`, kind: 'spend', scheduled: false},
        {id: 'tx-income', accountId: 'everyday', description: 'Salary', amountCents: 420000, date: `${thisMonth}-01`, kind: 'income', scheduled: false},
        {id: 'tx-transfer-seed', accountId: 'everyday', description: 'Transfer to Savings', amountCents: -25000, date: `${thisMonth}-08`, kind: 'transfer', scheduled: false},
        {id: 'tx-rent', accountId: 'everyday', description: 'Rent', amountCents: -120000, date: `${thisMonth}-28`, kind: 'scheduled', scheduled: true},
        {id: 'tx-insurance', accountId: 'everyday', description: 'Car insurance', amountCents: -8950, date: `${next}-01`, kind: 'scheduled', scheduled: true},
        {id: 'tx-savings-interest', accountId: 'savings', description: 'Interest', amountCents: 1240, date: `${thisMonth}-01`, kind: 'income', scheduled: false},
    ];
}

export function seedEverydayMoneyState(now = new Date()): EverydayMoneyState {
    return {
        accounts: SEED_ACCOUNTS.map((account) => ({...account})),
        transactions: seedTransactions(now),
        payees: SEED_PAYEES.map((payee) => ({...payee})),
        settings: {
            hideBalances: false,
            paymentAlerts: true,
        },
    };
}

export function isAccountId(value: string): value is AccountId {
    return ACCOUNT_IDS.some((id) => id === value);
}

export function parseAmountCents(raw: string): number | null {
    const trimmed = raw.trim();
    if (!(/^\d+(\.\d{1,2})?$/).test(trimmed)) {
        return null;
    }

    const [dollars, cents = ''] = trimmed.split('.');
    const value = (Number(dollars) * 100) + Number(cents.padEnd(2, '0'));
    if (!Number.isInteger(value) || value <= 0) {
        return null;
    }

    return value;
}

export function isValidPayeeAccountNumber(raw: string): boolean {
    return (/^\d{6,10}$/).test(raw.trim());
}

export function formatAudFromCents(amountCents: number): string {
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
    }).format(amountCents / 100);
}

export function overallPositionCents(accounts: Account[]): number {
    return accounts.reduce((sum, account) => sum + account.availableCents, 0);
}

export function transferableAccounts(accounts: Account[]): Account[] {
    return accounts.filter((account) => account.transferable);
}

export function findAccount(accounts: Account[], accountId: string): Account | undefined {
    return accounts.find((account) => account.id === accountId);
}

export function filterTransactions(transactions: Transaction[], accountId: AccountId, query: string): Transaction[] {
    const needle = query.trim().toLowerCase();
    return transactions.filter((transaction) => {
        if (transaction.accountId !== accountId) {
            return false;
        }
        if (!needle) {
            return true;
        }
        return transaction.description.toLowerCase().includes(needle);
    });
}

export function scheduledTransactions(transactions: Transaction[], accountId: AccountId): Transaction[] {
    return transactions.filter((transaction) => transaction.accountId === accountId && transaction.scheduled);
}

export function transactionsToCsv(transactions: Transaction[]): string {
    const header = 'Date,Description,Amount,Kind,Scheduled';
    const rows = transactions.map((transaction) => {
        const description = `"${transaction.description.replace(/"/g, '""')}"`;
        return [
            transaction.date,
            description,
            formatAudFromCents(transaction.amountCents),
            transaction.kind,
            transaction.scheduled ? 'yes' : 'no',
        ].join(',');
    });
    return [header, ...rows].join('\n');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function parseStoredAccount(value: unknown): Account | null {
    if (!isRecord(value) || typeof value.id !== 'string' || !isAccountId(value.id)) {
        return null;
    }
    if (typeof value.availableCents !== 'number' || !Number.isInteger(value.availableCents)) {
        return null;
    }

    const seed = SEED_ACCOUNTS.find((account) => account.id === value.id);
    if (!seed) {
        return null;
    }

    return {
        ...seed,
        availableCents: value.availableCents,
    };
}

function parseStoredTransaction(value: unknown): Transaction | null {
    if (!isRecord(value)) {
        return null;
    }
    if (typeof value.id !== 'string' || typeof value.description !== 'string' || typeof value.date !== 'string') {
        return null;
    }
    if (typeof value.accountId !== 'string' || !isAccountId(value.accountId)) {
        return null;
    }
    if (typeof value.amountCents !== 'number' || !Number.isInteger(value.amountCents)) {
        return null;
    }
    if (
        value.kind !== 'spend' &&
        value.kind !== 'income' &&
        value.kind !== 'transfer' &&
        value.kind !== 'payment' &&
        value.kind !== 'scheduled'
    ) {
        return null;
    }

    return {
        id: value.id,
        accountId: value.accountId,
        description: value.description,
        amountCents: value.amountCents,
        date: value.date,
        kind: value.kind,
        scheduled: value.scheduled === true,
    };
}

function parseStoredPayee(value: unknown): Payee | null {
    if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.accountNumber !== 'string') {
        return null;
    }
    if (!isValidPayeeAccountNumber(value.accountNumber)) {
        return null;
    }

    return {
        id: value.id,
        name: value.name.trim(),
        accountNumber: value.accountNumber.trim(),
    };
}

function parseStoredSettings(value: unknown): EverydayMoneySettings | null {
    if (!isRecord(value) || typeof value.hideBalances !== 'boolean' || typeof value.paymentAlerts !== 'boolean') {
        return null;
    }

    return {
        hideBalances: value.hideBalances,
        paymentAlerts: value.paymentAlerts,
    };
}

export function loadEverydayMoneyState(storage: ReadableStorage = localStorage, now = new Date()): EverydayMoneyState {
    const raw = storage.getItem(EVERYDAY_MONEY_STORAGE_KEY);
    if (!raw) {
        return seedEverydayMoneyState(now);
    }

    try {
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed) || !Array.isArray(parsed.accounts) || !Array.isArray(parsed.transactions) || !Array.isArray(parsed.payees)) {
            return seedEverydayMoneyState(now);
        }

        const accounts = parsed.accounts.map(parseStoredAccount);
        if (accounts.length !== SEED_ACCOUNTS.length || accounts.some((account) => account === null)) {
            return seedEverydayMoneyState(now);
        }

        const transactions = parsed.transactions.map(parseStoredTransaction);
        if (transactions.some((transaction) => transaction === null)) {
            return seedEverydayMoneyState(now);
        }

        const payees = parsed.payees.map(parseStoredPayee);
        if (payees.some((payee) => payee === null)) {
            return seedEverydayMoneyState(now);
        }

        const settings = parseStoredSettings(parsed.settings);
        if (!settings) {
            return seedEverydayMoneyState(now);
        }

        return {
            accounts: accounts as Account[],
            transactions: transactions as Transaction[],
            payees: payees as Payee[],
            settings,
        };
    } catch {
        return seedEverydayMoneyState(now);
    }
}

export function saveEverydayMoneyState(state: EverydayMoneyState, storage: WritableStorage = localStorage): void {
    storage.setItem(EVERYDAY_MONEY_STORAGE_KEY, JSON.stringify(state));
}

export function saveEverydayMoneySettings(
    settings: EverydayMoneySettings,
    storage: WritableStorage = localStorage,
    now = new Date(),
): EverydayMoneyState {
    const next: EverydayMoneyState = {
        ...loadEverydayMoneyState(storage, now),
        settings,
    };
    saveEverydayMoneyState(next, storage);
    return next;
}

function applyBalanceChange(accounts: Account[], accountId: AccountId, deltaCents: number): Account[] {
    return accounts.map((account) => {
        if (account.id !== accountId) {
            return account;
        }
        return {
            ...account,
            availableCents: account.availableCents + deltaCents,
        };
    });
}

export function applyOwnTransfer(
    state: EverydayMoneyState,
    fromAccountId: AccountId,
    toAccountId: AccountId,
    amountCents: number,
    now = new Date(),
): TransferResult {
    if (fromAccountId === toAccountId) {
        return {ok: false, error: 'same_account'};
    }
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
        return {ok: false, error: 'invalid_amount'};
    }

    const fromAccount = findAccount(state.accounts, fromAccountId);
    const toAccount = findAccount(state.accounts, toAccountId);
    if (!fromAccount?.transferable || !toAccount?.transferable) {
        return {ok: false, error: 'unknown_account'};
    }
    if (fromAccount.availableCents < amountCents) {
        return {ok: false, error: 'insufficient'};
    }

    const createdAt = now.toISOString().slice(0, 10);
    const debit: Transaction = {
        id: `xfer-out-${now.getTime()}`,
        accountId: fromAccountId,
        description: `Transfer to ${toAccount.name}`,
        amountCents: -amountCents,
        date: createdAt,
        kind: 'transfer',
        scheduled: false,
    };
    const credit: Transaction = {
        id: `xfer-in-${now.getTime()}`,
        accountId: toAccountId,
        description: `Transfer from ${fromAccount.name}`,
        amountCents,
        date: createdAt,
        kind: 'transfer',
        scheduled: false,
    };

    return {
        ok: true,
        state: {
            ...state,
            accounts: applyBalanceChange(
                applyBalanceChange(state.accounts, fromAccountId, -amountCents),
                toAccountId,
                amountCents,
            ),
            transactions: [debit, credit, ...state.transactions],
        },
    };
}

export function submitOwnTransfer(
    fromAccountId: AccountId,
    toAccountId: AccountId,
    amountRaw: string,
    storage: WritableStorage = localStorage,
    now = new Date(),
): TransferResult {
    const amountCents = parseAmountCents(amountRaw);
    if (amountCents === null) {
        return {ok: false, error: 'invalid_amount'};
    }

    const result = applyOwnTransfer(
        loadEverydayMoneyState(storage, now),
        fromAccountId,
        toAccountId,
        amountCents,
        now,
    );
    if (result.ok) {
        saveEverydayMoneyState(result.state, storage);
    }

    return result;
}

export function applyPayAnyone(
    state: EverydayMoneyState,
    fromAccountId: AccountId,
    payeeName: string,
    accountNumber: string,
    amountCents: number,
    now = new Date(),
): PayResult {
    const name = payeeName.trim();
    const number = accountNumber.trim();

    if (!name) {
        return {ok: false, error: 'invalid_payee'};
    }
    if (!isValidPayeeAccountNumber(number)) {
        return {ok: false, error: 'invalid_account_number'};
    }
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
        return {ok: false, error: 'invalid_amount'};
    }

    const fromAccount = findAccount(state.accounts, fromAccountId);
    if (!fromAccount?.transferable) {
        return {ok: false, error: 'unknown_account'};
    }
    if (fromAccount.availableCents < amountCents) {
        return {ok: false, error: 'insufficient'};
    }

    const existingPayee = state.payees.find((payee) => payee.accountNumber === number);
    const payees = existingPayee ? state.payees : [
        {
            id: `payee-${now.getTime()}`,
            name,
            accountNumber: number,
        },
        ...state.payees,
    ];

    const payment: Transaction = {
        id: `pay-${now.getTime()}`,
        accountId: fromAccountId,
        description: `Pay anyone — ${name}`,
        amountCents: -amountCents,
        date: now.toISOString().slice(0, 10),
        kind: 'payment',
        scheduled: false,
    };

    return {
        ok: true,
        state: {
            ...state,
            accounts: applyBalanceChange(state.accounts, fromAccountId, -amountCents),
            transactions: [payment, ...state.transactions],
            payees,
        },
    };
}

export function submitPayAnyone(
    fromAccountId: AccountId,
    payeeName: string,
    accountNumber: string,
    amountRaw: string,
    storage: WritableStorage = localStorage,
    now = new Date(),
): PayResult {
    const amountCents = parseAmountCents(amountRaw);
    if (amountCents === null) {
        return {ok: false, error: 'invalid_amount'};
    }

    const result = applyPayAnyone(
        loadEverydayMoneyState(storage, now),
        fromAccountId,
        payeeName,
        accountNumber,
        amountCents,
        now,
    );
    if (result.ok) {
        saveEverydayMoneyState(result.state, storage);
    }

    return result;
}
