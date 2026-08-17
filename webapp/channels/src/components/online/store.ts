// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ACCOUNT_IDS, CARD_IDS} from './types';
import type {
    Account,
    AccountId,
    AddPayeeResult,
    Card,
    CardId,
    CardsPaymentsState,
    Payee,
    Payment,
    PaymentStatus,
    PayResult,
    TransferResult,
} from './types';

export const CARDS_PAYMENTS_STORAGE_KEY = 'mm_cards_payments';
export const PAY_ANYONE_TIME_ZONE = 'Pacific/Auckland';
export const PAY_ANYONE_CURRENCY = 'NZD';

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const SEED_ACCOUNTS: Account[] = [
    {
        id: 'everyday',
        nameId: 'online.account.everyday',
        name: 'Everyday',
        number: '12-3456-7890123-00',
        availableCents: 428055,
    },
    {
        id: 'savings',
        nameId: 'online.account.savings',
        name: 'Savings',
        number: '12-3456-7890123-01',
        availableCents: 1864000,
    },
];

const SEED_CARDS: Array<Omit<Card, 'locked'>> = [
    {
        id: 'flexi-debit',
        nameId: 'online.card.flexi_debit',
        name: 'Flexi Debit',
        lastFour: '4412',
    },
    {
        id: 'credit',
        nameId: 'online.card.credit',
        name: 'Credit card',
        lastFour: '8891',
    },
];

export const SEED_PAYEES: Payee[] = [
    {
        id: 'payee-spark',
        name: 'Spark NZ',
        accountNumber: '12-3140-0123456-00',
        referenceDefault: 'Home broadband',
        seeded: true,
    },
    {
        id: 'payee-ird',
        name: 'Inland Revenue',
        accountNumber: '03-0049-0001234-00',
        referenceDefault: '',
        seeded: true,
    },
    {
        id: 'payee-alex',
        name: 'Alex Chen',
        accountNumber: '01-0001-0000001-00',
        referenceDefault: 'Rent',
        seeded: true,
    },
];

export function seedCardsPaymentsState(): CardsPaymentsState {
    return {
        accounts: SEED_ACCOUNTS.map((account) => ({...account})),
        cards: SEED_CARDS.map((card) => ({...card, locked: false})),
        payees: SEED_PAYEES.map((payee) => ({...payee})),
        payments: [],
    };
}

export function isAccountId(value: string): value is AccountId {
    return ACCOUNT_IDS.some((id) => id === value);
}

