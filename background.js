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
});
