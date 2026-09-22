// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const EXPORT_CONNECTOR_STORAGE_KEY = 'mm_export_connector_enabled';

export type ApprovedExportItem = {
    id: string;
    title: {id: string; defaultMessage: string};
    approvedAt: string;
};

export type ExportPayload = {
    id: string;
    itemId: string;
    title: {id: string; defaultMessage: string};
    syncedAt: string;
};

// Approved items stay in-app (and in the audit trail) even when the connector is off.
export const APPROVED_EXPORT_ITEMS: ApprovedExportItem[] = [
    {
        id: 'EXP-1042',
        title: {
            id: 'export_monitor.item.field_travel',
            defaultMessage: 'Q3 field travel',
        },
        approvedAt: '2026-08-15T22:14:00.000Z',
    },
    {
        id: 'EXP-1043',
        title: {
            id: 'export_monitor.item.client_dinner',
            defaultMessage: 'Client dinner',
        },
        approvedAt: '2026-08-15T23:02:00.000Z',
    },
    {
        id: 'EXP-1044',
        title: {
            id: 'export_monitor.item.conference_hotel',
            defaultMessage: 'Conference hotel',
        },
        approvedAt: '2026-08-16T01:18:00.000Z',
    },
];

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'>;

// Missing key means the connector is on. The incident was an explicit off state.
export function isExportConnectorEnabled(storage: ReadableStorage = localStorage): boolean {
    const stored = storage.getItem(EXPORT_CONNECTOR_STORAGE_KEY);
    if (stored === null) {
        return true;
    }
    return stored === 'true';
}

export function setExportConnectorEnabled(enabled: boolean, storage: WritableStorage = localStorage): void {
    storage.setItem(EXPORT_CONNECTOR_STORAGE_KEY, enabled ? 'true' : 'false');
}

export function getExportPayloads(connectorEnabled: boolean): ExportPayload[] {
    if (!connectorEnabled) {
        return [];
    }

    return APPROVED_EXPORT_ITEMS.map((item) => ({
        id: `payload-${item.id}`,
        itemId: item.id,
        title: item.title,
        syncedAt: item.approvedAt,
    }));
}
