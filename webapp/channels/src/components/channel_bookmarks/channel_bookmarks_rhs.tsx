// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import {
    LinkVariantIcon,
    PaperclipIcon,
} from '@mattermost/compass-icons/components';
import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';
import type {Channel} from '@mattermost/types/channels';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';

import {closeRightHandSide, goBack} from 'actions/views/rhs';
import {getPreviousRhsState} from 'selectors/rhs';

import SubpanelHeader from 'components/channel_info_rhs/subpanel_header';
import Scrollbars from 'components/common/scrollbars';
import * as Menu from 'components/menu';

import BookmarkItemContent from './bookmark_item_content';
import {useBookmarkAddActions} from './channel_bookmarks_menu';
import {MAX_BOOKMARKS_PER_CHANNEL, useCanUploadFiles, useChannelBookmarkPermission, useChannelBookmarks} from './utils';

export type ChannelBookmarksRhsViewProps = {
    channel: Channel;
    bookmarks: ChannelBookmark[];
    canAdd: boolean;
    canUploadFiles: boolean;
    canGoBack: boolean;
    onClose: () => void;
    goBack: () => void;
    onAddLink: () => void;
    onAddFile: () => void;
};

const List = styled.ul`
    list-style: none;
    margin: 0;
    padding: 8px 0;
`;

const ListItem = styled.li`
    padding: 4px 12px;
`;

const EmptyState = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 24px;
    text-align: center;
    color: rgba(var(--center-channel-color-rgb), 0.75);
`;

const AddButton = styled.div`
    margin: 8px 16px 16px;
`;

function AddBookmarkMenu({
    buttonClassName,
    canUploadFiles,
    onAddLink,
    onAddFile,
}: {
    buttonClassName: string;
    canUploadFiles: boolean;
    onAddLink: () => void;
    onAddFile: () => void;
}) {
    const {formatMessage} = useIntl();
    const addBookmarkLabel = formatMessage({id: 'channel_bookmarks.addBookmark', defaultMessage: 'Add a bookmark'});
    const addLinkLabel = formatMessage({id: 'channel_bookmarks.addLink', defaultMessage: 'Add a link'});
    const attachFileLabel = formatMessage({id: 'channel_bookmarks.attachFile', defaultMessage: 'Attach a file'});

    return (
        <Menu.Container
            menuButton={{
                id: 'channelBookmarksRhsAddButton',
                class: buttonClassName,
                children: addBookmarkLabel,
                'aria-label': addBookmarkLabel,
            }}
            menu={{
                id: 'channelBookmarksRhsAddMenu',
            }}
        >
            <Menu.Item
                id='channelBookmarksRhsAddLink'
                onClick={onAddLink}
                leadingElement={<LinkVariantIcon size={18}/>}
                labels={<span>{addLinkLabel}</span>}
            />
            {canUploadFiles && (
                <Menu.Item
                    id='channelBookmarksRhsAttachFile'
                    onClick={onAddFile}
                    leadingElement={<PaperclipIcon size={18}/>}
                    labels={<span>{attachFileLabel}</span>}
                />
            )}
        </Menu.Container>
    );
}

export function ChannelBookmarksRhsView({
    channel,
    bookmarks,
    canAdd,
    canUploadFiles,
    canGoBack,
    onClose,
    goBack: onGoBack,
    onAddLink,
    onAddFile,
}: ChannelBookmarksRhsViewProps) {
    const {formatMessage} = useIntl();
    const limitReached = bookmarks.length >= MAX_BOOKMARKS_PER_CHANNEL;

    return (
        <div
            id='rhsContainer'
            className='sidebar-right__body'
        >
            <SubpanelHeader
                channel={channel}
                canGoBack={canGoBack}
                title={
                    <FormattedMessage
                        id='channel_info_rhs.menu.bookmarks'
                        defaultMessage='Bookmarks'
                    />
                }
                onClose={onClose}
                goBack={onGoBack}
            />
            <Scrollbars color='--center-channel-color-rgb'>
                {bookmarks.length === 0 ? (
                    <EmptyState>
                        {canAdd && !limitReached ? (
                            <AddBookmarkMenu
                                buttonClassName='btn btn-link'
                                canUploadFiles={canUploadFiles}
                                onAddLink={onAddLink}
                                onAddFile={onAddFile}
                            />
                        ) : (
                            <FormattedMessage
                                id='channel_bookmarks.empty'
                                defaultMessage='No bookmarks'
                            />
                        )}
                    </EmptyState>
                ) : (
                    <>
                        <List aria-label={formatMessage({id: 'channel_info_rhs.menu.bookmarks', defaultMessage: 'Bookmarks'})}>
                            {bookmarks.map((bookmark) => (
                                <ListItem key={bookmark.id}>
                                    <BookmarkItemContent
                                        bookmark={bookmark}
                                        disableInteractions={false}
                                    />
                                </ListItem>
                            ))}
                        </List>
                        {canAdd && !limitReached && (
                            <AddButton>
                                <AddBookmarkMenu
                                    buttonClassName='btn btn-tertiary btn-sm'
                                    canUploadFiles={canUploadFiles}
                                    onAddLink={onAddLink}
                                    onAddFile={onAddFile}
                                />
                            </AddButton>
                        )}
                    </>
                )}
            </Scrollbars>
        </div>
    );
}

export default function ChannelBookmarksRhs() {
    const dispatch = useDispatch();
    const channel = useSelector(getCurrentChannel);
    const previousRhsState = useSelector(getPreviousRhsState);
    const {order, bookmarks} = useChannelBookmarks(channel?.id || '');
    const canAdd = Boolean(useChannelBookmarkPermission(channel?.id || '', 'add'));
    const canUploadFiles = useCanUploadFiles();
    const {handleCreateLink, handleCreateFile} = useBookmarkAddActions(channel?.id || '');

    const handleClose = useCallback(() => {
        dispatch(closeRightHandSide());
    }, [dispatch]);

    const handleGoBack = useCallback(() => {
        dispatch(goBack());
    }, [dispatch]);

    if (!channel) {
        return null;
    }

    const orderedBookmarks = order.
        map((id) => bookmarks[id]).
        filter((bookmark): bookmark is ChannelBookmark => Boolean(bookmark));

    return (
        <ChannelBookmarksRhsView
            channel={channel}
            bookmarks={orderedBookmarks}
            canAdd={canAdd}
            canUploadFiles={canUploadFiles}
            canGoBack={Boolean(previousRhsState)}
            onClose={handleClose}
            goBack={handleGoBack}
            onAddLink={handleCreateLink}
            onAddFile={handleCreateFile}
        />
    );
}
