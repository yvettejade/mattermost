// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {
    AiSummarizeIcon,
    AutoFixIcon,
    ChevronRightIcon,
    CreationOutlineIcon,
    TextShortIcon,
} from '@mattermost/compass-icons/components';
import type {Post} from '@mattermost/types/posts';

import * as Menu from 'components/menu';

import {ModalIdentifiers} from 'utils/constants';

import DemoRewriteModal from './demo_rewrite_modal';
import {DemoRewriteAction} from './demo_rewrite_transform';

import type {ModalData} from 'types/actions';

type Props = {
    post: Post;
    openModal: <P>(modalData: ModalData<P>) => void;
};

const rewriteActions = [
    {
        action: DemoRewriteAction.SIMPLIFY,
        label: (
            <FormattedMessage
                id='post_info.demo_rewrite.simplify'
                defaultMessage='Simplify'
            />
        ),
        icon: <CreationOutlineIcon size={18}/>,
    },
    {
        action: DemoRewriteAction.PROFESSIONAL,
        label: (
            <FormattedMessage
                id='post_info.demo_rewrite.professional'
                defaultMessage='Rewrite professionally'
            />
        ),
        icon: <AutoFixIcon size={18}/>,
    },
    {
        action: DemoRewriteAction.SHORTEN,
        label: (
            <FormattedMessage
                id='post_info.demo_rewrite.shorten'
                defaultMessage='Shorten'
            />
        ),
        icon: <TextShortIcon size={18}/>,
    },
    {
        action: DemoRewriteAction.SUMMARIZE,
        label: (
            <FormattedMessage
                id='post_info.demo_rewrite.summarize'
                defaultMessage='Summarize'
            />
        ),
        icon: <AiSummarizeIcon size={18}/>,
    },
];

function DemoRewriteSubmenu({post, openModal}: Props) {
    const {formatMessage} = useIntl();

    function handleRewriteAction(action: DemoRewriteAction) {
        openModal({
            modalId: ModalIdentifiers.DEMO_REWRITE_MODAL,
            dialogType: DemoRewriteModal,
            dialogProps: {
                originalMessage: post.message,
                action,
            },
        });
    }

    const submenuItems = rewriteActions.map((item) => (
        <Menu.Item
            id={`rewrite_post_${item.action}_${post.id}`}
            key={`rewrite_post_${item.action}_${post.id}`}
            labels={item.label}
            leadingElement={item.icon}
            onClick={() => handleRewriteAction(item.action)}
        />
    ));

    return (
        <Menu.SubMenu
            id={`rewrite_post_${post.id}`}
            menuAriaLabel={formatMessage({
                id: 'post_info.demo_rewrite.sub_menu.header',
                defaultMessage: 'Rewrite message:',
            })}
            labels={
                <FormattedMessage
                    id='post_info.demo_rewrite.menu'
                    defaultMessage='Rewrite'
                />
            }
            leadingElement={<CreationOutlineIcon size={18}/>}
            trailingElements={
                <span className='dot-menu__item-trailing-icon'>
                    <ChevronRightIcon size={16}/>
                </span>
            }
            menuId={`rewrite_post_${post.id}-menu`}
            subMenuHeader={
                <h5 className='dot-menu__post-reminder-menu-header'>
                    {formatMessage({
                        id: 'post_info.demo_rewrite.sub_menu.header',
                        defaultMessage: 'Rewrite message:',
                    })}
                </h5>
            }
        >
            {submenuItems}
        </Menu.SubMenu>
    );
}

export default memo(DemoRewriteSubmenu);
