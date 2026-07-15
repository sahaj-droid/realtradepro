// ========================================
// GEMINI MODULE — Gemini Only (Multi-Key Rotation)
// Primary: gemini-3.1-flash-lite
// Fallback: gemini-3.5-flash
// ========================================

// ========================================
// 🔑 KEY HELPERS
// ========================================

window.getGeminiKeys = function () {
    const val = localStorage.getItem('geminiApiKey');
    if (!val || !val.trim()) return [];
    return val.includes(',') ? val.split(',').map(k => k.trim()).filter(Boolean) : [val.trim()];
};

// ========================================
// 🚀 GEMINI CALL — Single Turn (with Search Grounding)
// ========================================
async function directGeminiCall(prompt, useSearch = false) {
    // Search Grounding mate — primary + fallbacks
    const models = useSearch
        ? ['gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash']
        : ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-2.0-flash'];
    const keys = getGeminiKeys();

    if (keys.length === 0) {
        console.warn('❌ No Gemini API keys set.');
        return { ok: false };
    }

    for (const k of keys) {
        for (const modelName of models) {
            try {
                await new Promise(r => setTimeout(r, 300));

                const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${k}`;

                const body = {
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 2048
                    }
                };

                if (useSearch) {
                    // Gemini 2.x+ uses googleSearch (camelCase), 1.5 uses google_search
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
                if (response.ok && data.candidates && data.candidates[0]?.content) {
                    return { ok: true, answer: data.candidates[0].content.parts[0].text };
                }

                if (response.status === 429) {
                    console.warn(`⚠️ Key rate limited on ${modelName}, trying next...`);
                    continue;
                }
                console.warn(`Gemini error (${modelName}): [${response.status}]`, data.error?.message || JSON.stringify(data.error));
            } catch (err) {
                console.error(`Gemini call error (${modelName}):`, err.message);
            }
        }
    }

    console.error('❌ All Gemini keys/models exhausted.');
    return { ok: false };
}

// ========================================
// 💬 GEMINI MULTI-TURN CHAT
// ========================================
async function directGeminiCallMultiTurn(priorHistory, currentPrompt) {
    const models = ['gemini-3.1-flash-lite', 'gemini-3.5-flash'];
    const keys = getGeminiKeys();

    if (keys.length === 0) {
        console.warn('❌ No Gemini API keys set.');
        return { ok: false };
    }

    for (const k of keys) {
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
                if (response.status === 429) {
                    console.warn(`⚠️ Rate limit on ${modelName} (key rotation)...`);
                    continue;
                }
                console.warn(`Gemini MultiTurn error (${modelName}):`, data.error?.message);
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
    const models = ['gemini-3.1-flash-lite', 'gemini-3.5-flash'];
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
                await new Promise(r => setTimeout(r, 300));
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
// 🌊 GEMINI MULTI-TURN STREAMING — Full Multi-Key Support
// ========================================
async function directGeminiCallStreamMultiTurn(priorHistory, currentPrompt, onChunk, useSearch = false) {
    // Search Grounding mate gemini-2.5-flash-lite — baaki chat/insights mate regular models
    const models = useSearch
        ? ['gemini-2.5-flash-lite']
        : ['gemini-3.1-flash-lite', 'gemini-3.5-flash'];
    const keys = getGeminiKeys();

    if (keys.length === 0) return { ok: false };

    const contents = [...priorHistory, { role: 'user', parts: [{ text: currentPrompt }] }];
    const body = {
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
    };

    if (useSearch) {
        // ✅ Correct REST API syntax for Google Search Grounding
        body.tools = [{ google_search: {} }];
    }

    // ✅ ALL keys try karo (not just keys[0])
    for (const k of keys) {
        for (const modelName of models) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${k}`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });

                if (!response.ok) {
                    console.warn(`⚠️ ${modelName} failed (${response.status}). Trying next...`);
                    continue;
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder('utf-8');
                let fullText = '';

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
                                    if (onChunk) onChunk(fullText);
                                }
                            } catch (e) {
                                // Incomplete JSON chunk, ignore
                            }
                        }
                    }
                }
                return { ok: true, answer: fullText };
            } catch (e) {
                console.error(`Stream error (${modelName}):`, e.message);
            }
        }
    }

    console.error('❌ All Gemini streaming attempts failed. Falling back to non-stream...');
    return await directGeminiCallMultiTurn(priorHistory, currentPrompt);
}

// ========================================
// 📤 GLOBAL EXPORTS
// ========================================
window.directGeminiCall                    = directGeminiCall;
window.directGeminiCallMultiTurn           = directGeminiCallMultiTurn;
window.directGeminiCallWithFile            = directGeminiCallWithFile;
window.directGeminiCallStreamMultiTurn     = directGeminiCallStreamMultiTurn;

console.log('✅ Gemini Module Loaded | Chat: gemini-3.1-flash-lite → gemini-3.5-flash | Search: gemini-2.5-flash-lite | Multi-Key | Streaming: Fixed');
console.log('📊 API Status:', getApiStatus());
