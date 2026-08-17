// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const CARD_IDS = ['flexi-debit', 'credit'] as const;

export type CardId = typeof CARD_IDS[number];

export type CardLock = {
    locked: boolean;
};

export type SeededCard = {
    id: CardId;
    nameId: string;
    name: string;
    lastFour: string;
};

export type CardLockState = Record<CardId, CardLock>;
