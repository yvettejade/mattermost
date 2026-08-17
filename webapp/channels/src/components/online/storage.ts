// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const PAY_ANYONE_STORAGE_KEY = 'mm_online_pay_anyone';

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function readStoredRecord(storage: ReadableStorage): Record<string, unknown> {
    const raw = storage.getItem(PAY_ANYONE_STORAGE_KEY);
    if (!raw) {
        return {};
    }

    try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return {};
        }
        return parsed as Record<string, unknown>;
    } catch {
        return {};
    }
}

export function writeStoredPatch(
    patch: Record<string, unknown>,
    storage: WritableStorage,
): void {
    storage.setItem(PAY_ANYONE_STORAGE_KEY, JSON.stringify({
        ...readStoredRecord(storage),
        ...patch,
    }));
}
