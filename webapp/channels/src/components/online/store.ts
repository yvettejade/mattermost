// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ACCOUNT_IDS, RAPID_SAVE_ACCOUNT_ID} from './types';
import type {
    Account,
    AccountId,
    EverydayMoneySettings,
    EverydayMoneyState,
    SavingsGoal,
} from './types';

export const EVERYDAY_MONEY_STORAGE_KEY = 'mm_everyday_money';

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const SEED_ACCOUNTS: Account[] = [
    {
        id: 'everyday',
        nameId: 'online.account.everyday',
        name: 'Everyday',
        number: '012-345 6789',
        type: 'transaction',
        availableCents: 428055,
    },
    {
        id: RAPID_SAVE_ACCOUNT_ID,
        nameId: 'online.account.savings',
        name: 'Rapid Save',
        number: '012-345 6790',
        type: 'savings',
        availableCents: 1864000,
    },
    {
        id: 'credit-card',
        nameId: 'online.account.credit_card',
        name: 'Credit card',
        number: '4321',
        type: 'credit',
        availableCents: -61240,
    },
    {
        id: 'home-loan',
        nameId: 'online.account.home_loan',
        name: 'Home loan',
        number: '012-345 6792',
        type: 'loan',
        availableCents: -41200000,
    },
];

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function isAccountId(value: string): value is AccountId {
    return ACCOUNT_IDS.some((id) => id === value);
}

export function seedEverydayMoneyState(): EverydayMoneyState {
    return {
        accounts: SEED_ACCOUNTS.map((account) => ({...account})),
        goals: {},
        settings: {
            hideBalances: false,
        },
    };
}

export function parseGoalAmountCents(raw: string): number | null {
    const trimmed = raw.trim();
    if (!(/^\d+(\.\d{1,2})?$/).test(trimmed)) {
        return null;
    }

    const [dollars, cents = ''] = trimmed.split('.');
    const value = (Number(dollars) * 100) + Number(cents.padEnd(2, '0'));
    if (!Number.isInteger(value) || value < 0) {
        return null;
    }

    return value;
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

export function findAccount(accounts: Account[], accountId: string): Account | undefined {
    return accounts.find((account) => account.id === accountId);
}

export function hasVisibleGoal(goal: SavingsGoal | undefined): goal is SavingsGoal {
    return Boolean(goal && goal.amountCents > 0);
}

export function goalProgressPercent(balanceCents: number, goalCents: number): number {
    if (!Number.isFinite(balanceCents) || !Number.isFinite(goalCents) || goalCents <= 0) {
        return 0;
    }

    return Math.min(100, Math.max(0, Math.round((balanceCents / goalCents) * 100)));
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

function parseStoredGoal(value: unknown): SavingsGoal | null {
    if (!isRecord(value) || typeof value.amountCents !== 'number' || !Number.isInteger(value.amountCents)) {
        return null;
    }
    if (value.amountCents <= 0) {
        return null;
    }

    return {
        amountCents: value.amountCents,
        label: typeof value.label === 'string' ? value.label.trim() : '',
    };
}

function parseStoredGoals(value: unknown): Partial<Record<AccountId, SavingsGoal>> {
    if (!isRecord(value)) {
        return {};
    }

    const goals: Partial<Record<AccountId, SavingsGoal>> = {};
    for (const accountId of ACCOUNT_IDS) {
        const goal = parseStoredGoal(value[accountId]);
        if (goal) {
            goals[accountId] = goal;
        }
    }

    return goals;
}

function parseStoredSettings(value: unknown): EverydayMoneySettings {
    if (!isRecord(value) || typeof value.hideBalances !== 'boolean') {
        return {hideBalances: false};
    }

    return {hideBalances: value.hideBalances};
}

function readExistingRecord(storage: ReadableStorage): Record<string, unknown> {
    const raw = storage.getItem(EVERYDAY_MONEY_STORAGE_KEY);
    if (!raw) {
        return {};
    }

    try {
        const parsed: unknown = JSON.parse(raw);
        return isRecord(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

export function loadEverydayMoneyState(storage: ReadableStorage = localStorage): EverydayMoneyState {
    const parsed = readExistingRecord(storage);
    if (!Array.isArray(parsed.accounts)) {
        return seedEverydayMoneyState();
    }

    const accounts = parsed.accounts.map(parseStoredAccount);
    if (accounts.length !== SEED_ACCOUNTS.length || accounts.some((account) => account === null)) {
        return seedEverydayMoneyState();
    }

    return {
        accounts: accounts as Account[],
        goals: parseStoredGoals(parsed.goals),
        settings: parseStoredSettings(parsed.settings),
    };
}

export function saveEverydayMoneyState(state: EverydayMoneyState, storage: WritableStorage = localStorage): void {
    const existing = readExistingRecord(storage);
    storage.setItem(EVERYDAY_MONEY_STORAGE_KEY, JSON.stringify({
        ...existing,
        accounts: state.accounts,
        goals: state.goals,
        settings: state.settings,
    }));
}

export function saveSavingsGoal(
    accountId: AccountId,
    amountCents: number,
    label: string,
    storage: WritableStorage = localStorage,
): EverydayMoneyState {
    const current = loadEverydayMoneyState(storage);
    const nextGoals = {...current.goals};

    if (amountCents <= 0) {
        delete nextGoals[accountId];
    } else {
        nextGoals[accountId] = {
            amountCents,
            label: label.trim(),
        };
    }

    const next: EverydayMoneyState = {
        ...current,
        goals: nextGoals,
    };
    saveEverydayMoneyState(next, storage);
    return next;
}

export function resetEverydayMoneyState(storage: WritableStorage = localStorage): EverydayMoneyState {
    storage.removeItem(EVERYDAY_MONEY_STORAGE_KEY);
    const next = seedEverydayMoneyState();
    saveEverydayMoneyState(next, storage);
    return next;
}
