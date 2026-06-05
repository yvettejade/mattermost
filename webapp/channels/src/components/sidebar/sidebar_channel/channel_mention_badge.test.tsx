// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import ChannelMentionBadge from './channel_mention_badge';

const urgentTooltipDescriptor = {
    id: 'channel_mention_badge.urgent_tooltip',
    defaultMessage: 'You have an urgent mention',
};

describe('ChannelMentionBadge', () => {
    it('should render nothing when unreadMentions is 0', () => {
        const {container} = renderWithContext(
            <ChannelMentionBadge unreadMentions={0}/>,
        );

        expect(container.firstChild).toBeNull();
    });

    it('should render badge when unreadMentions > 0', () => {
        renderWithContext(
            <ChannelMentionBadge unreadMentions={3}/>,
        );

        expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should add urgent class when hasUrgent is true', () => {
        renderWithContext(
            <ChannelMentionBadge
                unreadMentions={1}
                hasUrgent={true}
            />,
        );

        expect(screen.getByText('1').closest('.badge')).toHaveClass('urgent');
    });

    it('should not add urgent class when hasUrgent is false', () => {
        renderWithContext(
            <ChannelMentionBadge
                unreadMentions={1}
                hasUrgent={false}
            />,
        );

        expect(screen.getByText('1').closest('.badge')).not.toHaveClass('urgent');
    });

    it('should show tooltip on hover when tooltip prop is provided', async () => {
        jest.useFakeTimers();

        renderWithContext(
            <ChannelMentionBadge
                unreadMentions={2}
                hasUrgent={true}
                tooltip={urgentTooltipDescriptor}
            />,
        );

        const badge = screen.getByText('2').closest('.badge')!;
        await userEvent.hover(badge, {advanceTimers: jest.advanceTimersByTime});

        await waitFor(() => {
            expect(screen.getByText('You have an urgent mention')).toBeInTheDocument();
        });
    });

    it('should not render WithTooltip wrapper when tooltip prop is not provided', () => {
        const {container} = renderWithContext(
            <ChannelMentionBadge
                unreadMentions={2}
                hasUrgent={true}
            />,
        );

        const badge = screen.getByText('2').closest('.badge')!;
        expect(badge).toBeInTheDocument();
        expect(container.querySelector('.tooltipContainer')).not.toBeInTheDocument();
    });

    it('should display 99+ when unreadMentions exceeds cap (HP-2, UT-2)', () => {
        renderWithContext(
            <ChannelMentionBadge unreadMentions={150}/>,
        );

        expect(screen.getByText('99+')).toBeInTheDocument();
        expect(screen.queryByText('150')).not.toBeInTheDocument();
    });

    it('should display exact count at boundary 99 and cap at 100 (EC-1)', () => {
        const {rerender} = renderWithContext(
            <ChannelMentionBadge unreadMentions={99}/>,
        );

        expect(screen.getByText('99')).toBeInTheDocument();

        rerender(<ChannelMentionBadge unreadMentions={100}/>);

        expect(screen.getByText('99+')).toBeInTheDocument();
    });

    it('should keep urgent class when capped count is displayed (EC-2)', () => {
        renderWithContext(
            <ChannelMentionBadge
                unreadMentions={120}
                hasUrgent={true}
            />,
        );

        expect(screen.getByText('99+').closest('.badge')).toHaveClass('urgent');
    });

    it('should transition from no badge to count 1 on first mention (ST-1)', () => {
        const {rerender, container} = renderWithContext(
            <ChannelMentionBadge unreadMentions={0}/>,
        );

        expect(container.firstChild).toBeNull();

        rerender(<ChannelMentionBadge unreadMentions={1}/>);

        expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should increment badge count when mentions increase (ST-2)', () => {
        const {rerender} = renderWithContext(
            <ChannelMentionBadge unreadMentions={3}/>,
        );

        expect(screen.getByText('3')).toBeInTheDocument();

        rerender(<ChannelMentionBadge unreadMentions={4}/>);

        expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('should remove badge when mentions reach zero (ST-5)', () => {
        const {rerender, container} = renderWithContext(
            <ChannelMentionBadge unreadMentions={5}/>,
        );

        expect(screen.getByText('5')).toBeInTheDocument();

        rerender(<ChannelMentionBadge unreadMentions={0}/>);

        expect(container.firstChild).toBeNull();
    });

    it('should have non-zero offsetHeight when badge is visible (EC-7)', () => {
        Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
            configurable: true,
            get() {
                return this.id === 'unreadMentions' ? 16 : 0;
            },
        });

        renderWithContext(
            <ChannelMentionBadge unreadMentions={120}/>,
        );

        const badge = document.getElementById('unreadMentions');
        expect(badge).toBeInTheDocument();
        expect(badge!.offsetHeight).toBeGreaterThan(0);
    });
});
