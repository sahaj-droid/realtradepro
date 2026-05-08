// ========================================
// GEMINI MODULE — Multi-Provider with Fallback
// Primary: Gemini 3.1 Flash-Lite
// Fallback 1: Groq (llama-3.1-8b-instant)
// Fallback 2: OpenRouter (user-configured models)
// ========================================

// ========================================
// 🔑 KEY HELPERS
// ========================================

window.getGeminiKeys = function () {
    const val = localStorage.getItem('geminiApiKey');
    if (!val || !val.trim()) return [];
    return val.includes(',') ? val.split(',').map(k => k.trim()).filter(Boolean) : [val.trim()];
};

window.getGroqKey = function () {
    return (localStorage.getItem('groqApiKey') || '').trim();
};

window.getOpenRouterKey = function () {
    return (localStorage.getItem('openRouterApiKey') || '').trim();
};

window.getOpenRouterModels = function () {
    const val = localStorage.getItem('openRouterModels');
    if (!val || !val.trim()) return ['meta-llama/llama-3.1-8b-instruct:free'];
    return val.split(',').map(m => m.trim()).filter(Boolean);
};

// ========================================
// 🔍 GROQ CALL (Single Turn)
// ========================================
async function _groqCall(messages) {
    const key = getGroqKey();
    if (!key) return { ok: false };

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: messages,
                max_tokens: 2048,
                temperature: 0.7
            })
        });

        const data = await response.json();
        if (response.ok && data.choices && data.choices[0]) {
            return { ok: true, answer: data.choices[0].message.content };
        }
        console.warn('Groq error:', data.error?.message || response.status);
        return { ok: false };
    } catch (err) {
        console.error('Groq call failed:', err.message);
        return { ok: false };
    }
}

// ========================================
// 🌐 OPENROUTER CALL (Single Turn)
// ========================================
async function _openRouterCall(messages) {
    const key = getOpenRouterKey();
    if (!key) return { ok: false };

    const models = getOpenRouterModels();

    for (const model of models) {
        try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`,
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'RealTradePro - Nivi'
                },
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    max_tokens: 2048,
                    temperature: 0.7
                })
            });

            const data = await response.json();
            if (response.ok && data.choices && data.choices[0]) {
                console.log(`✅ OpenRouter success with model: ${model}`);
                return { ok: true, answer: data.choices[0].message.content };
            }
            console.warn(`OpenRouter model ${model} failed:`, data.error?.message || response.status);
        } catch (err) {
            console.error(`OpenRouter model ${model} error:`, err.message);
        }
    }
    return { ok: false };
}

// ========================================
// 🚀 GEMINI CALL — Single Turn (with Search Grounding)
// ========================================
async function directGeminiCall(prompt, useSearch = false) {
    const modelName = 'gemini-3.1-flash-lite-preview';
    const keys = getGeminiKeys();

    // --- Try Gemini ---
    if (keys.length > 0) {
        for (const k of keys) {
            try {
                await new Promise(r => setTimeout(r, 500));

                const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${k}`;

                const body = {
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 2048
                    }
                };

                // Google Search Grounding (real-time web search)
                if (useSearch) {
                    body.tools = [{ googleSearch: {} }];
                }

                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });

                const data = await response.json();
                if (response.ok && data.candidates && data.candidates[0]?.content) {
                    return { ok: true, answer: data.candidates[0].content.parts[0].text };
                }

                if (response.status === 429) {
                    console.warn('Gemini key rate limited, trying next...');
                    continue;
                }
                console.warn('Gemini error:', data.error?.message);
            } catch (err) {
                console.error('Gemini call error:', err.message);
            }
        }
    }

    // --- Fallback 1: Groq ---
    console.log('🔄 Gemini failed → Trying Groq...');
    const groqResult = await _groqCall([{ role: 'user', content: prompt }]);
    if (groqResult.ok) return groqResult;

    // --- Fallback 2: OpenRouter ---
    console.log('🔄 Groq failed → Trying OpenRouter...');
    const orResult = await _openRouterCall([{ role: 'user', content: prompt }]);
    if (orResult.ok) return orResult;

    return { ok: false };
}

