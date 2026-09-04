// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {
    LinkVariantIcon,
    PaperclipIcon,
    PlusIcon,
} from '@mattermost/compass-icons/components';
import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';
import type {Channel} from '@mattermost/types/channels';

import BookmarkItemContent from 'components/channel_bookmarks/bookmark_item_content';
import {useBookmarkAddActions} from 'components/channel_bookmarks/channel_bookmarks_menu';
import * as Menu from 'components/menu';
import NoResultsIndicator from 'components/no_results_indicator';

import Header from './header';

export interface Props {
    channel: Channel;
    canGoBack: boolean;
    bookmarks: ChannelBookmark[];
    canAdd: boolean;
    canUploadFiles: boolean;
    limitReached: boolean;
    actions: {
        closeRightHandSide: () => void;
        goBack: () => void;
    };
}

const ChannelBookmarksRhs = ({
    channel,
    canGoBack,
    bookmarks,
    canAdd,
    canUploadFiles,
    limitReached,
    actions,
}: Props) => {
    const {formatMessage} = useIntl();
    const {handleCreateLink, handleCreateFile} = useBookmarkAddActions(channel.id);

    const addBookmarkLabel = formatMessage({id: 'channel_bookmarks.addBookmark', defaultMessage: 'Add a bookmark'});
    const addLinkLabel = formatMessage({id: 'channel_bookmarks.addLink', defaultMessage: 'Add a link'});
    const attachFileLabel = formatMessage({id: 'channel_bookmarks.attachFile', defaultMessage: 'Attach a file'});

    return (
        <div
            id='rhsContainer'
            className='sidebar-right__body'
        >
            <Header
                channel={channel}
                canGoBack={canGoBack}
                onClose={actions.closeRightHandSide}
                goBack={actions.goBack}
            />
            {canAdd && (
                <AddBar>
                    <Menu.Container
                        menuButton={{
                            id: 'channelBookmarksRhsAddButton',
                            class: 'btn btn-primary btn-sm',
                            children: (
                                <>
                                    <PlusIcon size={16}/>
                                    <span>{addBookmarkLabel}</span>
                                </>
                            ),
                            'aria-label': addBookmarkLabel,
                            disabled: limitReached,
                        }}
                        menu={{
                            id: 'channelBookmarksRhsAddMenu',
                        }}
                    >
                        <Menu.Item
                            id='channelBookmarksRhsAddLink'
                            onClick={handleCreateLink}
                            leadingElement={<LinkVariantIcon size={18}/>}
                            labels={<span>{addLinkLabel}</span>}
                        />
                        {canUploadFiles && (
                            <Menu.Item
                                id='channelBookmarksRhsAttachFile'
                                onClick={handleCreateFile}
                                leadingElement={<PaperclipIcon size={18}/>}
                                labels={<span>{attachFileLabel}</span>}
                            />
                        )}
                    </Menu.Container>
                </AddBar>
            )}
            {bookmarks.length === 0 ? (
                <EmptyState>
                    <NoResultsIndicator
                        expanded={true}
                        title={formatMessage({
                            id: 'channel_bookmarks_rhs.empty.title',
                            defaultMessage: 'No bookmarks yet',
                        })}
                        subtitle={formatMessage({
                            id: 'channel_bookmarks_rhs.empty.subtitle',
                            defaultMessage: 'Add links or files so this channel\'s important resources stay in one place.',
                        })}
                    />
                </EmptyState>
            ) : (
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
            )}
        </div>
    );
};

export default ChannelBookmarksRhs;

const AddBar = styled.div`
    display: flex;
    justify-content: flex-end;
    padding: 12px 16px 0;
`;

const List = styled.ul`
    list-style: none;
    margin: 0;
    padding: 8px 0 16px;
    overflow-y: auto;
`;

const ListItem = styled.li`
    padding: 4px 16px;
`;

const EmptyState = styled.div`
    padding: 24px 16px;
`;
