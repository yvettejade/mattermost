// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PAY_ANYONE_STORAGE_KEY, readStoredRecord, writeStoredPatch} from './storage';

export {PAY_ANYONE_STORAGE_KEY};

export type Payee = {
    id: string;
    name: string;
    accountNumber: string;
    referenceDefault: string;
    seeded: boolean;
};

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

export type AddPayeeInput = {
    name: string;
    accountNumber: string;
    referenceDefault?: string;
};

export type AddPayeeResult =
    | {ok: true; payee: Payee; payees: Payee[]}
    | {ok: false; field: 'name' | 'accountNumber'; reason: 'required' | 'invalid'};

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function isValidNzAccountNumber(value: string): boolean {
    return normalizeNzAccountNumber(value) !== null;
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

function isCustomPayee(value: unknown): value is Payee {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const record = value as Partial<Payee>;
    return typeof record.id === 'string' &&
        record.id.length > 0 &&
        typeof record.name === 'string' &&
        typeof record.accountNumber === 'string' &&
        typeof record.referenceDefault === 'string' &&
        record.seeded === false;
}

export function getCustomPayees(storage: ReadableStorage = localStorage): Payee[] {
    const stored = readStoredRecord(storage).customPayees;
    if (!Array.isArray(stored)) {
        return [];
    }

    return stored.filter(isCustomPayee);
}

export function listPayees(storage: ReadableStorage = localStorage): Payee[] {
    return [...SEED_PAYEES, ...getCustomPayees(storage)];
}

function writeCustomPayees(customPayees: Payee[], storage: WritableStorage) {
    writeStoredPatch({customPayees}, storage);
}

export function addPayee(
    input: AddPayeeInput,
    storage: WritableStorage = localStorage,
    now: Date = new Date(),
): AddPayeeResult {
    const name = input.name.trim();
    if (!name) {
        return {ok: false, field: 'name', reason: 'required'};
    }

    const accountNumber = normalizeNzAccountNumber(input.accountNumber);
    if (!accountNumber) {
        return {ok: false, field: 'accountNumber', reason: 'invalid'};
    }

    const payee: Payee = {
        id: `payee-${now.getTime()}`,
        name,
        accountNumber,
        referenceDefault: (input.referenceDefault ?? '').trim(),
        seeded: false,
    };

    writeCustomPayees([...getCustomPayees(storage), payee], storage);
    return {ok: true, payee, payees: listPayees(storage)};
}

export function removePayee(
    id: string,
    storage: WritableStorage = localStorage,
): {ok: boolean; payees: Payee[]} {
    if (SEED_PAYEES.some((payee) => payee.id === id)) {
        return {ok: false, payees: listPayees(storage)};
    }

    writeCustomPayees(getCustomPayees(storage).filter((payee) => payee.id !== id), storage);
    return {ok: true, payees: listPayees(storage)};
}