// ========================================
// 💬 GEMINI MULTI-TURN CHAT (3.1 -> 2.0 -> Groq Fallback)
// ========================================
async function directGeminiCallMultiTurn(priorHistory, currentPrompt) {
    const models = ['gemini-3.1-flash-lite-preview', 'gemini-2.0-flash'];
    const keys = getGeminiKeys();

    if (keys.length > 0) {
        for (const k of keys) {
            // બંને મોડલ માટે લૂપ
            for (const modelName of models) {
                try {
                    const contents = [...priorHistory, { role: 'user', parts: [{ text: currentPrompt }] }];
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${k}`;

                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents,
                            generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
                        })
                    });

                    const data = await response.json();
                    if (response.ok && data.candidates && data.candidates[0]?.content) {
                        return { ok: true, answer: data.candidates[0].content.parts[0].text };
                    }
                    if (response.status === 429) { continue; } // રેટ લિમિટ આવે તો આગળ વધો
                    console.warn(`Gemini MultiTurn error with ${modelName}:`, data.error?.message);
                } catch (e) {
                    console.error(`Gemini MultiTurn error with ${modelName}:`, e.message);
                }
            }
        }
    }

    // --- Convert history for OpenAI-style APIs ---
    const openAiMessages = priorHistory.map(m => ({
        role: m.role === 'model' ? 'assistant' : 'user',
        content: m.parts?.[0]?.text || ''
    })).concat({ role: 'user', content: currentPrompt });

    // --- Fallback 1: Groq ---
    console.log('🔄 All Gemini models failed → Trying Groq...');
    const groqResult = await _groqCall(openAiMessages);
    if (groqResult.ok) return groqResult;

    // --- Fallback 2: OpenRouter ---
    console.log('🔄 Groq failed → Trying OpenRouter...');
    const orResult = await _openRouterCall(openAiMessages);
    if (orResult.ok) return orResult;

    return { ok: false };
}

// ========================================
// 📁 FILE READING — PDF, JS, HTML, TXT, etc.
// Gemini natively reads files as base64
// ========================================
async function directGeminiCallWithFile(prompt, fileBase64, mimeType) {
    const modelName = 'gemini-3.1-flash-lite-preview';
    const keys = getGeminiKeys();

    const filePart = {
        inline_data: {
            mime_type: mimeType,
            data: fileBase64
        }
    };

    // --- Try Gemini (only Gemini supports native file reading) ---
    if (keys.length > 0) {
        for (const k of keys) {
            try {
                await new Promise(r => setTimeout(r, 500));
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${k}`;

                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            role: 'user',
                            parts: [filePart, { text: prompt }]
                        }],
                        generationConfig: { temperature: 0.5, maxOutputTokens: 4096 }
                    })
                });

                const data = await response.json();
                if (response.ok && data.candidates && data.candidates[0]?.content) {
                    return { ok: true, answer: data.candidates[0].content.parts[0].text };
                }
                if (response.status === 429) { continue; }
                console.warn('Gemini file call error:', data.error?.message);
            } catch (err) {
                console.error('Gemini file call error:', err.message);
            }
        }
    }

    // --- Fallback for text files: Extract text → send as prompt ---
    // (PDF binary nahi chaltu Groq/OpenRouter ma, but .js/.html/.txt chalse)
    if (['text/javascript', 'text/html', 'text/plain', 'text/css'].includes(mimeType)) {
        try {
            const textContent = atob(fileBase64);
            const combinedPrompt = `File Content:\n\`\`\`\n${textContent.slice(0, 8000)}\n\`\`\`\n\nUser Query: ${prompt}`;

            console.log('🔄 Gemini file failed → Trying Groq with extracted text...');
            const groqResult = await _groqCall([{ role: 'user', content: combinedPrompt }]);
            if (groqResult.ok) return groqResult;

            console.log('🔄 Groq failed → Trying OpenRouter...');
            const orResult = await _openRouterCall([{ role: 'user', content: combinedPrompt }]);
            if (orResult.ok) return orResult;
        } catch (e) {
            console.error('Text extraction for fallback failed:', e.message);
        }
    }

    return { ok: false, answer: '⚠️ File read nahi thayo. Gemini key check karo.' };
}

// ========================================
// 📁 FILE → BASE64 CONVERTER (Browser utility)
// nivi.js ma use karva mate
// ========================================
window.readFileAsBase64 = function (file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            // Remove "data:mime/type;base64," prefix
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = () => reject(new Error('File read failed'));
        reader.readAsDataURL(file);
    });
};

