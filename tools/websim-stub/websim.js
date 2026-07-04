// WebSim API Stub for Local Development
// This provides mock implementations of the WebSim platform APIs

(function() {
    'use strict';

    // Generate a simple unique ID
    function generateId() {
        return 'local_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Convert base64 string to a Blob URL
    // This creates a proper URL (blob:http://...) that works like a regular image URL
    function base64ToBlobUrl(base64, mimeType = 'image/png') {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        return URL.createObjectURL(blob);
    }

    // Local storage helper - generic key for all neon apps
    const STORAGE_KEY = 'neon_websim_local_data';
    const USER_KEY = 'neon_websim_username';
    const OPENAI_CONFIG_KEY = 'neon_websim_openai_config';

    // OpenAI configuration
    let openaiConfig = null;
    let configLoaded = false;

    function loadOpenAIConfigFromStorage() {
        try {
            const data = localStorage.getItem(OPENAI_CONFIG_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    }

    function saveOpenAIConfig(config) {
        try {
            if (config) {
                localStorage.setItem(OPENAI_CONFIG_KEY, JSON.stringify(config));
            } else {
                localStorage.removeItem(OPENAI_CONFIG_KEY);
            }
        } catch (e) {
            console.warn('Failed to save OpenAI config:', e);
        }
    }

    // Load config from JSON file
    async function loadConfigFile() {
        try {
            // Get the script's directory to find config.json
            const scripts = document.querySelectorAll('script[src*="websim"]');
            let basePath = '../websim-stub/';
            for (const script of scripts) {
                if (script.src.includes('websim.js')) {
                    basePath = script.src.replace('websim.js', '');
                    break;
                }
            }

            const response = await fetch(basePath + 'config.json');
            if (!response.ok) return null;

            const config = await response.json();
            return config;
        } catch (e) {
            return null;
        }
    }

    // Initialize config (async)
    async function initConfig() {
        // First try config.json file
        const fileConfig = await loadConfigFile();

        if (fileConfig?.openai?.apiKey) {
            openaiConfig = {
                apiKey: fileConfig.openai.apiKey,
                chatModel: fileConfig.openai.chatModel || fileConfig.openai.model || 'gpt-4o-mini',
                imageModel: fileConfig.openai.imageModel || 'dall-e-3'
            };
            console.log(`[WebSim Stub] OpenAI configured from config.json: chat=${openaiConfig.chatModel}, image=${openaiConfig.imageModel}`);
        } else {
            // Fall back to localStorage
            openaiConfig = loadOpenAIConfigFromStorage();
            if (openaiConfig) {
                // Migrate old 'model' field to 'chatModel'
                if (openaiConfig.model && !openaiConfig.chatModel) {
                    openaiConfig.chatModel = openaiConfig.model;
                }
                openaiConfig.chatModel = openaiConfig.chatModel || 'gpt-4o-mini';
                openaiConfig.imageModel = openaiConfig.imageModel || 'dall-e-3';
                console.log(`[WebSim Stub] OpenAI configured from localStorage: chat=${openaiConfig.chatModel}, image=${openaiConfig.imageModel}`);
            }
        }

        configLoaded = true;
    }

    // Start loading config immediately
    const configPromise = initConfig();

    // Call OpenAI API
    async function callOpenAI(messages, options = {}) {
        if (!openaiConfig?.apiKey) {
            throw new Error('OpenAI API key not configured');
        }

        const body = {
            model: openaiConfig.chatModel || 'gpt-4o-mini',
            messages: messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.max_tokens ?? 16384
        };

        // Handle JSON mode
        if (options.json || options.response_format?.type === 'json_object') {
            body.response_format = { type: 'json_object' };
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiConfig.apiKey}`
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    function loadLocalData() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.warn('Failed to load local data:', e);
            return {};
        }
    }

    function saveLocalData(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn('Failed to save local data:', e);
        }
    }

    // In-memory collections with localStorage persistence
    const collections = loadLocalData();
    const subscribers = {};

    function notifySubscribers(collectionName) {
        const items = Object.values(collections[collectionName] || {});
        (subscribers[collectionName] || []).forEach(cb => {
            try {
                cb(items);
            } catch (e) {
                console.error('Subscriber error:', e);
            }
        });
    }

    // WebsimSocket - Real-time collaboration stub
    class WebsimSocket {
        constructor(options = {}) {
            this.roomId = options.roomId || 'default';
            this._onmessage = null;
            console.log('[WebsimSocket] Initialized (local stub mode)');
        }

        // Get a collection
        collection(name) {
            if (!collections[name]) {
                collections[name] = {};
            }
            if (!subscribers[name]) {
                subscribers[name] = [];
            }

            return {
                // Create a new record
                create: async (data) => {
                    const id = generateId();
                    const user = await websim.getCurrentUser();
                    const record = {
                        id,
                        ...data,
                        owner: user.username,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };
                    collections[name][id] = record;
                    saveLocalData(collections);
                    notifySubscribers(name);
                    console.log(`[WebsimSocket] Created ${name}:`, record);
                    return record;
                },

                // Update an existing record
                update: async (id, data) => {
                    if (!collections[name][id]) {
                        throw new Error(`Record ${id} not found in ${name}`);
                    }
                    collections[name][id] = {
                        ...collections[name][id],
                        ...data,
                        updated_at: new Date().toISOString()
                    };
                    saveLocalData(collections);
                    notifySubscribers(name);
                    console.log(`[WebsimSocket] Updated ${name}/${id}:`, collections[name][id]);
                    return collections[name][id];
                },

                // Delete a record
                delete: async (id) => {
                    if (collections[name][id]) {
                        delete collections[name][id];
                        saveLocalData(collections);
                        notifySubscribers(name);
                        console.log(`[WebsimSocket] Deleted ${name}/${id}`);
                    }
                },

                // Get a single record
                get: async (id) => {
                    return collections[name][id] || null;
                },

                // Get all records
                getAll: async () => {
                    return Object.values(collections[name] || {});
                },

                // Subscribe to changes
                subscribe: (callback) => {
                    subscribers[name].push(callback);
                    // Immediately call with current data
                    const items = Object.values(collections[name] || {});
                    setTimeout(() => callback(items), 0);

                    // Return unsubscribe function
                    return () => {
                        const idx = subscribers[name].indexOf(callback);
                        if (idx > -1) subscribers[name].splice(idx, 1);
                    };
                },

                // Query records (basic filter)
                filter: async (predicate) => {
                    return Object.values(collections[name] || {}).filter(predicate);
                }
            };
        }

        // Send a message to other users (no-op in local mode)
        send(data) {
            console.log('[WebsimSocket] Send (local, not broadcast):', data);
            // In local mode, we could echo back to ourselves for testing
            if (this._onmessage) {
                setTimeout(() => {
                    this._onmessage({ data });
                }, 100);
            }
        }

        // Message handler
        set onmessage(handler) {
            this._onmessage = handler;
        }

        get onmessage() {
            return this._onmessage;
        }
    }

    // Mock response generator for when OpenAI is not configured
    function getMockResponse(prompt, jsonMode = false, systemPrompt = '') {
        const lowerPrompt = prompt.toLowerCase();
        const lowerSystem = systemPrompt.toLowerCase();

        // JSON responses only when the caller requested JSON mode.
        // Plain-text calls (suggestions, briefs, demo prompts) mention "drum"/
        // "pattern" too, and their output lands directly in input fields -
        // they must never receive a JSON payload.
        if (jsonMode) {
            // Both apps' generation calls always carry a system message identifying the app, so
            // check those exact markers before any generic keyword fallback. This matters because
            // the drums/synth STATE blobs both use words like "pattern"/"patterns" in their JSON
            // keys - a keyword fallback checked first would misroute synth calls to the drum shape.
            const isSynthGeneration = lowerSystem.includes('synth sound designer');
            const isDrumGeneration = lowerSystem.includes('drum programmer') || lowerSystem.includes('tr-909');
            // Only used when there's no system message at all (truly ambiguous single-message calls).
            const looksLikeDrumKeywords = !systemPrompt &&
                (lowerPrompt.includes('pattern') || lowerPrompt.includes('drum') || lowerPrompt.includes('[pattern]'));

            // Synth track generation (neon-synth) - detected from its system prompt.
            if (isSynthGeneration) {
                return JSON.stringify({
                    trackName: 'Neon Pulse',
                    trackNames: ['Sub', 'Bass', 'Lead', 'Pad'],
                    rootKey: 0,
                    trackParams: { '1': { waveType: 'square', filterCutoff: 800 }, '2': { delayMix: 0.3 } },
                    globalParams: { bpm: 120 + Math.floor(Math.random() * 20) },
                    tracks: [
                        [15, null, null, null, 15, null, null, null, 15, null, null, null, 15, null, null, null],
                        [27, null, null, null, 27, null, null, null, 27, null, null, null, 27, null, null, null],
                        [39, 40, 41, 39, 40, 41, 39, 40, 41, 39, 40, 41, 39, 40, 41, 39],
                        [[30, 8], null, null, null, null, null, null, null, [30, 8], null, null, null, null, null, null, null]
                    ],
                    reasoning: ['Dark techno vibe', 'Sub + bass for weight', 'Square bass for punch']
                });
            }
            // Drum pattern generation (neon-drums) - detected from its system prompt.
            if (isDrumGeneration || looksLikeDrumKeywords) {
                return JSON.stringify({
                    bpm: 120 + Math.floor(Math.random() * 20),
                    trackName: 'Neon Pulse',
                    description: 'Driving electronic energy',
                    params: {},
                    patterns: {
                        'A': {
                            numSteps: 16,
                            pattern: {
                                bassDrum: [2, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0],
                                snareDrum: [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0],
                                closedHiHat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
                                openHiHat: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0]
                            },
                            flams: {}
                        }
                    },
                    track: ['A'],
                    reasoning: ['Classic 4/4 house pattern', 'Punchy kick on downbeats', 'Crisp hi-hats for groove']
                });
            }
            // Track name suggestions
            if (lowerPrompt.includes('suggest') && lowerPrompt.includes('name')) {
                const names = ['Neon Pulse', 'Cyber Dawn', 'Dark Matter', 'Digital Dreams',
                              'Voltage', 'Binary Sun', 'Chrome Heart', 'Synth City'];
                return JSON.stringify({ name: names[Math.floor(Math.random() * names.length)] });
            }
            // Commit messages
            if (lowerPrompt.includes('commit')) {
                const messages = ['Updated settings', 'Tweaked parameters', 'New variation',
                                 'Added changes', 'Refined mix', 'Adjustment'];
                return JSON.stringify({ message: messages[Math.floor(Math.random() * messages.length)] });
            }
            // Genre detection
            if (lowerPrompt.includes('genre') || lowerPrompt.includes('skill')) {
                return JSON.stringify({ genre: 'techno', confidence: 0.85 });
            }
            // Default JSON response
            return JSON.stringify({
                response: 'Generated response',
                success: true
            });
        }

        // Non-JSON responses
        // Creative brief (before the 'creative' prompt check - brief prompts say "creative brief")
        if (lowerPrompt.includes('brief') || lowerPrompt.includes('vision')) {
            return 'A driving, hypnotic sound with pulsing bass and crisp highs.';
        }
        // Improvement suggestions (before name suggestions - improve prompts embed state with "trackName")
        if (lowerPrompt.includes('improve') || lowerPrompt.includes('enhance')) {
            const suggestions = ['Add more groove and swing', 'Layer in some variation',
                                'Boost the energy with open hats', 'Add sidechain pumping'];
            return suggestions[Math.floor(Math.random() * suggestions.length)];
        }
        // Creative/demo prompts ("stylistic music prompt" requests)
        if (lowerPrompt.includes('demo') || lowerPrompt.includes('creative') || lowerPrompt.includes('stylistic')) {
            const prompts = ['Driving techno with industrial edge', 'Deep house groove',
                            'Breakbeat energy', 'Minimal hypnotic pulse', 'Acid bassline journey'];
            return prompts[Math.floor(Math.random() * prompts.length)];
        }
        // Track name suggestions
        if (lowerPrompt.includes('suggest') && lowerPrompt.includes('name')) {
            const names = ['Neon Pulse', 'Cyber Dawn', 'Dark Matter', 'Digital Dreams',
                          'Voltage', 'Binary Sun', 'Chrome Heart', 'Synth City'];
            return names[Math.floor(Math.random() * names.length)];
        }
        // Commit messages
        if (lowerPrompt.includes('commit message')) {
            const messages = ['Updated settings', 'Tweaked parameters', 'New variation',
                             'Added changes', 'Refined mix', 'Adjustment'];
            return messages[Math.floor(Math.random() * messages.length)];
        }
        // Genre detection
        if (lowerPrompt.includes('genre') || lowerPrompt.includes('skill')) {
            return 'techno';
        }

        return 'AI response unavailable in local mode. Configure OpenAI with websim.config({ apiKey: "..." })';
    }

    // websim global API
    const websim = {
        // Configure OpenAI API
        config: (options = {}) => {
            if (options.apiKey) {
                openaiConfig = {
                    apiKey: options.apiKey,
                    chatModel: options.chatModel || options.model || 'gpt-4o-mini',
                    imageModel: options.imageModel || 'dall-e-3'
                };
                saveOpenAIConfig(openaiConfig);
                console.log(`[WebSim Stub] OpenAI configured: chat=${openaiConfig.chatModel}, image=${openaiConfig.imageModel}`);
            } else if (options.apiKey === null) {
                // Clear config
                openaiConfig = null;
                saveOpenAIConfig(null);
                console.log('[WebSim Stub] OpenAI configuration cleared');
            }
            return {
                configured: !!openaiConfig,
                chatModel: openaiConfig?.chatModel || null,
                imageModel: openaiConfig?.imageModel || null
            };
        },

        // Get current config status
        getConfig: () => ({
            openai: {
                configured: !!openaiConfig,
                chatModel: openaiConfig?.chatModel || null,
                imageModel: openaiConfig?.imageModel || null
            }
        }),

        // Get current user (mock)
        getCurrentUser: async () => {
            // Check if we have a stored username
            let username = localStorage.getItem(USER_KEY);
            if (!username) {
                username = 'local_user_' + Math.random().toString(36).substr(2, 6);
                localStorage.setItem(USER_KEY, username);
            }
            return {
                username,
                id: username,
                avatar_url: null
            };
        },

        // AI Chat Completions
        chat: {
            completions: {
                create: async (options = {}) => {
                    // Wait for config to load if not ready
                    if (!configLoaded) {
                        await configPromise;
                    }

                    const messages = options.messages || [];
                    const lastMessage = messages[messages.length - 1];
                    const prompt = lastMessage?.content || '';
                    // Generation calls always carry a system message identifying which app/schema
                    // is asking (suggestion/brief/demo calls are single-message, role 'user' only).
                    // Routing on this instead of the user's free-text prompt means the mock returns
                    // the right JSON shape even when the user's own words don't mention "drum"/"pattern".
                    const systemPrompt = messages.find(m => m.role === 'system')?.content || '';

                    const jsonMode = options.json || options.response_format?.type === 'json_object';

                    console.group('[websim.chat] Request');
                    console.log('Messages:', JSON.stringify(messages, null, 2));
                    console.log('Options:', { json: jsonMode, temperature: options.temperature, max_tokens: options.max_tokens });
                    console.groupEnd();

                    let content;

                    // Use OpenAI if configured
                    if (openaiConfig?.apiKey) {
                        try {
                            console.log('[websim.chat] Using OpenAI:', openaiConfig.chatModel);
                            content = await callOpenAI(messages, options);
                        } catch (e) {
                            console.error('[websim.chat] OpenAI error:', e.message);
                            // Fall back to mock on error
                            content = getMockResponse(prompt, jsonMode, systemPrompt);
                        }
                    } else {
                        // Simulate network delay for mock
                        console.log('[websim.chat] Using mock (no API key configured)');
                        await new Promise(r => setTimeout(r, 300 + Math.random() * 500));
                        content = getMockResponse(prompt, jsonMode, systemPrompt);
                    }

                    console.group('[websim.chat] Response');
                    console.log('Content:', content);
                    console.groupEnd();

                    return {
                        content,
                        role: 'assistant'
                    };
                }
            }
        },

        // Image Generation
        imageGen: async (options = {}) => {
            const { prompt, aspect_ratio, size, model, quality } = options;
            console.group('[websim.imageGen] Request');
            console.log('Prompt:', prompt);
            console.log('Options:', { aspect_ratio, size, model, quality });
            console.groupEnd();

            // Use OpenAI if configured
            if (openaiConfig?.apiKey) {
                try {
                    const imageModel = model || openaiConfig.imageModel || 'dall-e-3';
                    const isGptImage = imageModel.startsWith('gpt-image');

                    // Map aspect_ratio to size based on model
                    let imageSize = size;
                    if (!imageSize && aspect_ratio) {
                        if (isGptImage) {
                            // gpt-image-1 sizes: 1024x1024, 1536x1024, 1024x1536, auto
                            const gptRatioMap = {
                                '1:1': '1024x1024',
                                'square': '1024x1024',
                                '16:9': '1536x1024',
                                'landscape': '1536x1024',
                                '9:16': '1024x1536',
                                'portrait': '1024x1536',
                                'auto': 'auto'
                            };
                            imageSize = gptRatioMap[aspect_ratio] || '1024x1024';
                        } else {
                            // DALL-E sizes: 1024x1024, 1792x1024, 1024x1792
                            const dalleRatioMap = {
                                '1:1': '1024x1024',
                                'square': '1024x1024',
                                '16:9': '1792x1024',
                                'landscape': '1792x1024',
                                '9:16': '1024x1792',
                                'portrait': '1024x1792'
                            };
                            imageSize = dalleRatioMap[aspect_ratio] || '1024x1024';
                        }
                    }
                    imageSize = imageSize || '1024x1024';

                    console.log(`[websim.imageGen] Using OpenAI ${imageModel} (${imageSize})`);

                    // Build request body
                    const body = {
                        model: imageModel,
                        prompt: prompt,
                        n: 1,
                        size: imageSize
                    };

                    // gpt-image models don't support response_format (always return b64_json)
                    // DALL-E models support both 'url' and 'b64_json'
                    if (!isGptImage) {
                        body.response_format = 'url';
                    }

                    // Add quality for models that support it
                    if (quality && (imageModel === 'dall-e-3' || isGptImage)) {
                        body.quality = quality; // 'standard', 'hd', or for gpt-image: 'low', 'medium', 'high'
                    }

                    const response = await fetch('https://api.openai.com/v1/images/generations', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${openaiConfig.apiKey}`
                        },
                        body: JSON.stringify(body)
                    });

                    if (!response.ok) {
                        const error = await response.json().catch(() => ({}));
                        throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
                    }

                    const data = await response.json();
                    const imageData = data.data[0];

                    // Handle both URL and b64_json responses
                    let imageUrl;
                    if (imageData.url) {
                        imageUrl = imageData.url;
                    } else if (imageData.b64_json) {
                        // Convert base64 to Blob URL (more efficient than data URL)
                        imageUrl = base64ToBlobUrl(imageData.b64_json, 'image/png');
                    } else {
                        throw new Error('No image data in response');
                    }

                    console.log('[websim.imageGen] Response: Generated successfully, URL:', imageUrl);
                    return { url: imageUrl };

                } catch (e) {
                    console.error('[websim.imageGen] OpenAI error:', e.message);
                    // Fall through to mock response
                }
            }

            // Mock response - simulate network delay
            await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));

            // Return a placeholder image
            const colors = [
                ['#00ffff', '#ff00ff'],
                ['#ff00ff', '#39ff14'],
                ['#39ff14', '#00ffff'],
                ['#bf5fff', '#ff6600']
            ];
            const [c1, c2] = colors[Math.floor(Math.random() * colors.length)];

            // Create a simple SVG placeholder
            const svg = `
                <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
                    <defs>
                        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style="stop-color:${c1}"/>
                            <stop offset="100%" style="stop-color:${c2}"/>
                        </linearGradient>
                    </defs>
                    <rect width="256" height="256" fill="url(#g)"/>
                    <text x="128" y="128" text-anchor="middle" fill="#000" font-family="sans-serif" font-size="12" opacity="0.5">MOCK</text>
                </svg>
            `.trim();

            // Create blob URL from SVG
            const blob = new Blob([svg], { type: 'image/svg+xml' });
            const blobUrl = URL.createObjectURL(blob);

            console.log('[websim.imageGen] Response: Mock placeholder image, URL:', blobUrl);
            return { url: blobUrl };
        }
    };

    // Expose to global scope ONLY if not already defined (allows platform to take precedence)
    if (!window.WebsimSocket) {
        window.WebsimSocket = WebsimSocket;
    }
    if (!window.websim) {
        window.websim = websim;
        console.log('[WebSim Stub] Loaded - running in local development mode');
        console.log('[WebSim Stub] Data persisted to localStorage');
    } else {
        console.log('[WebSim Stub] Platform websim detected - using platform API');
    }


})();
