// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export enum DemoRewriteAction {
    SIMPLIFY = 'simplify',
    PROFESSIONAL = 'professional',
    SHORTEN = 'shorten',
    SUMMARIZE = 'summarize',
}

export function transformMessage(message: string, action: DemoRewriteAction): string {
    switch (action) {
    case DemoRewriteAction.SIMPLIFY:
        return message.
            replace(/[*_~`#[\]()]/g, '').
            slice(0, 200);
    case DemoRewriteAction.PROFESSIONAL:
        return `Dear team,\n\n${message}\n\nBest regards`;
    case DemoRewriteAction.SHORTEN: {
        const sentenceMatch = message.match(/^[^.!?]+[.!?]?/);
        const firstSentence = sentenceMatch ? sentenceMatch[0].trim() : message;
        if (firstSentence.length <= 80) {
            return firstSentence + (message.length > firstSentence.length ? '…' : '');
        }
        return message.slice(0, 80) + '…';
    }
    case DemoRewriteAction.SUMMARIZE: {
        const lines = message.split('\n').filter((line) => line.trim());
        const firstLine = lines[0] || message;
        return `• ${firstLine}\n(${lines.length || 1} lines total)`;
    }
    default:
        return message;
    }
}
