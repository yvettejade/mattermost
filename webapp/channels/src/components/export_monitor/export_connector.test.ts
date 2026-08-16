// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    getExportPayloads,
    isExportConnectorEnabled,
    resetExportConnectorForTests,
    setExportConnectorEnabled,
} from './export_connector';

describe('export_connector', () => {
    beforeEach(() => {
        resetExportConnectorForTests();
    });

    afterEach(() => {
        resetExportConnectorForTests();
    });

    test('defaults to on so already-sent drafts produce payloads', () => {
        expect(isExportConnectorEnabled()).toBe(true);
        expect(getExportPayloads()).toHaveLength(2);
        expect(getExportPayloads()[0].channelName).toBe('finance');
    });

    test('returns zero payloads when the connector is off', () => {
        setExportConnectorEnabled(false);

        expect(isExportConnectorEnabled()).toBe(false);
        expect(getExportPayloads()).toEqual([]);
    });

    test('returns payloads again after the connector is turned on', () => {
        setExportConnectorEnabled(false);
        setExportConnectorEnabled(true);

        expect(isExportConnectorEnabled()).toBe(true);
        expect(getExportPayloads()).toHaveLength(2);
    });
});
