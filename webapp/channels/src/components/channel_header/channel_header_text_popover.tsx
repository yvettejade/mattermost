// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    autoUpdate,
    useDismiss,
    safePolygon,
    useFocus,
    useHover,
    useTransitionStyles,
    useInteractions,
    useRole,
    useMergeRefs,
    useFloating,
    FloatingPortal,
    FloatingOverlay,
    useClick,
    offset,
} from '@floating-ui/react';
import classNames from 'classnames';
import React, {useCallback, useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {MouseEvent} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';

import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';

import Markdown from 'components/markdown';

import {OverlaysTimings, OverlayTransitionStyles, RootHtmlPortalId} from 'utils/constants';
import type {ChannelNamesMap} from 'utils/text_formatting';
import {handleFormattedTextClick} from 'utils/utils';

import './channel_header_text_popover.scss';

const TEXT_IN_HEADER_MARKDOWN_OPTIONS = {singleline: true};
const TEXT_IN_POPOVER_MARKDOWN_OPTIONS = {singleline: false};
const MENTION_MARKDOWN_OPTIONS = {mentionHighlight: false, atMentions: true};
const IMAGE_MARKDOWN_OPTIONS = {hideUtilities: true};

const TRANSITION_STYLE_PROPS = {
    duration: {
        open: OverlaysTimings.FADE_IN_DURATION,
        close: OverlaysTimings.FADE_OUT_DURATION,
    },
    initial: OverlayTransitionStyles.START,
};

const PADDING_Y_OF_POPOVER = 6; // padding top & bottom of .channel-header-text-popover in channel_header_text_popover.scss
const PADDING_X_OF_POPOVER = 8; // padding right & left of .channel-header-text-popover in channel_header_text_popover.scss
const BORDER_WIDTH_OF_POPOVER = 1; // border of .channel-header-text-popover in channel_header_text_popover.scss

export const HEADER_TEXT_LINE_HEIGHT_PX = 24;
export const HEADER_TEXT_COLLAPSED_LINE_COUNT = 2;
export const HEADER_TEXT_COLLAPSED_MAX_HEIGHT_PX = HEADER_TEXT_LINE_HEIGHT_PX * HEADER_TEXT_COLLAPSED_LINE_COUNT;

interface Props {
    text: string;
    channelMentionsNameMap?: ChannelNamesMap;
}
export function ChannelHeaderTextPopover(props: Props) {
    const currentRelativeTeamUrl = useSelector(getCurrentRelativeTeamUrl);

    const rootElementRef = useRef<HTMLDivElement>(null);
    const [isExpanded, setExpanded] = useState(false);
    const [isOverflowing, setOverflowing] = useState(false);

    const measureOverflow = useCallback(() => {
        setOverflowing(checkIfTextIsOverflowing(rootElementRef.current, props.text, HEADER_TEXT_COLLAPSED_MAX_HEIGHT_PX));
    }, [props.text]);

    useLayoutEffect(() => {
        setExpanded(false);
    }, [props.text]);

    useLayoutEffect(() => {
        measureOverflow();
        window.addEventListener('resize', measureOverflow);
        return () => window.removeEventListener('resize', measureOverflow);
    }, [measureOverflow, isExpanded]);

    const markdownOptions = useMemo(() => {
        const inHeader = {
            ...TEXT_IN_HEADER_MARKDOWN_OPTIONS,
            ...MENTION_MARKDOWN_OPTIONS,
            channelNamesMap: props.channelMentionsNameMap,
        };
        const inPopover = {
            ...TEXT_IN_POPOVER_MARKDOWN_OPTIONS,
            ...MENTION_MARKDOWN_OPTIONS,
            channelNamesMap: props.channelMentionsNameMap,
        };

        return {
            inHeader,
            inPopover,
        };
    }, [props.channelMentionsNameMap]);

    const [isPopoverOpen, setPopoverOpen] = useState(false);
    const popoverEnabled = isOverflowing && !isExpanded;

    const {refs: {setReference, setFloating}, floatingStyles, context: floatingContext} = useFloating({
        open: popoverEnabled ? isPopoverOpen : false,
        onOpenChange: setPopoverOpen,
        whileElementsMounted: autoUpdate,
        middleware: [
            offset(() => {
                const headerHeight = rootElementRef.current?.clientHeight ?? HEADER_TEXT_LINE_HEIGHT_PX;
                return -((headerHeight + PADDING_Y_OF_POPOVER) - (2 * BORDER_WIDTH_OF_POPOVER));
            }),
        ],
    });
    const {isMounted, styles: transitionStyles} = useTransitionStyles(
        floatingContext,
        TRANSITION_STYLE_PROPS,
    );

    const hover = useHover(floatingContext, {
        enabled: popoverEnabled,
        handleClose: safePolygon({
            requireIntent: false,
            blockPointerEvents: true,
        }),
    });
    const focus = useFocus(floatingContext);
    const dismiss = useDismiss(floatingContext);
    const click = useClick(floatingContext);
    const role = useRole(floatingContext, {role: 'tooltip'});

    const {getReferenceProps, getFloatingProps} = useInteractions([hover, focus, click, dismiss, role]);

    const rootRef = useMergeRefs([rootElementRef, setReference]);

    const maxWidthOfPopover = getMaxWidthOfPopover(rootElementRef?.current);

    // This action processes clicks on formatted text elements like hashtags, user mentions,
    // channel mentions, etc. while also allowing other elements to function as is such as external links etc
    function handleClick(event: MouseEvent<HTMLDivElement>) {
        handleFormattedTextClick(event, currentRelativeTeamUrl);
    }

    function toggleExpanded(event: MouseEvent<HTMLButtonElement>) {
        event.preventDefault();
        event.stopPropagation();
        setPopoverOpen(false);
        setExpanded((prev) => !prev);
    }

    return (
        <div className='channel-header-text'>
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
            <div
                ref={rootRef}
                className={classNames('header-description__text', {expanded: isExpanded})}
                {...getReferenceProps()}
                onClick={handleClick}
            >
                <Markdown
                    message={props.text}
                    options={isExpanded ? markdownOptions.inPopover : markdownOptions.inHeader}
                    imageProps={IMAGE_MARKDOWN_OPTIONS}
                />
            </div>

            {isOverflowing && (
                <Button
                    type='button'
                    emphasis='tertiary'
                    size='xs'
                    className='channel-header-text__toggle'
                    aria-expanded={isExpanded}
                    onClick={toggleExpanded}
                >
                    {isExpanded ? (
                        <FormattedMessage
                            id='channel_header.headerText.showLess'
                            defaultMessage='Show less'
                        />
                    ) : (
                        <FormattedMessage
                            id='channel_header.headerText.showMore'
                            defaultMessage='Show more'
                        />
                    )}
                </Button>
            )}

            {isMounted && (
                <FloatingPortal id={RootHtmlPortalId}>
                    <FloatingOverlay
                        className='channel-header-text-popover-floating-overlay'
                        lockScroll={true}
                    >
                        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
                        <div
                            ref={setFloating}
                            className='channel-header-text-popover'
                            style={{
                                maxWidth: maxWidthOfPopover,
                                ...floatingStyles,
                                ...transitionStyles,
                            }}
                            onClick={handleClick}
                            {...getFloatingProps()}
                        >
                            <Markdown
                                message={props.text}
                                options={markdownOptions.inPopover}
                                imageProps={IMAGE_MARKDOWN_OPTIONS}
                            />
                        </div>
                    </FloatingOverlay>
                </FloatingPortal>
            )}
        </div>
    );
}

export function checkIfTextIsOverflowing(elem: HTMLDivElement | null, text: string, collapsedMaxHeight = HEADER_TEXT_COLLAPSED_MAX_HEIGHT_PX): boolean {
    const newlineCount = (text.match(/\n/g) || []).length;
    if (newlineCount >= HEADER_TEXT_COLLAPSED_LINE_COUNT) {
        return true;
    }

    if (!elem) {
        return false;
    }

    if (elem.scrollHeight > collapsedMaxHeight) {
        return true;
    }

    if (elem.scrollWidth === elem.clientWidth && elem.scrollHeight === elem.clientHeight) {
        return false;
    }

    return elem.scrollWidth > elem.clientWidth || elem.scrollHeight > elem.clientHeight;
}

function getMaxWidthOfPopover(elem: HTMLDivElement | null): string | number {
    if (!elem) {
        return 'inherit';
    }

    return (elem.clientWidth) + ((2 * PADDING_X_OF_POPOVER) + (2 * BORDER_WIDTH_OF_POPOVER));
}
