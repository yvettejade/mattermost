// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';

import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import {DemoRewriteAction, transformMessage} from './demo_rewrite_transform';

import './demo_rewrite_modal.scss';

const LOADING_DELAY_MS = 300;

type Props = {
    originalMessage: string;
    action: DemoRewriteAction;
    onExited?: () => void;
    onHide?: () => void;
};

function getActionTitle(action: DemoRewriteAction, formatMessage: ReturnType<typeof useIntl>['formatMessage']): string {
    switch (action) {
    case DemoRewriteAction.SIMPLIFY:
        return formatMessage({id: 'post_info.demo_rewrite.simplify', defaultMessage: 'Simplify'});
    case DemoRewriteAction.PROFESSIONAL:
        return formatMessage({id: 'post_info.demo_rewrite.professional', defaultMessage: 'Rewrite professionally'});
    case DemoRewriteAction.SHORTEN:
        return formatMessage({id: 'post_info.demo_rewrite.shorten', defaultMessage: 'Shorten'});
    case DemoRewriteAction.SUMMARIZE:
        return formatMessage({id: 'post_info.demo_rewrite.summarize', defaultMessage: 'Summarize'});
    default:
        return formatMessage({id: 'post_info.demo_rewrite.title', defaultMessage: 'Rewrite'});
    }
}

function DemoRewriteModal({originalMessage, action, onExited, onHide}: Props) {
    const intl = useIntl();
    const [isLoading, setIsLoading] = useState(true);
    const [result, setResult] = useState('');

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setResult(transformMessage(originalMessage, action));
            setIsLoading(false);
        }, LOADING_DELAY_MS);

        return () => window.clearTimeout(timeoutId);
    }, [originalMessage, action]);

    const handleHide = () => {
        onHide?.();
    };

    return (
        <GenericModal
            id='demoRewriteModal'
            className='DemoRewriteModal a11y__modal'
            show={true}
            onHide={handleHide}
            onExited={onExited}
            ariaLabelledby='demoRewriteModalLabel'
            compassDesign={true}
            modalHeaderText={getActionTitle(action, intl.formatMessage)}
        >
            <div className='DemoRewriteModal__content'>
                {isLoading ? (
                    <div className='DemoRewriteModal__loading'>
                        <LoadingSpinner/>
                    </div>
                ) : (
                    <>
                        <div className='DemoRewriteModal__messageBlock DemoRewriteModal__messageBlock--original'>
                            <div className='DemoRewriteModal__label'>
                                {intl.formatMessage({
                                    id: 'post_info.demo_rewrite.original',
                                    defaultMessage: 'Original',
                                })}
                            </div>
                            <div className='DemoRewriteModal__text'>
                                {originalMessage}
                            </div>
                        </div>
                        <div className='DemoRewriteModal__messageBlock DemoRewriteModal__messageBlock--result'>
                            <div className='DemoRewriteModal__label'>
                                {intl.formatMessage({
                                    id: 'post_info.demo_rewrite.result',
                                    defaultMessage: 'Result',
                                })}
                            </div>
                            <div className='DemoRewriteModal__text'>
                                {result}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </GenericModal>
    );
}

export default DemoRewriteModal;
