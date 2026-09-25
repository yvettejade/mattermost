import React, {useEffect, useState} from 'react';

import {postChat} from './api_client';
import {closeChatModal, currentChatContext, isChatOpen, subscribeChatModal} from './modal_state';

type Line = {
    role: 'user' | 'assistant';
    text: string;
};

export default function ChatModal(): JSX.Element | null {
    const [open, setOpen] = useState(isChatOpen());
    const [draft, setDraft] = useState('');
    const [lines, setLines] = useState<Line[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => subscribeChatModal(setOpen), []);

    if (!open) {
        return null;
    }

    const send = async (text: string) => {
        const message = text.trim();
        if (!message || busy) {
            return;
        }
        setBusy(true);
        setError('');
        setLines((prev) => [...prev, {role: 'user', text: message}]);
        setDraft('');
        try {
            const resp = await postChat(message);
            setLines((prev) => [...prev, {role: 'assistant', text: resp.reply || '(empty reply)'}]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'chat request failed');
        } finally {
            setBusy(false);
        }
    };

    const ctx = currentChatContext();

    return (
        <div
            className='YvetteGrok__backdrop'
            role='presentation'
            onClick={closeChatModal}
        >
            <div
                className='YvetteGrok__modal'
                role='dialog'
                aria-labelledby='yvette-grok-modal-title'
                onClick={(e) => e.stopPropagation()}
            >
                <header className='YvetteGrok__header'>
                    <h2 id='yvette-grok-modal-title'>{'Ask Grok'}</h2>
                    <button
                        type='button'
                        className='YvetteGrok__close'
                        onClick={closeChatModal}
                        aria-label='Close'
                    >
                        {'×'}
                    </button>
                </header>
                <p className='YvetteGrok__context'>
                    {ctx.channel_id ? `Channel ${ctx.channel_id}` : 'No channel selected'}
                </p>
                <div className='YvetteGrok__chips'>
                    {['catch me up', 'summarize this channel', 'help'].map((chip) => (
                        <button
                            key={chip}
                            type='button'
                            className='YvetteGrok__chip'
                            onClick={() => send(chip)}
                        >
                            {chip}
                        </button>
                    ))}
                </div>
                <ol className='YvetteGrok__transcript'>
                    {lines.map((line, i) => (
                        <li
                            key={`${line.role}-${i}`}
                            className={`YvetteGrok__line YvetteGrok__line--${line.role}`}
                        >
                            <strong>{line.role === 'user' ? 'You' : 'Grok'}</strong>
                            <pre>{line.text}</pre>
                        </li>
                    ))}
                </ol>
                {error ? <p className='YvetteGrok__error'>{error}</p> : null}
                <form
                    className='YvetteGrok__composer'
                    onSubmit={(e) => {
                        e.preventDefault();
                        send(draft);
                    }}
                >
                    <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder='Ask about this channel…'
                        rows={3}
                    />
                    <button
                        type='submit'
                        disabled={busy || !draft.trim()}
                    >
                        {busy ? 'Sending…' : 'Send'}
                    </button>
                </form>
            </div>
        </div>
    );
}
