// ADHD Focus Reader - Popup Script
// OpenAI TTS only version

// API Key handling
const apiKeyInput = document.getElementById('api-key');
const saveKeyBtn = document.getElementById('save-key');

// Load saved API key
chrome.storage.local.get(['openaiApiKey'], (result) => {
    if (result.openaiApiKey) {
        apiKeyInput.value = '••••••••••••••••';
    }
});

// Voice selection
const voiceSelect = document.getElementById('tts-voice');

chrome.storage.local.get(['ttsVoice'], (result) => {
    if (result.ttsVoice) voiceSelect.value = result.ttsVoice;
});

saveKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value;
    if (!key || key.startsWith('••')) return;

    chrome.storage.local.set({ openaiApiKey: key }, () => {
        apiKeyInput.value = '••••••••••••••••';
        saveKeyBtn.textContent = '✅ Saved!';
        setTimeout(() => { saveKeyBtn.textContent = '💾 Save'; }, 2000);
    });
});

// Voice save & preview
const saveVoiceBtn = document.getElementById('save-voice');
let previewAudio = null;

async function previewVoice(voice) {
    const apiKey = await new Promise(r =>
        chrome.storage.local.get(['openaiApiKey'], res => r(res.openaiApiKey))
    );
    if (!apiKey) {
        saveVoiceBtn.textContent = '⚠️ Set API key first';
        setTimeout(() => { saveVoiceBtn.textContent = '💾 Save & Preview'; }, 2500);
        return;
    }

    const voiceName = voice.charAt(0).toUpperCase() + voice.slice(1);

    try {
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini-tts',
                input: `Hello there, I'm ${voiceName}.`,
                voice: voice,
                speed: 1.0
            })
        });

        if (!response.ok) throw new Error(`OpenAI API ${response.status}`);

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        if (previewAudio) {
            previewAudio.pause();
            if (previewAudio.src) URL.revokeObjectURL(previewAudio.src);
        }
        previewAudio = new Audio(url);
        previewAudio.onended = () => URL.revokeObjectURL(url);
        previewAudio.play();
    } catch (e) {
        console.error('Voice preview failed:', e);
        saveVoiceBtn.textContent = '❌ Preview failed';
        setTimeout(() => { saveVoiceBtn.textContent = '💾 Save & Preview'; }, 2500);
    }
}

saveVoiceBtn.addEventListener('click', () => {
    const voice = voiceSelect.value;
    chrome.storage.local.set({ ttsVoice: voice }, () => {
        saveVoiceBtn.textContent = `✅ Saved: ${voice} — previewing...`;
        setTimeout(() => { saveVoiceBtn.textContent = '💾 Save & Preview'; }, 2500);
        previewVoice(voice);
    });
});

// Cache management
const cacheInfo = document.getElementById('cache-info');
const clearPageBtn = document.getElementById('clear-page-cache');
const clearAllBtn = document.getElementById('clear-all-cache');

function updateCacheInfo() {
    chrome.storage.local.get(null, (items) => {
        const audioKeys = Object.keys(items).filter(k => k.startsWith('audio_'));
        const totalSize = audioKeys.reduce((sum, k) => {
            return sum + (items[k]?.length || 0);
        }, 0);
        const sizeMB = (totalSize / 1024 / 1024).toFixed(2);
        cacheInfo.textContent = `${audioKeys.length} audio files (${sizeMB} MB)`;
    });
}

updateCacheInfo();

clearPageBtn.addEventListener('click', () => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
            const url = new URL(tabs[0].url);
            const pageKey = url.hostname + url.pathname;
            
            chrome.storage.local.get(null, (items) => {
                const keysToRemove = Object.keys(items).filter(k => 
                    k.startsWith('audio_') && k.includes(pageKey)
                );
                chrome.storage.local.remove(keysToRemove, () => {
                    updateCacheInfo();
                    clearPageBtn.textContent = '✅ Cleared!';
                    setTimeout(() => {
                        clearPageBtn.textContent = '🗑️ This Page';
                    }, 2000);
                });
            });
        }
    });
});

clearAllBtn.addEventListener('click', () => {
    chrome.storage.local.get(null, (items) => {
        const audioKeys = Object.keys(items).filter(k => k.startsWith('audio_'));
        chrome.storage.local.remove(audioKeys, () => {
            updateCacheInfo();
            clearAllBtn.textContent = '✅ Cleared!';
            setTimeout(() => {
                clearAllBtn.textContent = '🗑️ Clear All';
            }, 2000);
        });
    });
});
