// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const OPEN_ACCOUNT_STORAGE_KEY = 'mm_online_youmoney_accounts';
export const YOU_MONEY_ACCOUNT_CAP = 25;

export const ACCOUNT_COLOURS = ['navy', 'green', 'amber', 'red', 'teal'] as const;
export type AccountColour = typeof ACCOUNT_COLOURS[number];

export type EverydayAccount = {
    id: string;
    name: string;
    number: string;
    kind: 'youmoney' | 'savings' | 'credit' | 'home-loan';
    availableCents: number;
    colour?: AccountColour;
};

export type OpenAccountError = 'nickname_required' | 'cap';

export type OpenAccountResult =
    | {ok: true; account: EverydayAccount; accounts: EverydayAccount[]}
    | {ok: false; error: OpenAccountError};

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const SEED_ACCOUNTS: EverydayAccount[] = [
    {
        id: 'youmoney-everyday',
        name: 'YouMoney',
        number: '01-0123-0123456-00',
        kind: 'youmoney',
        availableCents: 428050,
        colour: 'navy',
    },
];

const NZ_ACCOUNT_PATTERN = /^\d{2}-\d{4}-\d{7}-\d{2}$/;

export function isAccountColour(value: unknown): value is AccountColour {
    return typeof value === 'string' && (ACCOUNT_COLOURS as readonly string[]).includes(value);
}

export function isNzAccountNumber(value: string): boolean {
    return NZ_ACCOUNT_PATTERN.test(value);
}

export function youMoneyAccounts(accounts: EverydayAccount[]): EverydayAccount[] {
    return accounts.filter((account) => account.kind === 'youmoney');
}

export function formatNzdFromCents(amountCents: number): string {
    return new Intl.NumberFormat('en-NZ', {
        style: 'currency',
        currency: 'NZD',
    }).format(amountCents / 100);
}

export function generateNzAccountNumber(existingNumbers: string[]): string {
    const used = new Set(existingNumbers);
    for (let i = 1; i < 10_000_000; i++) {
        const number = `01-1847-${String(i).padStart(7, '0')}-00`;
        if (!used.has(number)) {
            return number;
        }
    }

    throw new Error('exhausted NZ account numbers');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function parseOpenedAccount(value: unknown): EverydayAccount | null {
    if (!isRecord(value)) {
        return null;
    }
    if (typeof value.id !== 'string' || !value.id.startsWith('youmoney-')) {
        return null;
    }
    if (typeof value.name !== 'string') {
        return null;
    }
    const name = value.name.trim();
    if (!name) {
        return null;
    }
    if (typeof value.number !== 'string' || !isNzAccountNumber(value.number)) {
        return null;
    }
    if (value.kind !== 'youmoney') {
        return null;
    }
    if (value.availableCents !== 0) {
        return null;
    }

    const account: EverydayAccount = {
        id: value.id,
        name,
        number: value.number,
        kind: 'youmoney',
        availableCents: 0,
    };
    if (isAccountColour(value.colour)) {
        account.colour = value.colour;
    }
    return account;
}

export function readOpenedAccounts(storage: ReadableStorage = localStorage): EverydayAccount[] {
    const raw = storage.getItem(OPEN_ACCOUNT_STORAGE_KEY);
    if (!raw) {
        return [];
    }

    try {
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed) || !Array.isArray(parsed.opened)) {
            return [];
        }
        return parsed.opened.map(parseOpenedAccount).filter((account): account is EverydayAccount => account !== null);
    } catch {
        return [];
    }
}

export function loadEverydayAccounts(storage: ReadableStorage = localStorage): EverydayAccount[] {
    return [...SEED_ACCOUNTS, ...readOpenedAccounts(storage)];
}

export function openYouMoneyAccount(
    input: {nickname: string; colour?: AccountColour},
    storage: WritableStorage = localStorage,
): OpenAccountResult {
    const accounts = loadEverydayAccounts(storage);
    if (youMoneyAccounts(accounts).length >= YOU_MONEY_ACCOUNT_CAP) {
        return {ok: false, error: 'cap'};
    }

    const name = input.nickname.trim();
    if (!name) {
        return {ok: false, error: 'nickname_required'};
    }

    const number = generateNzAccountNumber(accounts.map((account) => account.number));
    const opened = readOpenedAccounts(storage);
    const account: EverydayAccount = {
        id: `youmoney-opened-${opened.length + 1}`,
        name,
        number,
        kind: 'youmoney',
        availableCents: 0,
    };
    if (input.colour) {
        account.colour = input.colour;
    }

    storage.setItem(OPEN_ACCOUNT_STORAGE_KEY, JSON.stringify({opened: [...opened, account]}));
    return {ok: true, account, accounts: [...SEED_ACCOUNTS, ...opened, account]};
}
