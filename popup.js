document.addEventListener('DOMContentLoaded', async () => {
    const apiKeyInput = document.getElementById('api-key');
    const saveBtn = document.getElementById('save-key');
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.getElementById('status-text');
    const cacheInfo = document.getElementById('cache-info');
    const clearPageCacheBtn = document.getElementById('clear-page-cache');
    const clearAllCacheBtn = document.getElementById('clear-all-cache');

    // Load saved API key
    chrome.storage.sync.get(['openai_api_key'], (result) => {
        if (result.openai_api_key) {
            apiKeyInput.value = result.openai_api_key;
        }
    });

    // Save API key
    saveBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            chrome.storage.sync.set({ openai_api_key: key }, () => {
                saveBtn.textContent = '✅ 저장됨';
                setTimeout(() => saveBtn.textContent = '💾 저장', 1500);
            });
        }
    });

    // Check server
    async function checkServer() {
        try {
            const response = await fetch('http://localhost:8000/health', { 
                signal: AbortSignal.timeout(2000) 
            });
            if (response.ok) {
                statusDot.style.background = '#10b981';
                statusText.textContent = '연결됨 (localhost:8000)';
            } else throw new Error();
        } catch {
            statusDot.style.background = '#ef4444';
            statusText.textContent = '연결 안됨 - docker-compose up -d';
        }
    }

    // Get current tab's page key
    async function getCurrentTab() {
        return new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                resolve(tabs[0] || null);
            });
        });
    }

    // Cache info
    async function updateCacheInfo() {
        const tab = await getCurrentTab();
        let currentPageKey = null;
        
        if (tab?.url) {
            try {
                const url = new URL(tab.url);
                currentPageKey = url.hostname + url.pathname;
            } catch {}
        }
        
        try {
            const request = indexedDB.open('FocusReaderExtension', 1);
            request.onsuccess = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains('audioCache')) {
                    cacheInfo.innerHTML = '캐시 없음';
                    return;
                }
                
                const tx = db.transaction('audioCache', 'readonly');
                const store = tx.objectStore('audioCache');
                const allRequest = store.getAll();
                
                allRequest.onsuccess = () => {
                    const all = allRequest.result || [];
                    const totalCount = all.length;
                    
                    // 현재 페이지 캐시 카운트
                    const pageCount = currentPageKey 
                        ? all.filter(item => item.pageKey === currentPageKey).length 
                        : 0;
                    
                    // 대략적인 용량 (평균 50KB per audio)
                    const totalSize = (totalCount * 50 / 1024).toFixed(1);
                    
                    if (totalCount === 0) {
                        cacheInfo.innerHTML = '캐시 없음';
                        clearPageCacheBtn.disabled = true;
                        clearAllCacheBtn.disabled = true;
                    } else {
                        cacheInfo.innerHTML = `
                            📦 전체: ${totalCount}개 (~${totalSize}MB)<br>
                            📄 현재 페이지: ${pageCount}개
                        `;
                        clearPageCacheBtn.disabled = pageCount === 0;
                        clearAllCacheBtn.disabled = false;
                    }
                };
            };
        } catch {
            cacheInfo.innerHTML = '캐시 확인 불가';
        }
    }

    // Clear current page cache
    clearPageCacheBtn.addEventListener('click', async () => {
        const tab = await getCurrentTab();
        if (!tab?.id) return;
        
        chrome.tabs.sendMessage(tab.id, { action: 'clearPageCache' }, (response) => {
            if (response?.cleared !== undefined) {
                clearPageCacheBtn.textContent = `✅ ${response.cleared}개 삭제`;
                setTimeout(() => {
                    clearPageCacheBtn.textContent = '🗑️ 현재 페이지 캐시 삭제';
                    updateCacheInfo();
                }, 1500);
            }
        });
    });

    // Clear all cache
    clearAllCacheBtn.addEventListener('click', async () => {
        try {
            const request = indexedDB.open('FocusReaderExtension', 1);
            request.onsuccess = () => {
                const db = request.result;
                const tx = db.transaction('audioCache', 'readwrite');
                const store = tx.objectStore('audioCache');
                store.clear();
                
                tx.oncomplete = () => {
                    clearAllCacheBtn.textContent = '✅ 전체 삭제 완료';
                    setTimeout(() => {
                        clearAllCacheBtn.textContent = '🗑️ 전체 캐시 삭제';
                        updateCacheInfo();
                    }, 1500);
                };
            };
        } catch {}
    });

    checkServer();
    updateCacheInfo();
});
