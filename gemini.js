// ========================================
// GEMINI MODULE — Google Gemini API Client
// Standard Chat: Primary gemini-3.8, Fallback gemini-2.5-flash-lite, gemini-2.0-flash, gemini-1.5-flash
// Web Search / Live Price: gemini-2.5-flash-lite, gemini-2.0-flash, gemini-1.5-flash
// ========================================

const SEARCH_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-3.5-flash-lite'
];

const CHAT_MODELS = [
    'gemini-2.5-flash',
    'gemini-3.8-flash',
    'gemini-2.5-pro',
    'gemini-2.5-flash-lite',
    'gemini-3.5-flash-lite'
];

// ========================================
// 🔑 KEY HELPERS
// ========================================
window.getGeminiKeys = function () {
    const val = localStorage.getItem('geminiApiKey');
    if (!val || !val.trim()) return [];
    return val.includes(',') ? val.split(',').map(k => k.trim()).filter(Boolean) : [val.trim()];
};

// ========================================
// 🛠️ MULTI-TURN SANITIZER (Prevents 400 Bad Request)
// Ensures strictly alternating user <-> model roles
// ========================================
function sanitizeGeminiContents(contents) {
    const sanitized = [];
    for (const c of contents) {
        if (!c || !c.parts || !c.parts[0] || !c.parts[0].text) continue;
        const text = String(c.parts[0].text).trim();
        if (!text) continue;
        const role = (c.role === 'nivi' || c.role === 'model') ? 'model' : 'user';

        if (sanitized.length > 0 && sanitized[sanitized.length - 1].role === role) {
            sanitized[sanitized.length - 1].parts[0].text += '\n\n' + text;
        } else {
            sanitized.push({ role, parts: [{ text }] });
        }
    }
    return sanitized;
}

// ========================================
// 🚀 GEMINI CALL — Single Turn
// ========================================
async function directGeminiCall(prompt, useSearch = false) {
    const models = useSearch ? SEARCH_MODELS : CHAT_MODELS;
    const keys = getGeminiKeys();

    if (keys.length === 0) {
        console.warn('❌ No Gemini API keys set.');
        return { ok: false };
    }

    for (const k of keys) {
        for (const modelName of models) {
            try {
                await new Promise(r => setTimeout(r, 150));
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${k}`;

                const body = {
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 2048
                    }
                };

                if (useSearch) {
                    const isV2Plus = modelName.startsWith('gemini-2') || modelName.startsWith('gemini-3');
                    body.tools = isV2Plus
                        ? [{ googleSearch: {} }]
                        : [{ google_search: {} }];
                }

                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });

                const data = await response.json();
                if (response.ok && data.candidates && data.candidates[0]?.content?.parts) {
                    const text = data.candidates[0].content.parts.map(p => p.text || '').join('');
                    if (text.trim()) return { ok: true, answer: text };
                }

                if (response.status === 429) {
                    console.warn(`⚠️ Rate limited on ${modelName}, trying next...`);
                    continue;
                }
                console.warn(`Gemini call error (${modelName}): [${response.status}]`, data.error?.message || '');
            } catch (err) {
                console.error(`Gemini call exception (${modelName}):`, err.message);
            }
        }
    }

    console.error('❌ All Gemini keys/models exhausted.');
    return { ok: false };
}

// ========================================
// 💬 GEMINI MULTI-TURN CHAT (Non-Streaming Fallback)
// ========================================
async function directGeminiCallMultiTurn(priorHistory, currentPrompt, useSearch = false) {
    const models = useSearch ? SEARCH_MODELS : CHAT_MODELS;
    const keys = getGeminiKeys();

    if (keys.length === 0) {
        console.warn('❌ No Gemini API keys set.');
        return { ok: false };
    }

    const rawContents = [...priorHistory, { role: 'user', parts: [{ text: currentPrompt }] }];
    const contents = sanitizeGeminiContents(rawContents);

    for (const k of keys) {
        for (const modelName of models) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${k}`;
                const body = {
                    contents,
                    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
                };

                if (useSearch) {
                    const isV2Plus = modelName.startsWith('gemini-2') || modelName.startsWith('gemini-3');
                    body.tools = isV2Plus ? [{ googleSearch: {} }] : [{ google_search: {} }];
                }

                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });

                const data = await response.json();
                if (response.ok && data.candidates && data.candidates[0]?.content?.parts) {
                    const text = data.candidates[0].content.parts.map(p => p.text || '').join('');
                    if (text.trim()) return { ok: true, answer: text };
                }
                if (response.status === 429) {
                    console.warn(`⚠️ Rate limit on ${modelName} (key rotation)...`);
                    continue;
                }
                console.warn(`Gemini MultiTurn error (${modelName}): [${response.status}]`, data.error?.message);
            } catch (e) {
                console.error(`Gemini MultiTurn error (${modelName}):`, e.message);
            }
        }
    }

    console.error('❌ All Gemini keys/models exhausted for MultiTurn.');
    return { ok: false };
}

