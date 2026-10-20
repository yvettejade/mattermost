// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    autoUpdate,
    FloatingPortal,
    offset,
    useDismiss,
    useFloating,
    useInteractions,
    useRole,
    useTransitionStyles,
} from '@floating-ui/react';
import React, {useEffect} from 'react';

import {OverlaysTimings, OverlayTransitionStyles, RootHtmlPortalId} from 'utils/constants';

const TRANSITION_STYLE_PROPS = {
    duration: {
        open: OverlaysTimings.FADE_IN_DURATION,
        close: OverlaysTimings.FADE_OUT_DURATION,
    },
    initial: OverlayTransitionStyles.START,
};

interface Props {
    anchorRef: React.RefObject<HTMLElement | null>;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    message: React.ReactNode;
}

export function ChannelHeaderEmptyPopover({anchorRef, isOpen, onOpenChange, message}: Props) {
    const {refs: {setReference, setFloating}, floatingStyles, context} = useFloating({
        open: isOpen,
        onOpenChange,
        whileElementsMounted: autoUpdate,
        middleware: [offset(8)],
    });

    useEffect(() => {
        if (anchorRef.current) {
            setReference(anchorRef.current);
        }
    }, [anchorRef, isOpen, setReference]);

    const dismiss = useDismiss(context);
    const role = useRole(context, {role: 'tooltip'});
    const {getFloatingProps} = useInteractions([dismiss, role]);

    const {isMounted, styles: transitionStyles} = useTransitionStyles(context, TRANSITION_STYLE_PROPS);

    if (!isMounted) {
        return null;
    }

    return (
        <FloatingPortal id={RootHtmlPortalId}>
            <div
                ref={setFloating}
                className='channel-header-text-popover channel-header-text-popover--empty'
                style={{
                    ...floatingStyles,
                    ...transitionStyles,
                }}
                {...getFloatingProps()}
            >
                {message}
            </div>
        </FloatingPortal>
    );
}
