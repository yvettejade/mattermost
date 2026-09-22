// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const CARD_IDS = ['flexi-debit', 'credit'] as const;

export type CardId = typeof CARD_IDS[number];

export type CardControls = {
    locked: boolean;
    blockOverseas: boolean;
    blockOnline: boolean;
    dailyLimitCents: number | null;
};

export type SeededCard = {
    id: CardId;
    nameId: string;
    name: string;
    lastFour: string;
    defaults: CardControls;
};

export type CardControlsState = Record<CardId, CardControls>;
