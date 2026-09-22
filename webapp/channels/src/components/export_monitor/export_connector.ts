// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type ExportPayload = {
    id: string;
    exportedAt: string;
    channelName: string;
    messagePreview: string;
};

export const EXPORT_CONNECTOR_STORAGE_KEY = 'mm_export_connector_enabled';

// Sent drafts stay in the app and audit trail when this is off. The monitor then shows zero payloads.
export const EXPORT_CONNECTOR_DEFAULT_ENABLED = true;

const SEED_PAYLOADS: ExportPayload[] = [
    {
        id: 'export-payload-1',
        exportedAt: '2026-08-15T22:14:00.000Z',
        channelName: 'finance',
        messagePreview: 'On-call overtime for last night is approved.',
    },
    {
        id: 'export-payload-2',
        exportedAt: '2026-08-15T23:02:00.000Z',
        channelName: 'finance',
        messagePreview: 'Travel for the Monday planning session is approved.',
    },
];

function readStoredEnabled(): boolean | undefined {
    if (typeof localStorage === 'undefined') {
        return undefined;
    }

    try {
        const raw = localStorage.getItem(EXPORT_CONNECTOR_STORAGE_KEY);
        if (raw === 'true') {
            return true;
        }
        if (raw === 'false') {
            return false;
        }
    } catch {
        return undefined;
    }

    return undefined;
}

export function isExportConnectorEnabled(): boolean {
    return readStoredEnabled() ?? EXPORT_CONNECTOR_DEFAULT_ENABLED;
}

export function setExportConnectorEnabled(enabled: boolean): void {
    if (typeof localStorage === 'undefined') {
        return;
    }

    try {
        localStorage.setItem(EXPORT_CONNECTOR_STORAGE_KEY, enabled ? 'true' : 'false');
    } catch {
        // Ignore quota / private-mode failures. The next read falls back to the default.
    }
}

export function getExportPayloads(): ExportPayload[] {
    if (!isExportConnectorEnabled()) {
        return [];
    }

    return SEED_PAYLOADS;
}

export function resetExportConnectorForTests(): void {
    if (typeof localStorage === 'undefined') {
        return;
    }

    try {
        localStorage.removeItem(EXPORT_CONNECTOR_STORAGE_KEY);
    } catch {
        // Test cleanup is best-effort.
    }
}
