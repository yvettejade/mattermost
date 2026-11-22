// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {Link} from 'react-router-dom';
import styled, {css} from 'styled-components';

import type {Channel, ChannelStats} from '@mattermost/types/channels';

import {openModal} from 'actions/views/modals';
import {canAccessChannelSettings} from 'selectors/views/channel_settings';

import ChannelSettingsModal from 'components/channel_settings_modal/channel_settings_modal';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import {getFirstFocusableChild} from 'utils/a11y_utils';
import {Constants, ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

const MenuContainer = styled.nav`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 16px 0;

    font-size: 14px;
    line-height: 20px;
    color: rgb(var(--center-channel-color-rgb));
`;

const menuItemStyles = css`
    display: flex;
    flex-direction: row;
    align-items: center;
    width: 100%;
    height: 40px;
    padding: 8px 16px;

    background: none;
    border: none;
    text-align: left;
`;

const interactiveMenuItemStyles = css`
    cursor: pointer;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        text-decoration: none;
    }
`;

const MenuItemButton = styled.button`
    ${menuItemStyles}
    ${interactiveMenuItemStyles}
`;

const MenuItemLink = styled(Link)`
    ${menuItemStyles}
    ${interactiveMenuItemStyles}
    color: inherit;

    &:hover,
    &:focus {
        color: inherit;
    }
`;

const MenuItemStatic = styled.div`
    ${menuItemStyles}
    cursor: default;
`;

const Icon = styled.div`
    color: rgba(var(--center-channel-color-rgb), var(--icon-opacity));
`;

const MenuItemText = styled.div`
    padding-left: 8px;
    flex: 1;
`;

const RightSide = styled.div`
    display: flex;
    color: rgba(var(--center-channel-color-rgb), 0.75);
`;

const Badge = styled.div`
    font-size: 12px;
    line-height: 18px;
    width: 20px;
    display: flex;
    place-content: center;
`;

const MentionBadge = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 18px;
    margin-left: 4px;
    padding: 0 6px;
    border-radius: 9px;
    font-size: 12px;
    font-weight: 700;
    line-height: 18px;
    background: var(--mention-bg);
    color: var(--mention-color);
`;

interface MenuItemProps {
    icon: JSX.Element;
    text: string;
    opensSubpanel?: boolean;
    badge?: string | number | JSX.Element;
    onClick?: () => void;
    to?: string;
    id?: string;
}

function MenuItem(props: MenuItemProps) {
    const {icon, text, opensSubpanel, badge, onClick, to, id} = props;
    const hasRightSide = (badge !== undefined) || opensSubpanel;

    const content = (
        <>
            <Icon>{icon}</Icon>
            <MenuItemText>{text}</MenuItemText>
            {hasRightSide && (
                <RightSide>
                    {badge !== undefined && (
                        <Badge>{badge}</Badge>
                    )}
                    {opensSubpanel && (
                        <Icon><i className='icon icon-chevron-right'/></Icon>
                    )}
                </RightSide>
            )}
        </>
    );

    if (to) {
        return (
            <MenuItemLink
                to={to}
                aria-label={text}
                id={id || ''}
            >
                {content}
            </MenuItemLink>
        );
    }

    if (!onClick) {
        return (
            <MenuItemStatic id={id || ''}>
                {content}
            </MenuItemStatic>
        );
    }

    return (
        <MenuItemButton
            onClick={onClick}
            aria-label={text}
            type='button'
            id={id || ''}
        >
            {content}
        </MenuItemButton>
    );
}

interface UnreadItemProps {
    messages: number;
    mentions: number;
}

function UnreadItem({messages, mentions}: UnreadItemProps) {
    const {formatMessage} = useIntl();

    const summary = formatMessage({
        id: 'channel_info_rhs.menu.unread.summary',
        defaultMessage: '{messages, plural, one {# unread message} other {# unread messages}}, {mentions, plural, one {# mention} other {# mentions}}',
    }, {messages, mentions});

    return (
        <MenuItemStatic
            id='channelInfoRHSUnread'
            role='group'
            aria-label={summary}
        >
            <Icon aria-hidden='true'><i className='icon icon-mark-as-unread'/></Icon>
            <MenuItemText aria-hidden='true'>
                {formatMessage({
                    id: 'channel_info_rhs.menu.unread',
                    defaultMessage: 'Unread',
                })}
            </MenuItemText>
            <RightSide aria-hidden='true'>
                <Badge>{messages}</Badge>
                {mentions > 0 && <MentionBadge>{mentions}</MentionBadge>}
            </RightSide>
        </MenuItemStatic>
    );
}

const BOOKMARKS_BAR_SELECTOR = '[data-testid="channel-bookmarks-container"]';

function focusBookmarksBar() {
    const bar = document.querySelector<HTMLElement>(BOOKMARKS_BAR_SELECTOR);
    if (!bar) {
        return;
    }

    bar.scrollIntoView?.({block: 'nearest'});
    (getFirstFocusableChild(bar) ?? bar).focus();
}

interface MenuProps {
    channel: Channel;
    channelStats: ChannelStats;
    isArchived: boolean;
    teamName: string;
    unreadCount: {messages: number; mentions: number};
    bookmarksCount: number;
    isBookmarksEnabled: boolean;
    scheduledPostsCount: number;
    isScheduledPostsEnabled: boolean;

    className?: string;

    actions: {
        openNotificationSettings: () => void;
        showChannelFiles: (channelId: string) => void;
        showPinnedPosts: (channelId: string | undefined) => void;
        showChannelMembers: (channelId: string) => void;
        getChannelStats: (channelId: string, includeFileCount: boolean) => Promise<{data: ChannelStats}>;
        fetchChannelBookmarks: (channelId: string) => void;
    };
}

export default function Menu(props: MenuProps) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const {
        channel,
        channelStats,
        isArchived,
        teamName,
        unreadCount,
        bookmarksCount,
        isBookmarksEnabled,
        scheduledPostsCount,
        isScheduledPostsEnabled,
        className,
        actions,
    } = props;

    const [loadingStats, setLoadingStats] = useState(true);

    const showNotificationPreferences = channel.type !== Constants.DM_CHANNEL && !isArchived;
    const showMembers = channel.type !== Constants.DM_CHANNEL;
    const showChannelSettings = channel.type !== Constants.DM_CHANNEL && channel.type !== Constants.GM_CHANNEL && !isArchived;
    const fileCount = channelStats?.files_count >= 0 ? channelStats?.files_count : 0;
    const canAccessSettings = useSelector((state: GlobalState) => canAccessChannelSettings(state, channel.id));

    useEffect(() => {
        actions.getChannelStats(channel.id, true).then(() => {
            setLoadingStats(false);
        });
        return () => {
            setLoadingStats(true);
        };
    }, [channel.id]);

    useEffect(() => {
        if (isBookmarksEnabled) {
            actions.fetchChannelBookmarks(channel.id);
        }
    }, [channel.id, isBookmarksEnabled]);

    const openChannelSettings = () => {
        dispatch(
            openModal({
                modalId: ModalIdentifiers.CHANNEL_SETTINGS,
                dialogType: ChannelSettingsModal,
                dialogProps: {
                    channelId: channel.id,
                    focusOriginElement: 'channelInfoRHSChannelSettings',
                    isOpen: true,
                },
            }),
        );
    };

    return (
        <MenuContainer
            className={className}
            data-testid='channel_info_rhs-menu'
            aria-label={formatMessage({
                id: 'channel_info_rhs.menu.title',
                defaultMessage: 'Channel Info Actions',
            })}
        >
            {showChannelSettings && canAccessSettings && (
                <MenuItem
                    id='channelInfoRHSChannelSettings'
                    icon={<i className='icon icon-cog-outline'/>}
                    text={formatMessage({
                        id: 'channel_header.channel_settings',
                        defaultMessage: 'Channel Settings',
                    })}
                    onClick={openChannelSettings}
                />
            )}
            {showNotificationPreferences && (
                <MenuItem
                    id='channelInfoRHSNotificationSettings'
                    icon={<i className='icon icon-bell-outline'/>}
                    text={formatMessage({
                        id: 'channel_info_rhs.menu.notification_preferences',
                        defaultMessage: 'Notification Preferences',
                    })}
                    onClick={actions.openNotificationSettings}
                />
            )}
            <UnreadItem
                messages={Math.max(unreadCount.messages, 0)}
                mentions={Math.max(unreadCount.mentions, 0)}
            />
            {showMembers && (
                <MenuItem
                    icon={<i className='icon icon-account-outline'/>}
                    text={formatMessage({
                        id: 'channel_info_rhs.menu.members',
                        defaultMessage: 'Members',
                    })}
                    opensSubpanel={true}
                    badge={channelStats.member_count}
                    onClick={() => actions.showChannelMembers(channel.id)}
                />
            )}
            <MenuItem
                icon={<i className='icon icon-pin-outline'/>}
                text={formatMessage({
                    id: 'channel_info_rhs.menu.pinned',
                    defaultMessage: 'Pinned messages',
                })}
                opensSubpanel={true}
                badge={channelStats?.pinnedpost_count}
                onClick={() => actions.showPinnedPosts(channel.id)}
            />
            {isBookmarksEnabled && (
                <MenuItem
                    id='channelInfoRHSBookmarks'
                    icon={<i className='icon icon-bookmark-outline'/>}
                    text={formatMessage({
                        id: 'channel_info_rhs.menu.bookmarks',
                        defaultMessage: 'Bookmarks',
                    })}
                    badge={bookmarksCount}
                    onClick={bookmarksCount > 0 ? focusBookmarksBar : undefined}
                />
            )}
            {isScheduledPostsEnabled && (
                <MenuItem
                    id='channelInfoRHSScheduledPosts'
                    icon={<i className='icon icon-clock-send-outline'/>}
                    text={formatMessage({
                        id: 'channel_info_rhs.menu.scheduled_posts',
                        defaultMessage: 'Scheduled posts',
                    })}
                    opensSubpanel={true}
                    badge={scheduledPostsCount}
                    to={`/${teamName}/scheduled_posts`}
                />
            )}
            <MenuItem
                icon={<i className='icon icon-file-text-outline'/>}
                text={formatMessage({
                    id: 'channel_info_rhs.menu.files',
                    defaultMessage: 'Files',
                })}
                opensSubpanel={true}
                badge={loadingStats ? <LoadingSpinner/> : fileCount}
                onClick={() => actions.showChannelFiles(channel.id)}
            />
        </MenuContainer>
    );
}
