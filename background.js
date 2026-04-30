// Focus Reader - Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log('Focus Reader extension installed');
  
  // 기본 설정
  chrome.storage.sync.get(['tts_speed'], (result) => {
    if (!result.tts_speed) {
      chrome.storage.sync.set({ tts_speed: 1.7 });
    }
  });

  // 컨텍스트 메뉴 추가
  chrome.contextMenus.create({
    id: 'focus-reader-highlight',
    title: '📖 Focus Reader로 읽기',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'focus-reader-highlight') {
    chrome.tabs.sendMessage(tab.id, { action: 'highlight' });
  }
});

// 메시지 핸들러
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getApiKey') {
    chrome.storage.sync.get(['openai_api_key'], (result) => {
      sendResponse({ apiKey: result.openai_api_key });
    });
    return true;
  }
  
  // Proxy requests to localhost (bypass CORS)
  if (request.action === 'proxyFetch') {
    (async () => {
      try {
        const fetchOptions = {
          method: request.method || 'GET',
          headers: request.headers || {}
        };
        
        if (request.body) {
          fetchOptions.body = JSON.stringify(request.body);
        }
        
        const response = await fetch(request.url, fetchOptions);
        
        if (request.responseType === 'blob') {
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          sendResponse({ 
            ok: response.ok, 
            status: response.status,
            data: Array.from(uint8Array),
            isBlob: true
          });
        } else {
          const data = await response.json();
          sendResponse({ ok: response.ok, status: response.status, data });
        }
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }
});