// ========================================
// 📁 MIME TYPE DETECTOR
// ========================================
window.getFileMimeType = function (filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const map = {
        'pdf':  'application/pdf',
        'js':   'text/javascript',
        'html': 'text/html',
        'htm':  'text/html',
        'css':  'text/css',
        'txt':  'text/plain',
        'md':   'text/plain',
        'json': 'application/json',
        'csv':  'text/csv',
        'png':  'image/png',
        'jpg':  'image/jpeg',
        'jpeg': 'image/jpeg',
        'webp': 'image/webp',
        'gif':  'image/gif',
    };
    return map[ext] || 'text/plain';
};

// ========================================
// ⚙️ SETTINGS HELPER — localStorage keys info
// LocalStorage keys used:
//   geminiApiKey     → comma-separated Gemini API keys
//   groqApiKey       → single Groq API key
//   openRouterApiKey → single OpenRouter API key
//   openRouterModels → comma-separated model names
//                      e.g. "meta-llama/llama-3.1-8b-instruct:free,deepseek/deepseek-r1:free"
// ========================================
window.saveApiSettings = function ({ gemini, groq, openRouter, openRouterModels }) {
    if (gemini !== undefined)          localStorage.setItem('geminiApiKey', gemini);
    if (groq !== undefined)            localStorage.setItem('groqApiKey', groq);
    if (openRouter !== undefined)      localStorage.setItem('openRouterApiKey', openRouter);
    if (openRouterModels !== undefined) localStorage.setItem('openRouterModels', openRouterModels);
    console.log('✅ API Settings saved.');
};

window.getApiStatus = function () {
    return {
        gemini:          getGeminiKeys().length > 0 ? `✅ ${getGeminiKeys().length} key(s)` : '❌ Not set',
        groq:            getGroqKey() ? '✅ Set' : '❌ Not set',
        openRouter:      getOpenRouterKey() ? '✅ Set' : '❌ Not set',
        openRouterModels: getOpenRouterModels().join(', ')
    };
};
// ========================================
// 🌊 GEMINI MULTI-TURN STREAMING (3.1 -> 2.0 -> Groq Fallback)
// ========================================
async function directGeminiCallStreamMultiTurn(priorHistory, currentPrompt, onChunk, useSearch = false) {
    // 🚀 તમારી ડિમાન્ડ મુજબ: પહેલા 3.1, પછી 2.0 
    const models = ['gemini-3.1-flash-lite-preview', 'gemini-2.0-flash'];
    const keys = getGeminiKeys();

    if (keys.length === 0) return { ok: false };
    const k = keys[0]; 

    const contents = [...priorHistory, { role: 'user', parts: [{ text: currentPrompt }] }];
    const body = {
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
    };

    // 🚀 ગૂગલ સર્ચ નો સાચો સ્પેલિંગ
    if (useSearch) {
        body.tools = [{ googleSearch: {} }];
    }

    // એક પછી એક મોડલ ટ્રાય કરશે
    for (const modelName of models) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${k}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                console.warn(`⚠️ ${modelName} failed (${response.status}). Trying next model...`);
                continue; // જો 3.1 ફેલ થાય તો સીધું 2.0 પર જશે
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let fullText = "";

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

                for (const line of lines) {
                    const dataStr = line.replace('data: ', '').trim();
                    if (dataStr) {
                        try {
                            const data = JSON.parse(dataStr);
                            if (data.candidates && data.candidates[0].content) {
                                const textPart = data.candidates[0].content.parts.map(p => p.text).join('');
                                fullText += textPart;
                                if (onChunk) onChunk(fullText); // UI ને નવો શબ્દ મોકલો
                            }
                        } catch (e) {
                            // Incomplete JSON chunk, ignore
                        }
                    }
                }
            }
            return { ok: true, answer: fullText }; // 🚀 સક્સેસ!
        } catch (e) {
            console.error(`Stream error with ${modelName}:`, e.message);
        }
    }

    // જો Gemini 3.1 અને 2.0 બંને ફેલ થાય, તો જ Groq પાસે જશે
    console.log("🔄 Both Gemini models failed for stream → Falling back to Groq/OpenRouter...");
    return await directGeminiCallMultiTurn(priorHistory, currentPrompt);
}

// ========================================
// 📤 GLOBAL EXPORTS
// ========================================
window.directGeminiCall             = directGeminiCall;
window.directGeminiCallMultiTurn    = directGeminiCallMultiTurn;
window.directGeminiCallWithFile     = directGeminiCallWithFile;
window.directGeminiCallStreamMultiTurn = directGeminiCallStreamMultiTurn;

console.log('✅ Gemini Module Loaded | Fallback: Groq → OpenRouter | File Reading: ON');
console.log('📊 API Status:', getApiStatus());
