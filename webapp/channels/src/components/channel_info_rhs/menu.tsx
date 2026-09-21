// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo, useState} from 'react';
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

const MenuContainer = styled.nav`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 16px 0;

    font-size: 14px;
    line-height: 20px;
    color: rgb(var(--center-channel-color-rgb));
`;

const MenuItemButton = styled.button`
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
            type='button'
            id={id || ''}
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
    const getUnreadCount = useMemo(makeGetChannelUnreadCount, []);
    const unreadCount = useSelector((state: GlobalState) => getUnreadCount(state, channel.id));
    const isBookmarksEnabled = useSelector(getIsChannelBookmarksEnabled);
    const bookmarks = useSelector((state: GlobalState) => getChannelBookmarks(state, channel.id));
    const bookmarkCount = Object.keys(bookmarks).length;
    const scheduledPostsEnabled = useSelector(isScheduledPostsEnabled);
    const scheduledPostCount = useSelector((state: GlobalState) => showChannelOrThreadScheduledPostIndicator(state, channel.id).count);

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
            <MenuItem
                id='channelInfoRHSUnreads'
                icon={<i className='icon icon-mark-as-unread'/>}
                text={formatMessage({
                    id: 'channel_info_rhs.menu.unreads',
                    defaultMessage: 'Unreads',
                })}
                badge={unreadCount.messages}
                badgeMention={unreadCount.mentions > 0}
                badgeUrgent={unreadCount.hasUrgent}
                onClick={() => {
                    if (unreadCount.messages <= 0) {
                        return;
                    }
                    EventEmitter.emit(EventTypes.POST_LIST_SCROLL_TO_UNREAD_MESSAGES);
                }}
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
                    opensSubpanel={true}
                    badge={bookmarkCount}
                    onClick={() => actions.showChannelBookmarks(channel.id)}
                />
            )}
            {scheduledPostsEnabled && (
                <MenuItem
                    id='channelInfoRHSScheduledPosts'
                    icon={<i className='icon icon-clock-send-outline'/>}
                    text={formatMessage({
                        id: 'channel_info_rhs.menu.scheduled_posts',
                        defaultMessage: 'Scheduled posts',
                    })}
                    badge={scheduledPostCount}
                    onClick={() => actions.openScheduledPosts(channel.id)}
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
