// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {Component, useEffect, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled, {css} from 'styled-components';

import type {Channel, ChannelStats} from '@mattermost/types/channels';

import {getChannelBookmarks} from 'mattermost-redux/selectors/entities/channel_bookmarks';
import {makeGetChannelUnreadCount} from 'mattermost-redux/selectors/entities/channels';
import {isScheduledPostsEnabled, showChannelOrThreadScheduledPostIndicator} from 'mattermost-redux/selectors/entities/scheduled_posts';
import EventEmitter from 'mattermost-redux/utils/event_emitter';

import {openModal} from 'actions/views/modals';
import {canAccessChannelSettings} from 'selectors/views/channel_settings';

import {getIsChannelBookmarksEnabled} from 'components/channel_bookmarks/utils';
import ChannelSettingsModal from 'components/channel_settings_modal/channel_settings_modal';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import {Constants, EventTypes, ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

const EMPTY_UNREAD_COUNT = {
    showUnread: false,
    hasUrgent: false,
    mentions: 0,
    messages: 0,
};

const MenuContainer = styled.nav`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 16px 0;

    font-size: 14px;
    line-height: 20px;
    color: rgb(var(--center-channel-color-rgb));
`;

const MenuItemButton = styled.button.attrs({type: 'button'})`
    display: flex;
    flex-direction: row;
    align-items: center;
    width: 100%;
    height: 40px;
    padding: 8px 16px;

    background: none;
    border: none;
    text-align: left;
    cursor: pointer;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }
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

const Badge = styled.div<{$mention?: boolean; $urgent?: boolean}>`
    font-size: 12px;
    line-height: 18px;
    min-width: 20px;
    display: flex;
    place-content: center;

    ${({$mention, $urgent}) => ($mention || $urgent) && css`
        padding: 0 6px;
        border-radius: 8px;
        font-weight: 700;
        background: var(--mention-bg);
        color: var(--mention-color);
    `}

    ${({$urgent}) => $urgent && css`
        background-color: var(--dnd-indicator);
        color: #fff;
    `}
`;

interface MenuItemProps {
    icon: JSX.Element;
    text: string;
    opensSubpanel?: boolean;
    badge?: string | number | JSX.Element;
    badgeMention?: boolean;
    badgeUrgent?: boolean;
    onClick: () => void;
    id?: string;
}

function MenuItem(props: MenuItemProps) {
    const {icon, text, opensSubpanel, badge, badgeMention, badgeUrgent, onClick, id} = props;
    const hasRightSide = (badge !== undefined) || opensSubpanel;

    return (
        <MenuItemButton
            onClick={onClick}
            aria-label={text}
            id={id}
            data-testid={id}
        >
            <Icon>{icon}</Icon>
            <MenuItemText>{text}</MenuItemText>
            {hasRightSide && (
                <RightSide>
                    {badge !== undefined && (
                        <Badge
                            $mention={badgeMention}
                            $urgent={badgeUrgent}
                            data-mention={badgeMention || undefined}
                            data-urgent={badgeUrgent || undefined}
                        >
                            {badge}
                        </Badge>
                    )}
                    {opensSubpanel && (
                        <Icon><i className='icon icon-chevron-right'/></Icon>
                    )}
                </RightSide>
            )}
        </MenuItemButton>
    );
}

class MenuRowErrorBoundary extends Component<{children: React.ReactNode; fallback?: React.ReactNode}, {hasError: boolean}> {
    state = {hasError: false};

    static getDerivedStateFromError() {
        return {hasError: true};
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback ?? null;
        }

        return this.props.children;
    }
}

function selectUnreadCount(state: GlobalState, getUnreadCount: ReturnType<typeof makeGetChannelUnreadCount>, channelId: string) {
    try {
        return getUnreadCount(state, channelId) || EMPTY_UNREAD_COUNT;
    } catch {
        return EMPTY_UNREAD_COUNT;
    }
}

function UnreadsMenuItem({channelId}: {channelId: string}) {
    const {formatMessage} = useIntl();
    const getUnreadCount = useMemo(makeGetChannelUnreadCount, []);
    const unreadCount = useSelector((state: GlobalState) => selectUnreadCount(state, getUnreadCount, channelId));
    const messages = unreadCount?.messages ?? 0;
    const mentions = unreadCount?.mentions ?? 0;
    const hasUrgent = Boolean(unreadCount?.hasUrgent);

    return (
        <MenuItem
            id='channelInfoRHSUnreads'
            icon={<i className='icon icon-mark-as-unread'/>}
            text={formatMessage({
                id: 'channel_info_rhs.menu.unreads',
                defaultMessage: 'Unreads',
            })}
            badge={messages}
            badgeMention={mentions > 0}
            badgeUrgent={hasUrgent}
            onClick={() => {
                if (messages <= 0) {
                    return;
                }
                EventEmitter.emit(EventTypes.POST_LIST_SCROLL_TO_UNREAD_MESSAGES);
            }}
        />
    );
}

function BookmarksMenuItem({channelId, onClick}: {channelId: string; onClick: () => void}) {
    const {formatMessage} = useIntl();
    const isBookmarksEnabled = useSelector((state: GlobalState) => {
        try {
            return getIsChannelBookmarksEnabled(state);
        } catch {
            return false;
        }
    });
    const bookmarkCount = useSelector((state: GlobalState) => {
        try {
            return Object.keys(getChannelBookmarks(state, channelId) || {}).length;
        } catch {
            return 0;
        }
    });

    if (!isBookmarksEnabled) {
        return null;
    }

    return (
        <MenuItem
            id='channelInfoRHSBookmarks'
            icon={<i className='icon icon-bookmark-outline'/>}
            text={formatMessage({
                id: 'channel_info_rhs.menu.bookmarks',
                defaultMessage: 'Bookmarks',
            })}
            opensSubpanel={true}
            badge={bookmarkCount}
            onClick={onClick}
        />
    );
}

function ScheduledPostsMenuItem({channelId, onClick}: {channelId: string; onClick: () => void}) {
    const {formatMessage} = useIntl();
    const scheduledPostsEnabled = useSelector((state: GlobalState) => {
        try {
            return isScheduledPostsEnabled(state);
        } catch {
            return false;
        }
    });
    const scheduledPostCount = useSelector((state: GlobalState) => {
        try {
            return showChannelOrThreadScheduledPostIndicator(state, channelId).count;
        } catch {
            return 0;
        }
    });

    if (!scheduledPostsEnabled) {
        return null;
    }

    return (
        <MenuItem
            id='channelInfoRHSScheduledPosts'
            icon={<i className='icon icon-clock-send-outline'/>}
            text={formatMessage({
                id: 'channel_info_rhs.menu.scheduled_posts',
                defaultMessage: 'Scheduled posts',
            })}
            badge={scheduledPostCount}
            onClick={onClick}
        />
    );
}

interface MenuProps {
    channel: Channel;
    channelStats: ChannelStats;
    isArchived: boolean;

    className?: string;

    actions: {
        openNotificationSettings: () => void;
        showChannelFiles: (channelId: string) => void;
        showPinnedPosts: (channelId: string | undefined) => void;
        showChannelMembers: (channelId: string) => void;
        showChannelBookmarks: (channelId: string) => void;
        openScheduledPosts: (channelId: string) => void;
        getChannelStats: (channelId: string, includeFileCount: boolean) => Promise<{data: ChannelStats}>;
    };
}

export default function Menu(props: MenuProps) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const {
        channel,
        channelStats,
        isArchived,
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
            <MenuRowErrorBoundary
                fallback={(
                    <MenuItem
                        id='channelInfoRHSUnreads'
                        icon={<i className='icon icon-mark-as-unread'/>}
                        text={formatMessage({
                            id: 'channel_info_rhs.menu.unreads',
                            defaultMessage: 'Unreads',
                        })}
                        badge={0}
                        onClick={() => undefined}
                    />
                )}
            >
                <UnreadsMenuItem channelId={channel.id}/>
            </MenuRowErrorBoundary>
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
            <MenuRowErrorBoundary>
                <BookmarksMenuItem
                    channelId={channel.id}
                    onClick={() => actions.showChannelBookmarks(channel.id)}
                />
            </MenuRowErrorBoundary>
            <MenuRowErrorBoundary>
                <ScheduledPostsMenuItem
                    channelId={channel.id}
                    onClick={() => actions.openScheduledPosts(channel.id)}
                />
            </MenuRowErrorBoundary>
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
