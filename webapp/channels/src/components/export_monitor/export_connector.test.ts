// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    APPROVED_EXPORT_ITEMS,
    EXPORT_CONNECTOR_STORAGE_KEY,
    getExportPayloads,
    isExportConnectorEnabled,
    setExportConnectorEnabled,
} from './export_connector';

function memoryStorage(initial: Record<string, string> = {}): Storage {
    const data = {...initial};
    return {
        get length() {
            return Object.keys(data).length;
        },
        clear: () => {
            for (const key of Object.keys(data)) {
                delete data[key];
            }
        },
        getItem: (key: string) => (key in data ? data[key] : null),
        key: (index: number) => Object.keys(data)[index] ?? null,
        removeItem: (key: string) => {
            delete data[key];
        },
        setItem: (key: string, value: string) => {
            data[key] = value;
        },
    };
}

describe('export_connector', () => {
    test('defaults to enabled when nothing is stored', () => {
        expect(isExportConnectorEnabled(memoryStorage())).toBe(true);
    });

    test('treats an explicit off value as disabled', () => {
        const storage = memoryStorage({[EXPORT_CONNECTOR_STORAGE_KEY]: 'false'});
        expect(isExportConnectorEnabled(storage)).toBe(false);
    });

    test('turning the connector on persists and emits payloads', () => {
        const storage = memoryStorage({[EXPORT_CONNECTOR_STORAGE_KEY]: 'false'});
        expect(getExportPayloads(isExportConnectorEnabled(storage))).toEqual([]);

        setExportConnectorEnabled(true, storage);

        expect(isExportConnectorEnabled(storage)).toBe(true);
        expect(storage.getItem(EXPORT_CONNECTOR_STORAGE_KEY)).toBe('true');

        const payloads = getExportPayloads(true);
        expect(payloads).toHaveLength(APPROVED_EXPORT_ITEMS.length);
        expect(payloads.map((payload) => payload.itemId)).toEqual(
            APPROVED_EXPORT_ITEMS.map((item) => item.id),
        );
    });
});
