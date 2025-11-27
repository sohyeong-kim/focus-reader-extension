// TTS Engine Selection
const ttsOptions = document.querySelectorAll('.tts-option');
const ttsRadios = document.querySelectorAll('input[name="tts-engine"]');

// Load saved TTS engine
chrome.storage.local.get(['ttsEngine'], (result) => {
    const engine = result.ttsEngine || 'kokoro';
    document.getElementById(`tts-${engine}`).checked = true;
    updateTTSOptionStyles();
});

// TTS option click handlers
ttsOptions.forEach(option => {
    option.addEventListener('click', () => {
        const engine = option.dataset.engine;
        document.getElementById(`tts-${engine}`).checked = true;
        chrome.storage.local.set({ ttsEngine: engine });
        updateTTSOptionStyles();
        
        // Notify content script
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'TTS_ENGINE_CHANGED', engine });
            }
        });
    });
});

function updateTTSOptionStyles() {
    ttsOptions.forEach(opt => {
        const radio = opt.querySelector('input[type="radio"]');
        if (radio.checked) {
            opt.classList.add('selected');
        } else {
            opt.classList.remove('selected');
        }
    });
}

// Check service status
async function checkServices() {
    const spacyDot = document.getElementById('spacy-dot');
    const kokoroDot = document.getElementById('kokoro-dot');
    
    // Check spaCy
    try {
        const resp = await fetch('http://localhost:8000/health', { method: 'GET' });
        if (resp.ok) {
            spacyDot.classList.add('online');
            spacyDot.classList.remove('offline');
        } else {
            throw new Error();
        }
    } catch {
        spacyDot.classList.add('offline');
        spacyDot.classList.remove('online');
    }
    
    // Check Kokoro
    try {
        const resp = await fetch('http://localhost:8001/health', { method: 'GET' });
        if (resp.ok) {
            kokoroDot.classList.add('online');
            kokoroDot.classList.remove('offline');
        } else {
            throw new Error();
        }
    } catch {
        kokoroDot.classList.add('offline');
        kokoroDot.classList.remove('online');
    }
}

checkServices();

// API Key handling
const apiKeyInput = document.getElementById('api-key');
const saveKeyBtn = document.getElementById('save-key');

// Load saved API key
chrome.storage.local.get(['openaiApiKey'], (result) => {
    if (result.openaiApiKey) {
        apiKeyInput.value = '••••••••••••••••';
    }
});

saveKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value;
    if (key && !key.startsWith('••')) {
        chrome.storage.local.set({ openaiApiKey: key }, () => {
            apiKeyInput.value = '••••••••••••••••';
            saveKeyBtn.textContent = '✅ Saved!';
            setTimeout(() => {
                saveKeyBtn.textContent = '💾 Save';
            }, 2000);
        });
    }
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
