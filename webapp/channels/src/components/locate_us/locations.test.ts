// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    DEMO_SUNDAY_11_NZST,
    DEMO_WEEKDAY_11_NZST,
    filterLocations,
    getAucklandClock,
    isLocationOpenAt,
    LOCATE_US_LOCATIONS,
} from './locations';

describe('locate_us/locations', () => {
    test('demo weekday clock is Monday 11:00 in Auckland', () => {
        expect(getAucklandClock(DEMO_WEEKDAY_11_NZST)).toEqual({weekday: 1, minutes: 11 * 60});
    });

    test('Open now at weekday 11:00 NZST hides the late-opening Dunedin branch', () => {
        const open = filterLocations(LOCATE_US_LOCATIONS, {
            type: 'all',
            openNow: true,
            now: DEMO_WEEKDAY_11_NZST,
        });

        expect(open.map((location) => location.id)).not.toContain('dunedin-george-st-branch');
        expect(open).toHaveLength(5);
        expect(isLocationOpenAt(LOCATE_US_LOCATIONS[2], DEMO_WEEKDAY_11_NZST)).toBe(false);
    });

    test('Branch chip keeps only branches', () => {
        const branches = filterLocations(LOCATE_US_LOCATIONS, {
            type: 'branch',
            openNow: false,
            now: DEMO_WEEKDAY_11_NZST,
        });

        expect(branches.every((location) => location.type === 'branch')).toBe(true);
        expect(branches).toHaveLength(3);
    });

    test('ATM plus Open now on Sunday still has 24h machines', () => {
        const atms = filterLocations(LOCATE_US_LOCATIONS, {
            type: 'atm',
            openNow: true,
            now: DEMO_SUNDAY_11_NZST,
        });

        expect(atms.every((location) => location.type === 'atm')).toBe(true);
        expect(atms.length).toBeGreaterThan(0);
    });

    test('Branch plus Open now on Sunday matches nothing', () => {
        const branches = filterLocations(LOCATE_US_LOCATIONS, {
            type: 'branch',
            openNow: true,
            now: DEMO_SUNDAY_11_NZST,
        });

        expect(branches).toHaveLength(0);
    });
});
