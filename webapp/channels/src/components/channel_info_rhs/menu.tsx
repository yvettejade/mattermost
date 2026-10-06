// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';
import styled from 'styled-components';

import type {Channel, ChannelStats} from '@mattermost/types/channels';

import {getChannelBookmarks} from 'mattermost-redux/selectors/entities/channel_bookmarks';
import {makeGetChannelUnreadCount} from 'mattermost-redux/selectors/entities/channels';
import {showChannelOrThreadScheduledPostIndicator, isScheduledPostsEnabled} from 'mattermost-redux/selectors/entities/scheduled_posts';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import EventEmitter from 'mattermost-redux/utils/event_emitter';

import {fetchChannelBookmarks} from 'actions/channel_bookmarks';
import {openModal} from 'actions/views/modals';
import {closeRightHandSide} from 'actions/views/rhs';
import {canAccessChannelSettings} from 'selectors/views/channel_settings';

import {getIsChannelBookmarksEnabled} from 'components/channel_bookmarks/utils';
import ChannelSettingsModal from 'components/channel_settings_modal/channel_settings_modal';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import {Constants, EventTypes, ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

import BookmarksSection from './bookmarks_section';

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
    align-items: center;
    color: rgba(var(--center-channel-color-rgb), 0.75);
`;

const Badge = styled.div`
    font-size: 12px;
    line-height: 18px;
    min-width: 20px;
    display: flex;
    place-content: center;
`;

const MentionBadge = styled.div`
    min-width: 16px;
    height: 16px;
    padding: 0 5px;
    margin-left: 4px;
    border-radius: 8px;
    background: var(--mention-bg);
    color: var(--mention-color);
    font-size: 10px;
    line-height: 16px;
    text-align: center;
    font-weight: 700;
`;

interface MenuItemProps {
    icon: JSX.Element;
    text: string;
    opensSubpanel?: boolean;
    expanded?: boolean;
    badge?: string | number | JSX.Element;
    onClick: () => void;
    id?: string;
}

function MenuItem(props: MenuItemProps) {
    const {icon, text, opensSubpanel, expanded, badge, onClick, id} = props;
    const hasRightSide = (badge !== undefined) || opensSubpanel;

    let chevron;
    if (opensSubpanel) {
        chevron = expanded ? 'icon icon-chevron-down' : 'icon icon-chevron-right';
    }

    return (
        <MenuItemButton
            onClick={onClick}
            aria-label={text}
            type='button'
            id={id || ''}
            aria-expanded={opensSubpanel && expanded !== undefined ? expanded : undefined}
        >
            <Icon>{icon}</Icon>
            <MenuItemText>{text}</MenuItemText>
            {hasRightSide && (
                <RightSide>
                    {badge !== undefined && (
                        <Badge>{badge}</Badge>
                    )}
                    {chevron && (
                        <Icon><i className={chevron}/></Icon>
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
        getChannelStats: (channelId: string, includeFileCount: boolean) => Promise<{data: ChannelStats}>;
    };
}

export default function Menu(props: MenuProps) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const history = useHistory();
    const {
        channel,
        channelStats,
        isArchived,
        className,
        actions,
    } = props;

    const [loadingStats, setLoadingStats] = useState(true);
    const [bookmarksExpanded, setBookmarksExpanded] = useState(false);

    const showNotificationPreferences = channel.type !== Constants.DM_CHANNEL && !isArchived;
    const showMembers = channel.type !== Constants.DM_CHANNEL;
    const showChannelSettings = channel.type !== Constants.DM_CHANNEL && channel.type !== Constants.GM_CHANNEL && !isArchived;
    const fileCount = channelStats?.files_count >= 0 ? channelStats?.files_count : 0;
    const canAccessSettings = useSelector((state: GlobalState) => canAccessChannelSettings(state, channel.id));
    const bookmarksEnabled = useSelector(getIsChannelBookmarksEnabled);
    const scheduledEnabled = useSelector(isScheduledPostsEnabled);
    const currentTeam = useSelector(getCurrentTeam);
    const getUnreadCount = useMemo(makeGetChannelUnreadCount, []);
    const unreadCount = useSelector((state: GlobalState) => getUnreadCount(state, channel.id));
    const scheduledCount = useSelector((state: GlobalState) => showChannelOrThreadScheduledPostIndicator(state, channel.id).count);
    const bookmarks = useSelector((state: GlobalState) => getChannelBookmarks(state, channel.id));
    const bookmarkCount = Object.keys(bookmarks).length;

    const unreadMessages = Math.max(0, unreadCount.messages);
    const unreadMentions = Math.max(0, unreadCount.mentions);

    useEffect(() => {
        actions.getChannelStats(channel.id, true).then(() => {
            setLoadingStats(false);
        });
        dispatch(fetchChannelBookmarks(channel.id));
        setBookmarksExpanded(false);
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

    const handleUnreadsClick = () => {
        if (unreadMessages === 0 && unreadMentions === 0) {
            return;
        }
        EventEmitter.emit(EventTypes.POST_LIST_SCROLL_TO_UNREADS);
    };

    const handleScheduledClick = () => {
        if (!currentTeam?.name) {
            return;
        }
        history.push(`/${currentTeam.name}/scheduled_posts?target_id=${channel.id}`);
        dispatch(closeRightHandSide());
    };

    const unreadBadge = (
        <>
            {unreadMessages}
            {unreadMentions > 0 && (
                <MentionBadge>{unreadMentions}</MentionBadge>
            )}
        </>
    );

    return (
        <MenuContainer
            className={className}
            data-testid='channel_info_rhs-menu'
            aria-label={formatMessage({
                id: 'channel_info_rhs.menu.title',
                defaultMessage: 'Channel Info Actions',
            })}
        >
            <MenuItem
                id='channelInfoRHSUnreads'
                icon={<i className='icon icon-mark-as-unread'/>}
                text={formatMessage({
                    id: 'channel_info_rhs.menu.unreads',
                    defaultMessage: 'Unreads',
                })}
                badge={unreadBadge}
                onClick={handleUnreadsClick}
            />
            {showMembers && (
                <MenuItem
                    id='channelInfoRHSMembers'
                    icon={<i className='icon icon-account-outline'/>}
                    text={formatMessage({
                        id: 'channel_info_rhs.menu.members',
                        defaultMessage: 'Members',
                    })}
                    opensSubpanel={true}
                    badge={loadingStats ? <LoadingSpinner/> : channelStats.member_count}
                    onClick={() => actions.showChannelMembers(channel.id)}
                />
            )}
            <MenuItem
                id='channelInfoRHSPins'
                icon={<i className='icon icon-pin-outline'/>}
                text={formatMessage({
                    id: 'channel_info_rhs.menu.pinned',
                    defaultMessage: 'Pinned messages',
                })}
                opensSubpanel={true}
                badge={channelStats?.pinnedpost_count}
                onClick={() => actions.showPinnedPosts(channel.id)}
            />
            {bookmarksEnabled && (
                <>
                    <MenuItem
                        id='channelInfoRHSBookmarks'
                        icon={<i className='icon icon-bookmark-outline'/>}
                        text={formatMessage({
                            id: 'channel_info_rhs.menu.bookmarks',
                            defaultMessage: 'Bookmarks',
                        })}
                        opensSubpanel={true}
                        expanded={bookmarksExpanded}
                        badge={bookmarkCount}
                        onClick={() => setBookmarksExpanded((open) => !open)}
                    />
                    {bookmarksExpanded && (
                        <BookmarksSection channelId={channel.id}/>
                    )}
                </>
            )}
            {scheduledEnabled && (
                <MenuItem
                    id='channelInfoRHSScheduled'
                    icon={<i className='icon icon-clock-send-outline'/>}
                    text={formatMessage({
                        id: 'channel_info_rhs.menu.scheduled',
                        defaultMessage: 'Scheduled posts',
                    })}
                    opensSubpanel={true}
                    badge={scheduledCount}
                    onClick={handleScheduledClick}
                />
            )}
            <MenuItem
                id='channelInfoRHSFiles'
                icon={<i className='icon icon-file-text-outline'/>}
                text={formatMessage({
                    id: 'channel_info_rhs.menu.files',
                    defaultMessage: 'Files',
                })}
                opensSubpanel={true}
                badge={loadingStats ? <LoadingSpinner/> : fileCount}
                onClick={() => actions.showChannelFiles(channel.id)}
            />
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
        </MenuContainer>
    );
}
