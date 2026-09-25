export const PLUGIN_ID = 'com.yvette.grok-agent';

export type GrokStatus = {
    ok: boolean;
    grok_configured: boolean;
    provider: string;
    github_owner: string;
    github_repo: string;
    jira_project_key: string;
};

export type GrokQueryResponse = {
    reply: string;
    intent: string;
    provider: string;
    sources?: string[];
};

function pluginURL(path: string) {
    return `/plugins/${PLUGIN_ID}${path}`;
}

async function parseError(response: Response): Promise<Error> {
    const text = await response.text();
    return new Error(text || `request failed (${response.status})`);
}

export async function fetchGrokStatus(): Promise<GrokStatus> {
    const response = await fetch(pluginURL('/api/v1/status'), {
        credentials: 'same-origin',
        headers: {'X-Requested-With': 'XMLHttpRequest'},
    });
    if (!response.ok) {
        throw await parseError(response);
    }
    return response.json();
}

export async function queryGrok(payload: {
    text: string;
    channel_id: string;
    root_id?: string;
    team_id?: string;
    intent?: string;
}): Promise<GrokQueryResponse> {
    const response = await fetch(pluginURL('/api/v1/query'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw await parseError(response);
    }
    return response.json();
}
