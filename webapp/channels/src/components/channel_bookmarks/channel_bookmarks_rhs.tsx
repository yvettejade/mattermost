// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import {
    LinkVariantIcon,
    PaperclipIcon,
    PlusIcon,
} from '@mattermost/compass-icons/components';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';
import type {Channel} from '@mattermost/types/channels';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';

import {closeRightHandSide, goBack} from 'actions/views/rhs';
import {getPreviousRhsState} from 'selectors/rhs';

import Scrollbars from 'components/common/scrollbars';
import * as Menu from 'components/menu';
import NoResultsIndicator from 'components/no_results_indicator';

import {RHSStates} from 'utils/constants';

import BookmarkItemContent from './bookmark_item_content';
import {useBookmarkAddActions} from './channel_bookmarks_menu';
import {
    MAX_BOOKMARKS_PER_CHANNEL,
    useCanUploadFiles,
    useChannelBookmarkPermission,
    useChannelBookmarks,
} from './utils';

import './channel_bookmarks_rhs.scss';

export type Props = {
    channel: Channel;
    canGoBack: boolean;
    bookmarks: IDMappedObjects<ChannelBookmark>;
    order: string[];
    canAdd: boolean;
    canUploadFiles: boolean;
    actions: {
        closeRightHandSide: () => void;
        goBack: () => void;
    };
};

const HeaderTitle = styled.span`
    line-height: 2.4rem;
`;

function Header({
    channel,
    canGoBack,
    onClose,
    onBack,
}: {
    channel: Channel;
    canGoBack: boolean;
    onClose: () => void;
    onBack: () => void;
}) {
    const {formatMessage} = useIntl();

    return (
        <div className='sidebar--right__header'>
            <span className='sidebar--right__title'>
                {canGoBack && (
                    <button
                        className='sidebar--right__back btn btn-icon btn-sm'
                        onClick={onBack}
                        aria-label={formatMessage({id: 'rhs_header.back.icon', defaultMessage: 'Back Icon'})}
                    >
                        <i className='icon icon-arrow-back-ios'/>
                    </button>
                )}
                <h2>
                    <HeaderTitle id='rhsPanelTitle'>
                        <FormattedMessage
                            id='channel_info_rhs.menu.bookmarks'
                            defaultMessage='Bookmarks'
                        />
                    </HeaderTitle>
                    {channel.display_name && (
                        <span className='style--none sidebar--right__title__subtitle'>
                            {channel.display_name}
                        </span>
                    )}
                </h2>
            </span>
            <WithTooltip
                title={
                    <FormattedMessage
                        id='rhs_header.closeSidebarTooltip'
                        defaultMessage='Close'
                    />
                }
            >
                <button
                    id='rhsCloseButton'
                    type='button'
                    className='sidebar--right__close btn btn-icon btn-sm'
                    aria-label={formatMessage({id: 'rhs_header.closeTooltip.icon', defaultMessage: 'Close Sidebar Icon'})}
                    onClick={onClose}
                >
                    <i className='icon icon-close'/>
                </button>
            </WithTooltip>
        </div>
    );
}

export function ChannelBookmarksRhs({
    channel,
    canGoBack,
    bookmarks,
    order,
    canAdd,
    canUploadFiles,
    actions,
}: Props) {
    const {formatMessage} = useIntl();
    const {handleCreateLink, handleCreateFile} = useBookmarkAddActions(channel.id);
    const hasBookmarks = order.length > 0;
    const limitReached = order.length >= MAX_BOOKMARKS_PER_CHANNEL;

    const addBookmarkLabel = formatMessage({id: 'channel_bookmarks.addBookmark', defaultMessage: 'Add a bookmark'});
    const addLinkLabel = formatMessage({id: 'channel_bookmarks.addLink', defaultMessage: 'Add a link'});
    const attachFileLabel = formatMessage({id: 'channel_bookmarks.attachFile', defaultMessage: 'Attach a file'});

    return (
        <div
            id='rhsContainer'
            className='sidebar-right__body ChannelBookmarksRhs'
        >
            <Header
                channel={channel}
                canGoBack={canGoBack}
                onClose={actions.closeRightHandSide}
                onBack={actions.goBack}
            />
            <Scrollbars color='--center-channel-color-rgb'>
                <div className='ChannelBookmarksRhs__content'>
                    {canAdd && (
                        <div className='ChannelBookmarksRhs__add'>
                            <Menu.Container
                                menuButton={{
                                    id: 'channelBookmarksRhsAddButton',
                                    class: 'btn btn-sm btn-tertiary ChannelBookmarksRhs__add-button',
                                    disabled: limitReached,
                                    'aria-label': addBookmarkLabel,
                                    children: (
                                        <>
                                            <PlusIcon size={16}/>
                                            <span>{addBookmarkLabel}</span>
                                        </>
                                    ),
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
                        </div>
                    )}
                    {hasBookmarks ? (
                        <ul className='ChannelBookmarksRhs__list'>
                            {order.map((id) => {
                                const bookmark = bookmarks[id];
                                if (!bookmark) {
                                    return null;
                                }
                                return (
                                    <li
                                        key={id}
                                        className='ChannelBookmarksRhs__item'
                                    >
                                        <BookmarkItemContent
                                            bookmark={bookmark}
                                            disableInteractions={false}
                                        />
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <NoResultsIndicator
                            expanded={true}
                            title={formatMessage({
                                id: 'channel_bookmarks_rhs.empty.title',
                                defaultMessage: 'No bookmarks in this channel',
                            })}
                            subtitle={formatMessage({
                                id: 'channel_bookmarks_rhs.empty.subtitle',
                                defaultMessage: 'Save links and files here so the channel can find them later.',
                            })}
                        />
                    )}
                </div>
            </Scrollbars>
        </div>
    );
}

function ChannelBookmarksRhsContainer() {
    const dispatch = useDispatch();
    const channel = useSelector(getCurrentChannel);
    const previousRhsState = useSelector(getPreviousRhsState);
    const canGoBack = previousRhsState === RHSStates.CHANNEL_INFO ||
        previousRhsState === RHSStates.CHANNEL_FILES ||
        previousRhsState === RHSStates.PIN ||
        previousRhsState === RHSStates.CHANNEL_MEMBERS;
    const {bookmarks, order} = useChannelBookmarks(channel?.id || '');
    const canAdd = Boolean(useChannelBookmarkPermission(channel?.id || '', 'add'));
    const canUploadFiles = useCanUploadFiles();

    const handleClose = useCallback(() => {
        dispatch(closeRightHandSide());
    }, [dispatch]);

    const handleGoBack = useCallback(() => {
        dispatch(goBack());
    }, [dispatch]);

    if (!channel) {
        return null;
    }

    return (
        <ChannelBookmarksRhs
            channel={channel}
            canGoBack={canGoBack}
            bookmarks={bookmarks}
            order={order}
            canAdd={canAdd}
            canUploadFiles={canUploadFiles}
            actions={{
                closeRightHandSide: handleClose,
                goBack: handleGoBack,
            }}
        />
    );
}

export default ChannelBookmarksRhsContainer;