// ========================================
// 📁 FILE READING — PDF, JS, HTML, TXT, Images
// ========================================
async function directGeminiCallWithFile(prompt, fileBase64, mimeType) {
    const models = CHAT_MODELS;
    const keys = getGeminiKeys();

    const filePart = {
        inline_data: {
            mime_type: mimeType,
            data: fileBase64
        }
    };

    if (keys.length === 0) {
        return { ok: false, answer: '⚠️ Gemini API key set karo. Settings > Nivi AI.' };
    }

    for (const k of keys) {
        for (const modelName of models) {
            try {
                await new Promise(r => setTimeout(r, 200));
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
                if (response.ok && data.candidates && data.candidates[0]?.content?.parts) {
                    const text = data.candidates[0].content.parts.map(p => p.text || '').join('');
                    if (text.trim()) return { ok: true, answer: text };
                }
                if (response.status === 429) { continue; }
                console.warn(`Gemini file call error (${modelName}):`, data.error?.message);
            } catch (err) {
                console.error(`Gemini file call error (${modelName}):`, err.message);
            }
        }
    }

    return { ok: false, answer: '⚠️ File read nahi thayo. Gemini key check karo — Settings > Nivi AI.' };
}

// ========================================
// 📁 FILE → BASE64 CONVERTER
// ========================================
window.readFileAsBase64 = function (file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
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
// ⚙️ API SETTINGS HELPER
// ========================================
window.saveApiSettings = function ({ gemini }) {
    if (gemini !== undefined) localStorage.setItem('geminiApiKey', gemini);
    console.log('✅ Gemini API Settings saved.');
};

window.getApiStatus = function () {
    return {
        gemini: getGeminiKeys().length > 0 ? `✅ ${getGeminiKeys().length} key(s) active` : '❌ Not set'
    };
};

// ========================================
// 🌊 GEMINI MULTI-TURN STREAMING — Full Multi-Key & Multi-Model Support
// ========================================
async function directGeminiCallStreamMultiTurn(priorHistory, currentPrompt, onChunk, useSearch = false) {
    const models = useSearch ? SEARCH_MODELS : CHAT_MODELS;
    const keys = getGeminiKeys();

    if (keys.length === 0) return { ok: false, error: 'NO_KEY' };

    let lastError = '';
    const rawContents = [...priorHistory, { role: 'user', parts: [{ text: currentPrompt }] }];
    const contents = sanitizeGeminiContents(rawContents);

    const body = {
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
    };

    // ✅ ALL keys and models in priority order
    for (const k of keys) {
        for (const modelName of models) {
            try {
                if (useSearch) {
                    const isV2Plus = modelName.startsWith('gemini-2') || modelName.startsWith('gemini-3');
                    body.tools = isV2Plus
                        ? [{ googleSearch: {} }]
                        : [{ google_search: {} }];
                } else {
                    delete body.tools;
                }

                const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${k}`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });

                if (!response.ok) {
                    const errJson = await response.json().catch(() => null);
                    lastError = errJson?.error?.message || `HTTP ${response.status} (${modelName})`;
                    console.warn(`⚠️ ${modelName} stream failed (${response.status}): ${lastError}. Trying next model/key...`);
                    continue;
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder('utf-8');
                let fullText = '';
                let buffer = '';

                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed.startsWith('data: ')) continue;
                        const dataStr = trimmed.replace('data: ', '').trim();
                        if (!dataStr || dataStr === '[DONE]') continue;
                        try {
                            const data = JSON.parse(dataStr);
                            if (data.candidates && data.candidates[0]?.content?.parts) {
                                const textPart = data.candidates[0].content.parts.map(p => p.text || '').join('');
                                fullText += textPart;
                                if (onChunk) onChunk(fullText);
                            }
                        } catch (e) {
                            // Incomplete JSON chunk, will be handled with buffer
                        }
                    }
                }

                if (fullText.trim()) {
                    return { ok: true, answer: fullText };
                }
            } catch (e) {
                lastError = e.message;
                console.error(`Stream error (${modelName}):`, e.message);
            }
        }
    }

    console.error('❌ All Gemini streaming attempts failed. Falling back to non-stream...');
    const fb = await directGeminiCallMultiTurn(priorHistory, currentPrompt, useSearch);
    if (fb && fb.ok) return fb;
    return { ok: false, error: lastError || 'All Gemini models and keys exhausted' };
}

// ========================================
// 📤 GLOBAL EXPORTS
// ========================================
window.directGeminiCall                    = directGeminiCall;
window.directGeminiCallMultiTurn           = directGeminiCallMultiTurn;
window.directGeminiCallWithFile            = directGeminiCallWithFile;
window.directGeminiCallStreamMultiTurn     = directGeminiCallStreamMultiTurn;

console.log('✅ Gemini Module Loaded | Search: gemini-2.5-flash-lite | Chat: gemini-3.8 / gemini-2.5-flash-lite / gemini-2.0-flash');
