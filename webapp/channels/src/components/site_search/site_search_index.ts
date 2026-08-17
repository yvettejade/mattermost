// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type SiteSearchKind = 'Product' | 'Support' | 'News' | 'Locate' | 'Tool';

export type SiteSearchEntry = {
    id: string;
    title: string;
    description: string;
    kind: SiteSearchKind;
    href: string;
    keywords: string[];
};

export const SITE_SEARCH_INDEX: SiteSearchEntry[] = [
    {
        id: 'product-home-loan',
        title: 'Home loan',
        description: 'Variable and fixed home loans with extra repayments and offset options.',
        kind: 'Product',
        href: '/products/home-loan',
        keywords: ['home loan', 'mortgage', 'lending'],
    },
    {
        id: 'product-transaction-account',
        title: 'Transaction account',
        description: 'Everyday banking with a debit card and no monthly account fee.',
        kind: 'Product',
        href: '/products/transaction-account',
        keywords: ['transaction account', 'everyday', 'debit'],
    },
    {
        id: 'support-password-reset',
        title: 'How do I reset my password?',
        description: 'Steps to reset internet banking credentials from the login screen.',
        kind: 'Support',
        href: '/support/password-reset',
        keywords: ['password', 'reset', 'faq', 'login'],
    },
    {
        id: 'support-offset-account',
        title: 'What is an offset account?',
        description: 'An offset account reduces the interest charged on a linked home loan.',
        kind: 'Support',
        href: '/support/offset-account',
        keywords: ['offset', 'faq', 'interest'],
    },
    {
        id: 'news-cash-rate',
        title: 'Cash rate decision',
        description: 'Latest commentary on the official cash rate and what it means for borrowers.',
        kind: 'News',
        href: '/news/cash-rate',
        keywords: ['cash rate', 'rba', 'news'],
    },
    {
        id: 'locate-sydney-cbd',
        title: 'Sydney CBD branch',
        description: 'Full-service branch on George Street with tellers and lenders.',
        kind: 'Locate',
        href: '/locate/sydney-cbd',
        keywords: ['sydney', 'branch', 'cbd', 'locate'],
    },
    {
        id: 'tool-repayments',
        title: 'Repayments calculator',
        description: 'Estimate weekly, fortnightly, or monthly loan repayments.',
        kind: 'Tool',
        href: '/calculators#repayments',
        keywords: ['repayments', 'repayment', 'loan repayment'],
    },
    {
        id: 'tool-borrowing',
        title: 'Borrowing power calculator',
        description: 'Estimate how much you may be able to borrow based on income and expenses.',
        kind: 'Tool',
        href: '/calculators#borrowing',
        keywords: ['borrowing', 'borrowing power', 'borrow'],
    },
    {
        id: 'tool-savings-goal',
        title: 'Savings goal calculator',
        description: 'Plan regular deposits to reach a savings target by a chosen date.',
        kind: 'Tool',
        href: '/calculators#savings-goal',
        keywords: ['savings goal', 'savings', 'goal'],
    },
    {
        id: 'tool-foreign-exchange',
        title: 'Foreign exchange calculator',
        description: 'Convert currencies and estimate the cost of an international transfer.',
        kind: 'Tool',
        href: '/calculators#foreign-exchange',
        keywords: ['foreign exchange', 'fx', 'currency', 'exchange'],
    },
];

function normalize(value: string): string {
    return value.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function entryMatches(entry: SiteSearchEntry, query: string): boolean {
    const fields = [entry.title, entry.description, ...entry.keywords].map(normalize);
    if (fields.some((field) => field.includes(query))) {
        return true;
    }

    const tokens = query.split(' ').filter(Boolean);
    return tokens.every((token) => fields.some((field) => field.includes(token)));
}

export function searchSiteIndex(query: string): SiteSearchEntry[] {
    const normalized = normalize(query);
    if (!normalized) {
        return [];
    }

    return SITE_SEARCH_INDEX.filter((entry) => entryMatches(entry, normalized));
}