export function isCardId(value: string): value is CardId {
    return CARD_IDS.some((id) => id === value);
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

export function normalizeNzAccountNumber(value: string): string | null {
    const trimmed = value.trim();
    if ((/^\d{2}-\d{4}-\d{7}-\d{2}$/).test(trimmed)) {
        return trimmed;
    }

    const digits = trimmed.replace(/\D/g, '');
    if (digits.length === 15) {
        return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 13)}-${digits.slice(13)}`;
    }

    return null;
}

export function isValidNzAccountNumber(value: string): boolean {
    return normalizeNzAccountNumber(value) !== null;
}

export function formatNzdFromCents(amountCents: number): string {
    return new Intl.NumberFormat('en-NZ', {
        style: 'currency',
        currency: PAY_ANYONE_CURRENCY,
    }).format(amountCents / 100);
}

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

export function paymentStatus(when: string, now: Date = new Date()): PaymentStatus {
    return resolvePaymentDate(when, now) > todayInAuckland(now) ? 'scheduled' : 'sent';
}

export function findAccount(accounts: Account[], accountId: string): Account | undefined {
    return accounts.find((account) => account.id === accountId);
}

export function findCard(cards: Card[], cardId: string): Card | undefined {
    return cards.find((card) => card.id === cardId);
}

export function findPayee(payees: Payee[], payeeId: string): Payee | undefined {
    return payees.find((payee) => payee.id === payeeId);
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

function parseStoredCard(value: unknown): Card | null {
    if (!isRecord(value) || typeof value.id !== 'string' || !isCardId(value.id)) {
        return null;
    }
    if (typeof value.locked !== 'boolean') {
        return null;
    }

    const seed = SEED_CARDS.find((card) => card.id === value.id);
    if (!seed) {
        return null;
    }

    return {
        ...seed,
        locked: value.locked,
    };
}

function parseStoredPayee(value: unknown): Payee | null {
    if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') {
        return null;
    }
    if (typeof value.accountNumber !== 'string' || typeof value.referenceDefault !== 'string') {
        return null;
    }
    if (!isValidNzAccountNumber(value.accountNumber)) {
        return null;
    }

    return {
        id: value.id,
        name: value.name.trim(),
        accountNumber: value.accountNumber,
        referenceDefault: value.referenceDefault,
        seeded: value.seeded === true,
    };
}

function parseStoredPayment(value: unknown): Payment | null {
    if (!isRecord(value)) {
        return null;
    }
    if (typeof value.id !== 'string' || typeof value.payeeName !== 'string' || typeof value.payeeAccount !== 'string') {
        return null;
    }
    if (typeof value.fromAccountId !== 'string' || !isAccountId(value.fromAccountId)) {
        return null;
    }
    if (typeof value.amountCents !== 'number' || !Number.isInteger(value.amountCents) || value.amountCents <= 0) {
        return null;
    }
    if (typeof value.reference !== 'string' || typeof value.when !== 'string') {
        return null;
    }
    if (value.status !== 'sent' && value.status !== 'scheduled') {
        return null;
    }

    return {
        id: value.id,
        payeeName: value.payeeName,
        payeeAccount: value.payeeAccount,
        fromAccountId: value.fromAccountId,
        amountCents: value.amountCents,
        reference: value.reference,
        when: value.when,
        status: value.status,
    };
}

export function loadCardsPaymentsState(storage: ReadableStorage = localStorage): CardsPaymentsState {
    const raw = storage.getItem(CARDS_PAYMENTS_STORAGE_KEY);
    if (!raw) {
        return seedCardsPaymentsState();
    }

    try {
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed) || !Array.isArray(parsed.accounts) || !Array.isArray(parsed.cards) || !Array.isArray(parsed.payees) || !Array.isArray(parsed.payments)) {
            return seedCardsPaymentsState();
        }

        const accounts = parsed.accounts.map(parseStoredAccount);
        if (accounts.length !== SEED_ACCOUNTS.length || accounts.some((account) => account === null)) {
            return seedCardsPaymentsState();
        }

        const cards = parsed.cards.map(parseStoredCard);
        if (cards.length !== SEED_CARDS.length || cards.some((card) => card === null)) {
            return seedCardsPaymentsState();
        }

        const payees = parsed.payees.map(parseStoredPayee);
        if (payees.length < SEED_PAYEES.length || payees.some((payee) => payee === null)) {
            return seedCardsPaymentsState();
        }

        const payments = parsed.payments.map(parseStoredPayment);
        if (payments.some((payment) => payment === null)) {
            return seedCardsPaymentsState();
        }

        return {
            accounts: accounts as Account[],
            cards: cards as Card[],
            payees: payees as Payee[],
            payments: payments as Payment[],
        };
    } catch {
        return seedCardsPaymentsState();
    }
}

export function saveCardsPaymentsState(state: CardsPaymentsState, storage: WritableStorage = localStorage): void {
    storage.setItem(CARDS_PAYMENTS_STORAGE_KEY, JSON.stringify(state));
}

export function resetCardsPaymentsState(storage: WritableStorage = localStorage): CardsPaymentsState {
    storage.removeItem(CARDS_PAYMENTS_STORAGE_KEY);
    return seedCardsPaymentsState();
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

export function setCardLocked(
    state: CardsPaymentsState,
    cardId: CardId,
    locked: boolean,
    storage: WritableStorage = localStorage,
): CardsPaymentsState {
    const next: CardsPaymentsState = {
        ...state,
        cards: state.cards.map((card) => (card.id === cardId ? {...card, locked} : card)),
    };
    saveCardsPaymentsState(next, storage);
    return next;
}

export function addPayee(
    state: CardsPaymentsState,
    nameRaw: string,
    accountNumberRaw: string,
    referenceDefault = '',
    storage: WritableStorage = localStorage,
    now = new Date(),
): AddPayeeResult {
    const name = nameRaw.trim();
    if (!name) {
        return {ok: false, field: 'name', reason: 'required'};
    }

    const accountNumber = normalizeNzAccountNumber(accountNumberRaw);
    if (!accountNumber) {
        return {ok: false, field: 'accountNumber', reason: 'invalid'};
    }

    const payee: Payee = {
        id: `payee-${now.getTime()}`,
        name,
        accountNumber,
        referenceDefault: referenceDefault.trim(),
        seeded: false,
    };
    const next: CardsPaymentsState = {
        ...state,
        payees: [...state.payees, payee],
    };
    saveCardsPaymentsState(next, storage);
    return {ok: true, state: next, payee};
}

export function removePayee(
    state: CardsPaymentsState,
    payeeId: string,
    storage: WritableStorage = localStorage,
): CardsPaymentsState {
    const payee = findPayee(state.payees, payeeId);
    if (!payee || payee.seeded) {
        return state;
    }

    const next: CardsPaymentsState = {
        ...state,
        payees: state.payees.filter((item) => item.id !== payeeId),
    };
    saveCardsPaymentsState(next, storage);
    return next;
}

export function applyPayAnyone(
    state: CardsPaymentsState,
    fromAccountId: AccountId,
    payeeName: string,
    accountNumber: string,
    amountCents: number,
    reference: string,
    when: string,
    now = new Date(),
): PayResult {
    const name = payeeName.trim();
    const number = normalizeNzAccountNumber(accountNumber);

    if (!name) {
        return {ok: false, error: 'invalid_payee'};
    }
    if (!number) {
        return {ok: false, error: 'invalid_account_number'};
    }
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
        return {ok: false, error: 'invalid_amount'};
    }

    const fromAccount = findAccount(state.accounts, fromAccountId);
    if (!fromAccount) {
        return {ok: false, error: 'unknown_account'};
    }

    const status = paymentStatus(when, now);
    if (status === 'sent' && fromAccount.availableCents < amountCents) {
        return {ok: false, error: 'insufficient'};
    }

    const payment: Payment = {
        id: `pay-${now.getTime()}`,
        payeeName: name,
        payeeAccount: number,
        fromAccountId,
        amountCents,
        reference: reference.trim(),
        when: resolvePaymentDate(when, now),
        status,
    };

    return {
        ok: true,
        payment,
        state: {
            ...state,
            accounts: status === 'sent' ? applyBalanceChange(state.accounts, fromAccountId, -amountCents) : state.accounts,
            payments: [payment, ...state.payments],
        },
    };
}

export function submitPayAnyone(
    fromAccountId: AccountId,
    payeeName: string,
    accountNumber: string,
    amountRaw: string,
    reference: string,
    when: string,
    storage: WritableStorage = localStorage,
    now = new Date(),
): PayResult {
    const amountCents = parseAmountCents(amountRaw);
    if (amountCents === null) {
        return {ok: false, error: 'invalid_amount'};
    }

    const result = applyPayAnyone(
        loadCardsPaymentsState(storage),
        fromAccountId,
        payeeName,
        accountNumber,
        amountCents,
        reference,
        when,
        now,
    );
    if (result.ok) {
        saveCardsPaymentsState(result.state, storage);
    }

    return result;
}

export function applyOwnTransfer(
    state: CardsPaymentsState,
    fromAccountId: AccountId,
    toAccountId: AccountId,
    amountCents: number,
): TransferResult {
    if (fromAccountId === toAccountId) {
        return {ok: false, error: 'same_account'};
    }
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
        return {ok: false, error: 'invalid_amount'};
    }

    const fromAccount = findAccount(state.accounts, fromAccountId);
    const toAccount = findAccount(state.accounts, toAccountId);
    if (!fromAccount || !toAccount) {
        return {ok: false, error: 'unknown_account'};
    }
    if (fromAccount.availableCents < amountCents) {
        return {ok: false, error: 'insufficient'};
    }

    return {
        ok: true,
        state: {
            ...state,
            accounts: applyBalanceChange(
                applyBalanceChange(state.accounts, fromAccountId, -amountCents),
                toAccountId,
                amountCents,
            ),
        },
    };
}

export function submitOwnTransfer(
    fromAccountId: AccountId,
    toAccountId: AccountId,
    amountRaw: string,
    storage: WritableStorage = localStorage,
): TransferResult {
    const amountCents = parseAmountCents(amountRaw);
    if (amountCents === null) {
        return {ok: false, error: 'invalid_amount'};
    }

    const result = applyOwnTransfer(
        loadCardsPaymentsState(storage),
        fromAccountId,
        toAccountId,
        amountCents,
    );
    if (result.ok) {
        saveCardsPaymentsState(result.state, storage);
    }

    return result;
}
