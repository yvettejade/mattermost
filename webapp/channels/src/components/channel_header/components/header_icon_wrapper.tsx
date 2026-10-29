// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {forwardRef} from 'react';

import type {ShortcutDefinition} from '@mattermost/shared/components/tooltip';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import NewChannelWithBoardTourTip from 'components/app_bar/new_channel_with_board_tour_tip';

import {suitePluginIds} from 'utils/constants';

type Props = {

    /**
     * ariaLabelOverride lets you override the aria-label which would otherwise use the tooltip text. This typically
     * shouldn't be needed.
     */
    ariaLabelOverride?: string;

    buttonClass?: string;
    buttonId: string;
    children: React.ReactNode;
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
    tooltip: string;
    tooltipShortcut?: ShortcutDefinition;
    isRhsOpen?: boolean;
    pluginId?: string;
    popover?: {id: string; isOpen: boolean};
}

const HeaderIconWrapper = forwardRef<HTMLButtonElement, Props>((props, ref) => {
    const {
        ariaLabelOverride,
        buttonClass,
        buttonId,
        children,
        onClick,
        tooltip: tooltipText,
        tooltipShortcut,
        isRhsOpen,
        pluginId,
        popover,
    } = props;

    const boardsEnabled = pluginId === suitePluginIds.focalboard;

    const ariaLabelText = ariaLabelOverride ?? tooltipText;
    const isPopoverOpen = popover?.isOpen ?? false;

    return (
        <>
            <WithTooltip
                title={isRhsOpen || isPopoverOpen ? '' : tooltipText}
                shortcut={tooltipShortcut}
            >
                <button
                    ref={ref}
                    id={buttonId}
                    aria-label={ariaLabelText}
                    aria-haspopup={popover ? 'dialog' : undefined}
                    aria-expanded={popover ? isPopoverOpen : undefined}
                    aria-controls={isPopoverOpen ? popover?.id : undefined}
                    className={buttonClass || 'channel-header__icon'}
                    onClick={onClick}
                >
                    {children}
                </button>
            </WithTooltip>
            {boardsEnabled &&
                <NewChannelWithBoardTourTip
                    pulsatingDotPlacement={'start'}
                    pulsatingDotTranslate={{x: 0, y: -22}}
                />
            }
        </>
    );
});
HeaderIconWrapper.displayName = 'HeaderIconWrapper';

export default HeaderIconWrapper;
