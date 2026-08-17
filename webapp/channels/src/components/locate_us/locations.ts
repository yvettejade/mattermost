// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const NZ_TIME_ZONE = 'Pacific/Auckland';

// Monday 17 Aug 2026 11:00 NZST. Tests freeze the clock here so Open now is deterministic.
export const DEMO_WEEKDAY_11_NZST = new Date('2026-08-17T11:00:00+12:00');
export const DEMO_SUNDAY_11_NZST = new Date('2026-08-16T11:00:00+12:00');

export type LocationType = 'branch' | 'atm';
export type LocationTypeFilter = 'all' | LocationType;

export type HoursSpec =
    | {kind: 'closed'}
    | {kind: 'always'}
    | {kind: 'window'; open: string; close: string};

export type LocateLocation = {
    id: string;
    name: string;
    type: LocationType;
    city: string;
    address: string;
    hoursLabel: string;
    weekdayHours: HoursSpec;
    weekendHours: HoursSpec;
};

const WEEKDAY_INDEX: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
};

export const LOCATE_US_LOCATIONS: LocateLocation[] = [
    {
        id: 'auckland-high-st-branch',
        name: 'Auckland High Street',
        type: 'branch',
        city: 'Auckland',
        address: '120 High Street, Auckland',
        hoursLabel: 'Mon–Fri 9:00am–4:00pm',
        weekdayHours: {kind: 'window', open: '09:00', close: '16:00'},
        weekendHours: {kind: 'closed'},
    },
    {
        id: 'wellington-lambton-branch',
        name: 'Wellington Lambton Quay',
        type: 'branch',
        city: 'Wellington',
        address: '86 Lambton Quay, Wellington',
        hoursLabel: 'Mon–Fri 9:00am–4:00pm',
        weekdayHours: {kind: 'window', open: '09:00', close: '16:00'},
        weekendHours: {kind: 'closed'},
    },
    {
        id: 'dunedin-george-st-branch',
        name: 'Dunedin George Street',
        type: 'branch',
        city: 'Dunedin',
        address: '210 George Street, Dunedin',
        hoursLabel: 'Mon–Fri 12:00pm–5:00pm',
        weekdayHours: {kind: 'window', open: '12:00', close: '17:00'},
        weekendHours: {kind: 'closed'},
    },
    {
        id: 'auckland-queen-st-atm',
        name: 'Auckland Queen Street ATM',
        type: 'atm',
        city: 'Auckland',
        address: '200 Queen Street, Auckland',
        hoursLabel: 'Open 24 hours',
        weekdayHours: {kind: 'always'},
        weekendHours: {kind: 'always'},
    },
    {
        id: 'wellington-railway-atm',
        name: 'Wellington Railway Station ATM',
        type: 'atm',
        city: 'Wellington',
        address: 'Bunny Street, Wellington',
        hoursLabel: 'Open 24 hours',
        weekdayHours: {kind: 'always'},
        weekendHours: {kind: 'always'},
    },
    {
        id: 'christchurch-riccarton-atm',
        name: 'Christchurch Riccarton ATM',
        type: 'atm',
        city: 'Christchurch',
        address: '129 Riccarton Road, Christchurch',
        hoursLabel: 'Daily 8:00am–10:00pm',
        weekdayHours: {kind: 'window', open: '08:00', close: '22:00'},
        weekendHours: {kind: 'window', open: '08:00', close: '22:00'},
    },
];

export function parseMinutes(value: string): number {
    const [hours, minutes] = value.split(':').map(Number);
    return (hours * 60) + minutes;
}

export function getAucklandClock(now: Date): {weekday: number; minutes: number} {
    const parts = new Intl.DateTimeFormat('en-NZ', {
        timeZone: NZ_TIME_ZONE,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(now);

    const weekdayText = parts.find((part) => part.type === 'weekday')?.value ?? 'Sun';
    const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
    const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');

    return {
        weekday: WEEKDAY_INDEX[weekdayText] ?? 0,
        minutes: (hour * 60) + minute,
    };
}

export function hoursCover(hours: HoursSpec, minutes: number): boolean {
    if (hours.kind === 'closed') {
        return false;
    }
    if (hours.kind === 'always') {
        return true;
    }

    const open = parseMinutes(hours.open);
    const close = parseMinutes(hours.close);
    if (close <= open) {
        return minutes >= open || minutes < close;
    }
    return minutes >= open && minutes < close;
}

export function isLocationOpenAt(location: LocateLocation, now: Date): boolean {
    const {weekday, minutes} = getAucklandClock(now);
    const isWeekend = weekday === 0 || weekday === 6;
    const hours = isWeekend ? location.weekendHours : location.weekdayHours;
    return hoursCover(hours, minutes);
}

export function filterLocations(
    locations: readonly LocateLocation[],
    filters: {type: LocationTypeFilter; openNow: boolean; now: Date},
): LocateLocation[] {
    return locations.filter((location) => {
        if (filters.type !== 'all' && location.type !== filters.type) {
            return false;
        }
        if (filters.openNow && !isLocationOpenAt(location, filters.now)) {
            return false;
        }
        return true;
    });
}
