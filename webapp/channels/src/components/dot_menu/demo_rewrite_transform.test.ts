// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DemoRewriteAction, transformMessage} from './demo_rewrite_transform';

describe('demo_rewrite_transform', () => {
    test('simplify strips markdown and truncates to 200 chars', () => {
        const message = '**Hello** _world_ with `code` and #heading';
        expect(transformMessage(message, DemoRewriteAction.SIMPLIFY)).toBe('Hello world with code and heading');
    });

    test('professional wraps message with greeting and closing', () => {
        const message = 'Please review the draft.';
        expect(transformMessage(message, DemoRewriteAction.PROFESSIONAL)).toBe(
            'Dear team,\n\nPlease review the draft.\n\nBest regards',
        );
    });

    test('shorten returns first sentence when short enough', () => {
        const message = 'First sentence. Second sentence.';
        expect(transformMessage(message, DemoRewriteAction.SHORTEN)).toBe('First sentence.…');
    });

    test('shorten truncates long messages to 80 chars', () => {
        const message = 'a'.repeat(120);
        expect(transformMessage(message, DemoRewriteAction.SHORTEN)).toBe('a'.repeat(80) + '…');
    });

    test('summarize returns first line bullet and line count', () => {
        const message = 'Line one\nLine two\nLine three';
        expect(transformMessage(message, DemoRewriteAction.SUMMARIZE)).toBe('• Line one\n(3 lines total)');
    });
});
