// ADHD Focus Reader - Chrome Extension Content Script
// OpenAI TTS only version for Chrome Web Store

(function() {
    'use strict';

    // ========== State ==========
    let isReadingMode = false;
    let paragraphs = [];
    let currentParagraphIndex = 0;
    let sentences = [];
    let sentenceChunks = [];
    let currentSentenceIndex = 0;
    
    let readingPanel = null;
    let floatingButton = null;
    
    // Audio state
    let audioCache = {};
    let dbCache = null;
    let ttsAudio = null;
    let isPlaying = false;
    let audioModeEnabled = false;
    let ttsSpeed = 1.4;
    let ttsVoice = 'coral';
    let openaiApiKey = '';
    let allPageAudioGenerated = false;
    let isGeneratingAudio = false;
    
    // i18n - Language support (default: English)
    let currentLang = 'en';
    
    const translations = {
        en: {
            readingMode: 'ADHD Focus Reader',
            noParagraphs: '⚠️ No paragraphs found',
            paragraphsFound: (p, s) => `📖 ${p} paragraphs, ${s} sentences! ←→: sentences, ↑↓: paragraphs`,
            paragraph: 'Paragraph',
            prevParagraph: 'Previous paragraph (↑)',
            nextParagraph: 'Next paragraph (↓)',
            audioMode: '🔊 Audio Mode',
            audioOn: '🔊 Audio ON',
            speed: 'Speed',
            prevSentence: 'Previous sentence (←)',
            nextSentence: 'Next sentence (→)',
            generateAllAudio: '🔊 Generate All Page Audio',
            paragraphsSentences: (p, s) => `📄 ${p} paragraphs · 📝 ${s} sentences`,
            cachedAudioFree: '💾 Cached audio is free to reuse',
            generateOnceUseForever: 'Generate once, use forever!',
            cancel: 'Cancel',
            generateAll: '🎵 Generate All',
            generating: (current, total) => `Generating... ${current}/${total}`,
            completed: (generated, cached) => `✅ Done! ${generated} generated${cached > 0 ? ` + ${cached} cached` : ''}`,
            generatedComplete: (count) => `✅ ${count} generated!`,
            allAudioComplete: '✅ All audio generated! Use arrow keys to navigate',
            setApiKey: '⚠️ Please set OpenAI API key in popup',
            detected: (n) => `ADHD Focus Reader: ${n} paragraphs detected`
        },
        ko: {
            readingMode: 'ADHD Focus Reader',
            noParagraphs: '⚠️ 문단을 찾을 수 없습니다',
            paragraphsFound: (p, s) => `📖 ${p}개 문단, ${s}개 문장! ←→: 문장, ↑↓: 문단`,
            paragraph: '문단',
            prevParagraph: '이전 문단 (↑)',
            nextParagraph: '다음 문단 (↓)',
            audioMode: '🔊 오디오 모드',
            audioOn: '🔊 오디오 ON',
            speed: '속도',
            prevSentence: '이전 문장 (←)',
            nextSentence: '다음 문장 (→)',
            generateAllAudio: '🔊 전체 페이지 오디오 생성',
            paragraphsSentences: (p, s) => `📄 ${p}개 문단 · 📝 ${s}개 문장`,
            cachedAudioFree: '💾 캐시된 오디오는 무료로 재사용',
            generateOnceUseForever: '한 번 생성하면 영원히 사용!',
            cancel: '취소',
            generateAll: '🎵 전체 생성',
            generating: (current, total) => `생성 중... ${current}/${total}`,
            completed: (generated, cached) => `✅ 완료! ${generated}개 생성${cached > 0 ? ` + ${cached}개 캐시` : ''}`,
            generatedComplete: (count) => `✅ ${count}개 생성 완료!`,
            allAudioComplete: '✅ 전체 페이지 오디오 생성 완료! 방향키로 이동하세요',
            setApiKey: '⚠️ 팝업에서 OpenAI API 키를 설정해주세요',
            detected: (n) => `ADHD Focus Reader: ${n}개 문단 탐지됨`
        }
    };
    
    function t(key, ...args) {
        const text = translations[currentLang]?.[key];
        if (typeof text === 'function') return text(...args);
        return text || key;
    }
    
    // Page key for cache separation
    const PAGE_KEY = location.hostname + location.pathname;
    
    const CHUNK_COLORS = [
        "#FFE4B5", "#B0E0E6", "#DDA0DD", "#98FB98",
        "#FFB6C1", "#87CEEB", "#F0E68C", "#E6E6FA"
    ];

    // ========== IndexedDB ==========
    async function initDB() {
        return new Promise((resolve) => {
            const request = indexedDB.open('FocusReaderExtension', 1);
            request.onerror = () => resolve(null);
            request.onsuccess = () => {
                dbCache = request.result;
                resolve(dbCache);
            };
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('audioCache')) {
                    db.createObjectStore('audioCache', { keyPath: 'id' });
                }
            };
        });
    }

    async function dbGet(key) {
        if (!dbCache) return null;
        return new Promise((resolve) => {
            try {
                const tx = dbCache.transaction('audioCache', 'readonly');
                const store = tx.objectStore('audioCache');
                const request = store.get(key);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => resolve(null);
            } catch (e) { resolve(null); }
        });
    }

    async function dbPut(key, data) {
        if (!dbCache) return;
        return new Promise((resolve) => {
            try {
                const tx = dbCache.transaction('audioCache', 'readwrite');
                const store = tx.objectStore('audioCache');
                store.put({ id: key, pageKey: PAGE_KEY, ...data });
                tx.oncomplete = () => resolve();
            } catch (e) { resolve(); }
        });
    }

    function hashText(text) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) - hash) + text.charCodeAt(i);
            hash = hash & hash;
        }
        // 페이지 키를 포함하여 페이지별로 분리
        return PAGE_KEY + '_' + Math.abs(hash).toString(36);
    }

    // ========== Styles ==========
    const styles = `
        .fr-toggle {
            position: fixed !important;
            bottom: 24px !important;
            right: 24px !important;
            width: 56px !important;
            height: 56px !important;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
            border-radius: 50% !important;
            border: none !important;
            color: white !important;
            font-size: 24px !important;
            cursor: pointer !important;
            box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4) !important;
            z-index: 2147483646 !important;
            transition: all 0.3s ease !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            opacity: 1 !important;
            visibility: visible !important;
        }
        .fr-toggle:hover { transform: scale(1.1) !important; }
        .fr-toggle.active {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
        }

        .fr-paragraph {
            transition: all 0.2s;
            cursor: pointer !important;
        }
        .fr-paragraph:hover {
            background: rgba(102, 126, 234, 0.05) !important;
        }
        .fr-paragraph.current {
            background: rgba(102, 126, 234, 0.1) !important;
            border-left: 4px solid #667eea !important;
            padding-left: 12px !important;
        }

        html.fr-active {
            margin-right: 500px !important;
        }
        @media (max-width: 1250px) {
            html.fr-active {
                margin-right: 40vw !important;
            }
        }
        body.fr-active {
            margin-right: 0 !important;
        }

        /* 패널 - 오른쪽 사이드바 */
        .fr-panel {
            position: fixed;
            top: 0;
            right: 0;
            width: 500px;
            max-width: 40vw;
            height: 100vh;
            background: #FAFBFC;
            box-shadow: -4px 0 30px rgba(0, 0, 0, 0.12);
            z-index: 2147483647;
            display: flex;
            flex-direction: column;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        }
        .fr-panel.open { transform: translateX(0); }

        .fr-header {
            padding: 16px 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
        }
        .fr-title { font-size: 16px; font-weight: 600; }
        .fr-close {
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 18px;
        }

        .fr-para-nav {
            padding: 12px 20px;
            background: #667eea;
            color: white;
            display: flex;
            align-items: center;
            gap: 12px;
            flex-shrink: 0;
        }
        .fr-para-nav-btn {
            width: 36px;
            height: 36px;
            border: 2px solid rgba(255,255,255,0.3);
            border-radius: 8px;
            background: rgba(255,255,255,0.1);
            color: white;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.2s;
        }
        .fr-para-nav-btn:hover {
            background: rgba(255,255,255,0.2);
            border-color: white;
        }
        .fr-para-info {
            flex: 1;
            text-align: center;
            font-size: 14px;
        }

        .fr-toolbar {
            padding: 12px 20px;
            background: #f0f0f5;
            border-bottom: 1px solid #e0e0e8;
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
            flex-shrink: 0;
        }
        .fr-btn {
            padding: 8px 14px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .fr-btn-primary { background: #667eea; color: white; }
        .fr-btn-primary:hover { background: #5a6fd6; }
        .fr-btn-secondary {
            background: white;
            color: #555;
            border: 1px solid #ddd;
        }
        .fr-btn-secondary:hover { background: #f5f5f5; }
        .fr-btn-secondary.active {
            background: #10b981;
            color: white;
            border-color: #10b981;
        }
        .fr-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .fr-speed {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: #666;
            margin-left: auto;
        }
        .fr-speed input { width: 60px; }

        .fr-sent-nav {
            padding: 10px 20px;
            background: white;
            border-bottom: 1px solid #eee;
            display: flex;
            align-items: center;
            gap: 10px;
            flex-shrink: 0;
        }
        .fr-nav-btn {
            width: 32px;
            height: 32px;
            border: 1px solid #ddd;
            border-radius: 6px;
            background: white;
            cursor: pointer;
            font-size: 14px;
        }
        .fr-nav-btn:hover {
            background: #f5f5f5;
            border-color: #667eea;
        }
        .fr-progress {
            flex: 1;
            height: 4px;
            background: #eee;
            border-radius: 2px;
            overflow: hidden;
        }
        .fr-progress-bar {
            height: 100%;
            background: #667eea;
            transition: width 0.3s;
        }
        .fr-nav-info {
            min-width: 60px;
            text-align: center;
            font-size: 13px;
            color: #888;
        }

        .fr-audio-status {
            padding: 10px 20px;
            background: #f0f9ff;
            border-bottom: 1px solid #e0f2fe;
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 13px;
            flex-shrink: 0;
        }
        .fr-audio-status.hidden { display: none; }
        .fr-audio-progress {
            flex: 1;
            height: 6px;
            background: #e0e0e0;
            border-radius: 3px;
            overflow: hidden;
        }
        .fr-audio-progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            transition: width 0.3s;
        }
        .fr-audio-text {
            min-width: 140px;
            text-align: right;
            color: #666;
        }
        .fr-dog {
            font-size: 20px;
            animation: dogBounce 0.5s infinite;
        }
        @keyframes dogBounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-3px); }
        }

        .fr-content {
            flex: 1;
            overflow-y: auto;
            padding: 24px;
        }

        .fr-sentence {
            padding: 8px 12px;
            margin: 4px 0;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
            line-height: 1.9;
            font-size: 17px;
            opacity: 0.4;
            display: block;
        }
        .fr-sentence:hover {
            opacity: 0.7;
            background: rgba(102, 126, 234, 0.05);
        }
        .fr-sentence.active {
            opacity: 1;
            background: rgba(102, 126, 234, 0.08);
            border-left: 3px solid #667eea;
        }
        .fr-sentence.playing {
            background: rgba(16, 185, 129, 0.1);
            border-left-color: #10b981;
        }

        .fr-bold { font-weight: 700; }
        .fr-light { font-weight: 400; color: #666; }
        .fr-chunk {
            padding: 2px 4px;
            border-radius: 4px;
            margin: 0 1px;
        }

        .fr-toast {
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: #333;
            color: white;
            padding: 14px 24px;
            border-radius: 10px;
            font-size: 14px;
            z-index: 2147483648;
            animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateX(-50%) translateY(10px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }

        .fr-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2147483648;
        }
        .fr-modal-content {
            background: white;
            padding: 28px;
            border-radius: 16px;
            max-width: 420px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .fr-modal-title {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 16px;
        }
        .fr-modal-info {
            font-size: 14px;
            color: #666;
            line-height: 1.6;
            margin-bottom: 16px;
        }
        .fr-modal-cost {
            font-size: 28px;
            font-weight: 700;
            color: #667eea;
            margin: 20px 0;
        }
        .fr-modal-buttons {
            display: flex;
            gap: 12px;
            justify-content: center;
            margin-top: 24px;
        }
        .fr-modal-btn {
            padding: 14px 28px;
            border-radius: 10px;
            border: none;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        .fr-modal-btn.primary { background: #667eea; color: white; }
        .fr-modal-btn.primary:hover { background: #5a6fd6; }
        .fr-modal-btn.secondary { background: #f0f0f0; color: #333; }
    `;

    function injectStyles() {
        if (document.getElementById('fr-styles')) return;
        const style = document.createElement('style');
        style.id = 'fr-styles';
        style.textContent = styles;
        document.head.appendChild(style);
    }

    async function loadSettings() {
        return new Promise((resolve) => {
            // Load TTS speed from sync storage
            chrome.storage.sync.get(['tts_speed'], (syncResult) => {
                console.log('ADHD Focus Reader: Loaded sync settings:', syncResult);
                if (syncResult.tts_speed) ttsSpeed = syncResult.tts_speed;
                
                // Load API key and TTS engine from local storage
                chrome.storage.local.get(['openaiApiKey', 'ttsEngine', 'ttsVoice'], (localResult) => {
                    console.log('ADHD Focus Reader: Loaded local settings:', localResult);
                    if (localResult.openaiApiKey) openaiApiKey = localResult.openaiApiKey;
                    if (localResult.ttsEngine) selectedTTSEngine = localResult.ttsEngine;
                    if (localResult.ttsVoice) ttsVoice = localResult.ttsVoice;
                    resolve();
                });
            });
        });
    }

    function createToggleButton() {
        if (floatingButton) return;
        if (document.getElementById('fr-toggle-btn')) return; // 이미 존재하면 스킵
        
        floatingButton = document.createElement('button');
        floatingButton.className = 'fr-toggle';
        floatingButton.id = 'fr-toggle-btn';
        floatingButton.innerHTML = '📖';
        floatingButton.title = t('readingMode');
        floatingButton.onclick = toggleReadingMode;
        
        // body 대신 documentElement에 추가 (더 안정적)
        (document.body || document.documentElement).appendChild(floatingButton);
        console.log('ADHD Focus Reader: Toggle button created');
    }

    // ========== Paragraph Detection ==========
    function detectParagraphs() {
        paragraphs = [];
        
        // 다양한 플랫폼 지원 셀렉터
        const selectors = [
            // 기본
            'p',
            'article > div',
            'section > div',
            
            // 일반적인 클래스
            '[class*="content"] > div',
            '[class*="paragraph"]',
            '[class*="text"]',
            '[class*="block"]',
            
            // 인용문, 리스트
            'blockquote',
            'li',
            
            // 인덴트된 요소
            '[style*="margin-left"]',
            '[style*="padding-left"]',
            
            // Streamlit
            '[class*="stMarkdown"]',
            '[class*="stText"]',
            '[class*="element-container"] p',
            '[class*="element-container"] div',
            '[data-testid="stMarkdownContainer"]',
            '[data-testid="stMarkdownContainer"] p',
            '[data-testid="stMarkdownContainer"] div',
            
            // Notion
            '[class*="notion-text"]',
            '[class*="notion-paragraph"]',
            '[class*="notion-quote"]',
            '[class*="notion-callout"]',
            
            // Medium / Substack
            '[class*="graf"]',
            '[class*="post-content"] > *',
            
            // GitHub
            '.markdown-body > p',
            '.markdown-body > blockquote',
            '.markdown-body > ul > li',
            '.markdown-body > ol > li',
            
            // 기타 CMS
            '[class*="entry-content"] > *',
            '[class*="article-body"] > *',
            '[class*="post-body"] > *',
            'main p',
            'main div > p'
        ];
        
        const candidates = document.querySelectorAll(selectors.join(', '));
        
        candidates.forEach(el => {
            const text = el.textContent.trim();
            if (text.length < 50) return; // 50자 이상
            
            // 내부에 이미 처리된 p가 있으면 스킵 (단, 짧은 것들만)
            const innerPs = el.querySelectorAll('p');
            const hasSubstantialInnerP = Array.from(innerPs).some(p => p.textContent.trim().length > 50);
            if (hasSubstantialInnerP) return;
            
            // div 내부에 다른 블록이 있으면 스킵
            if (el.tagName === 'DIV' && el.querySelector('div, article, section')) return;
            
            // 이미 포함된 요소인지 확인
            if (paragraphs.some(p => p.element.contains(el) || el.contains(p.element))) return;
            
            // 숨겨진 요소 스킵
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return;
            
            const sents = splitSentences(text);
            if (sents.length === 0) return;
            
            paragraphs.push({
                element: el,
                text: text,
                sentences: sents
            });
        });
        
        console.log(t('detected', paragraphs.length));
        return paragraphs;
    }

    function getTotalSentenceCount() {
        return paragraphs.reduce((sum, p) => sum + p.sentences.length, 0);
    }

    function getTotalCharCount() {
        return paragraphs.reduce((sum, p) => sum + p.text.length, 0);
    }

    // ========== Reading Mode ==========
    function toggleReadingMode() {
        isReadingMode = !isReadingMode;
        floatingButton.classList.toggle('active', isReadingMode);
        floatingButton.innerHTML = isReadingMode ? '✓' : '📖';

        if (isReadingMode) {
            enableReadingMode();
        } else {
            disableReadingMode();
        }
    }

    function enableReadingMode() {
        detectParagraphs();
        
        if (paragraphs.length === 0) {
            showToast(t('noParagraphs'));
            isReadingMode = false;
            floatingButton.classList.remove('active');
            floatingButton.innerHTML = '📖';
            return;
        }

        paragraphs.forEach((p, i) => {
            p.element.classList.add('fr-paragraph');
            p.element.dataset.frIndex = i;
            p.element.addEventListener('dblclick', handleParagraphClick);
        });

        currentParagraphIndex = 0;
        openPanel();
        loadParagraph(0);
        
        showToast(t('paragraphsFound', paragraphs.length, getTotalSentenceCount()));
    }

    function disableReadingMode() {
        paragraphs.forEach(p => {
            p.element.classList.remove('fr-paragraph', 'current');
            p.element.removeEventListener('dblclick', handleParagraphClick);
            delete p.element.dataset.frIndex;
        });
        paragraphs = [];
        stopAudio();
        closePanel();
    }

    function handleParagraphClick(e) {
        e.preventDefault();
        e.stopPropagation();
        const index = parseInt(e.currentTarget.dataset.frIndex);
        if (!isNaN(index)) {
            loadParagraph(index);
        }
    }

    // ========== Load Paragraph ==========
    function loadParagraph(index) {
        if (index < 0 || index >= paragraphs.length) return;
        
        paragraphs.forEach(p => p.element.classList.remove('current'));
        
        currentParagraphIndex = index;
        const para = paragraphs[index];
        para.element.classList.add('current');
        
        scrollToCurrentParagraph();
        
        sentences = para.sentences;
        sentenceChunks = new Array(sentences.length).fill(null);
        currentSentenceIndex = 0;
        
        updateParagraphNav();
        fetchChunksForSentences();
    }

    function scrollToCurrentParagraph() {
        const para = paragraphs[currentParagraphIndex];
        if (!para) return;
        para.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function updateParagraphNav() {
        const info = document.getElementById('fr-para-info');
        if (info) {
            info.textContent = `${t('paragraph')} ${currentParagraphIndex + 1} / ${paragraphs.length}`;
        }
    }

    // ========== Sentences ==========
    function splitSentences(text) {
        const abbrs = ['et al', 'i\\.e', 'e\\.g', 'Fig', 'Dr', 'Mr', 'Mrs', 'Prof', 'vs', 'etc', 'al'];
        let processed = text;
        const placeholders = [];
        
        abbrs.forEach((abbr, i) => {
            const regex = new RegExp(`\\b(${abbr})\\.`, 'gi');
            processed = processed.replace(regex, (m) => {
                const ph = `__ABBR${i}__`;
                placeholders.push({ ph, orig: m });
                return ph;
            });
        });

        processed = processed.replace(/(\d+)\.(\d+)/g, (m) => {
            const ph = `__DEC${placeholders.length}__`;
            placeholders.push({ ph, orig: m });
            return ph;
        });

        let result = processed.split(/(?<=[.!?])\s+/);
        
        return result.map(s => {
            let restored = s;
            placeholders.forEach(p => {
                restored = restored.replace(p.ph, p.orig);
            });
            return restored.trim();
        }).filter(s => s.length > 0);
    }

    // ========== Chunking with Compromise.js ==========
    function chunkSentenceWithCompromise(sentence) {
        if (typeof nlp === 'undefined') {
            return null; // Compromise not loaded
        }
        
        try {
            const doc = nlp(sentence);
            const chunks = [];
            
            // 명사구 (Noun Phrases)
            doc.nouns().forEach(n => {
                chunks.push({ text: n.text(), type: 'NP' });
            });
            
            // 동사구 (Verb Phrases)  
            doc.verbs().forEach(v => {
                chunks.push({ text: v.text(), type: 'VP' });
            });
            
            // 전치사구, 형용사 등 나머지
            doc.adjectives().forEach(a => {
                chunks.push({ text: a.text(), type: 'ADJ' });
            });
            
            doc.adverbs().forEach(a => {
                chunks.push({ text: a.text(), type: 'ADV' });
            });
            
            // 청크가 없으면 전체 문장을 하나의 청크로
            if (chunks.length === 0) {
                return null;
            }
            
            // 문장 순서대로 정렬 (원본 위치 기준)
            const orderedChunks = [];
            let remaining = sentence;
            const usedTexts = new Set();
            
            // 단어 단위로 분석하여 청크 재구성
            const words = sentence.split(/\s+/);
            let currentChunk = [];
            let currentType = null;
            
            for (const word of words) {
                // 이 단어가 어떤 청크에 속하는지 찾기
                let foundType = null;
                for (const chunk of chunks) {
                    if (chunk.text.includes(word) && !usedTexts.has(word)) {
                        foundType = chunk.type;
                        break;
                    }
                }
                
                if (foundType === currentType || currentType === null) {
                    currentChunk.push(word);
                    currentType = foundType || 'OTHER';
                } else {
                    if (currentChunk.length > 0) {
                        orderedChunks.push({ 
                            text: currentChunk.join(' '), 
                            type: currentType 
                        });
                    }
                    currentChunk = [word];
                    currentType = foundType || 'OTHER';
                }
                usedTexts.add(word);
            }
            
            // 마지막 청크 추가
            if (currentChunk.length > 0) {
                orderedChunks.push({ 
                    text: currentChunk.join(' '), 
                    type: currentType 
                });
            }
            
            return orderedChunks.length > 0 ? orderedChunks : null;
        } catch (e) {
            console.log('Compromise chunking error:', e);
            return null;
        }
    }

    function fetchChunksForSentences() {
        // Compromise.js로 로컬에서 청킹
        sentenceChunks = sentences.map(sent => chunkSentenceWithCompromise(sent));
        renderSentences();
    }

    // ========== Panel ==========
    function openPanel() {
        if (readingPanel) {
            readingPanel.classList.add('open');
            document.documentElement.classList.add('fr-active');
            document.body.classList.add('fr-active');
            return;
        }

        readingPanel = document.createElement('div');
        readingPanel.className = 'fr-panel open';
        readingPanel.innerHTML = `
            <div class="fr-header">
                <span class="fr-title">🐶 ADHD Focus Reader</span>
                <button class="fr-close" id="fr-close">✕</button>
            </div>
            <div class="fr-para-nav">
                <button class="fr-para-nav-btn" id="fr-para-prev" title="${t('prevParagraph')}">◀</button>
                <span class="fr-para-info" id="fr-para-info">${t('paragraph')} 1 / 1</span>
                <button class="fr-para-nav-btn" id="fr-para-next" title="${t('nextParagraph')}">▶</button>
            </div>
            <div class="fr-toolbar">
                <button class="fr-btn fr-btn-secondary" id="fr-audio-toggle">${t('audioMode')}</button>
                <div class="fr-speed">
                    <span>${t('speed')}</span>
                    <input type="range" id="fr-speed" min="0.5" max="2" step="0.1" value="${ttsSpeed}">
                    <span id="fr-speed-val">${ttsSpeed}x</span>
                </div>
            </div>
            <div class="fr-audio-status hidden" id="fr-audio-status">
                <span class="fr-dog">🐕</span>
                <div class="fr-audio-progress">
                    <div class="fr-audio-progress-bar" id="fr-audio-progress"></div>
                </div>
                <span class="fr-audio-text" id="fr-audio-text">Ready...</span>
            </div>
            <div class="fr-sent-nav">
                <button class="fr-nav-btn" id="fr-sent-prev" title="${t('prevSentence')}">←</button>
                <div class="fr-progress">
                    <div class="fr-progress-bar" id="fr-sent-progress"></div>
                </div>
                <span class="fr-nav-info" id="fr-sent-info">1 / 1</span>
                <button class="fr-nav-btn" id="fr-sent-next" title="${t('nextSentence')}">→</button>
            </div>
            <div class="fr-content" id="fr-content"></div>
        `;

        document.body.appendChild(readingPanel);
        document.documentElement.classList.add('fr-active');
        document.body.classList.add('fr-active');
        setupPanelEvents();
    }

    function closePanel() {
        stopAudio();
        audioModeEnabled = false;
        if (readingPanel) {
            readingPanel.classList.remove('open');
            document.documentElement.classList.remove('fr-active');
            document.body.classList.remove('fr-active');
        }
    }

    function setupPanelEvents() {
        document.getElementById('fr-close').onclick = () => toggleReadingMode();
        document.getElementById('fr-para-prev').onclick = () => navigateParagraph(-1);
        document.getElementById('fr-para-next').onclick = () => navigateParagraph(1);
        document.getElementById('fr-sent-prev').onclick = () => navigateSentence(-1);
        document.getElementById('fr-sent-next').onclick = () => navigateSentence(1);
        document.getElementById('fr-audio-toggle').onclick = toggleAudioMode;
        
        document.getElementById('fr-speed').oninput = (e) => {
            ttsSpeed = parseFloat(e.target.value);
            document.getElementById('fr-speed-val').textContent = ttsSpeed + 'x';
            if (ttsAudio) ttsAudio.playbackRate = ttsSpeed;
            chrome.storage.sync.set({ tts_speed: ttsSpeed });
        };
    }

    function navigateParagraph(delta) {
        const newIndex = currentParagraphIndex + delta;
        if (newIndex >= 0 && newIndex < paragraphs.length) {
            stopAudio();
            loadParagraph(newIndex);
            if (audioModeEnabled) {
                playCurrentSentence();
            }
        }
    }

    function navigateSentence(delta) {
        stopAudio();
        
        const newIndex = currentSentenceIndex + delta;
        
        if (newIndex < 0) {
            if (currentParagraphIndex > 0) {
                loadParagraph(currentParagraphIndex - 1);
                setTimeout(() => {
                    currentSentenceIndex = sentences.length - 1;
                    updateActiveSentence();
                    if (audioModeEnabled) playCurrentSentence();
                }, 100);
            }
        } else if (newIndex >= sentences.length) {
            if (currentParagraphIndex < paragraphs.length - 1) {
                loadParagraph(currentParagraphIndex + 1);
                setTimeout(() => {
                    if (audioModeEnabled) playCurrentSentence();
                }, 100);
            }
        } else {
            currentSentenceIndex = newIndex;
            updateActiveSentence();
            if (audioModeEnabled) playCurrentSentence();
        }
    }

    // ========== 렌더링 ==========
    function renderSentences() {
        const container = document.getElementById('fr-content');
        if (!container) return;

        container.innerHTML = sentences.map((sent, i) => {
            const chunks = sentenceChunks[i];
            const formatted = formatSentence(sent, chunks);
            const isActive = i === currentSentenceIndex;
            return `<div class="fr-sentence ${isActive ? 'active' : ''}" data-idx="${i}">${formatted}</div>`;
        }).join('');

        container.querySelectorAll('.fr-sentence').forEach(el => {
            el.onclick = () => {
                stopAudio();
                currentSentenceIndex = parseInt(el.dataset.idx);
                updateActiveSentence();
                if (audioModeEnabled) playCurrentSentence();
            };
        });

        updateSentenceNav();
        scrollToActiveSentence();
    }

    function formatSentence(text, chunks) {
        if (chunks && chunks.length > 0) {
            return chunks.map((chunk, i) => {
                const color = CHUNK_COLORS[i % CHUNK_COLORS.length];
                const bionic = toBionic(chunk.text);
                return `<span class="fr-chunk" style="background:${color}">${bionic}</span>`;
            }).join(' ');
        }
        return toBionic(text);
    }

    function toBionic(text) {
        return text.replace(/\b([A-Za-z]+)\b/g, (match) => {
            const mid = Math.ceil(match.length * 0.4);
            return `<span class="fr-bold">${match.slice(0, mid)}</span><span class="fr-light">${match.slice(mid)}</span>`;
        });
    }

    function updateActiveSentence() {
        const container = document.getElementById('fr-content');
        if (!container) return;

        container.querySelectorAll('.fr-sentence').forEach((el, i) => {
            el.classList.toggle('active', i === currentSentenceIndex);
            el.classList.toggle('playing', i === currentSentenceIndex && isPlaying);
        });

        updateSentenceNav();
        scrollToActiveSentence();
    }

    function updateSentenceNav() {
        const info = document.getElementById('fr-sent-info');
        const progress = document.getElementById('fr-sent-progress');
        if (info) info.textContent = `${currentSentenceIndex + 1} / ${sentences.length}`;
        if (progress) progress.style.width = `${((currentSentenceIndex + 1) / sentences.length) * 100}%`;
    }

    function scrollToActiveSentence() {
        const active = document.querySelector('.fr-sentence.active');
        if (active) active.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // ========== Audio ==========
    async function toggleAudioMode() {
        // Check OpenAI API key first
        if (!openaiApiKey) await loadSettings();
        
        if (!openaiApiKey) {
            // Show API key input modal
            const apiKey = await showApiKeyInputModal();
            if (!apiKey) return;
            openaiApiKey = apiKey;
            chrome.storage.local.set({ openaiApiKey: apiKey });
        }

        const btn = document.getElementById('fr-audio-toggle');
        
        if (!audioModeEnabled) {
            const totalSentences = getTotalSentenceCount();
            const totalChars = getTotalCharCount();
            const cost = (totalChars * 15 / 1000000).toFixed(4);
            const krw = Math.round(cost * 1400);
            
            const confirmed = await showCostModal(totalSentences, totalChars, cost, krw, paragraphs.length);
            if (!confirmed) return;

            audioModeEnabled = true;
            btn.classList.add('active');
            btn.textContent = t('audioOn');
            
            await generateAllPageAudio();
            playCurrentSentence();
        } else {
            audioModeEnabled = false;
            stopAudio();
            btn.classList.remove('active');
            btn.textContent = t('audioMode');
            document.getElementById('fr-audio-status').classList.add('hidden');
        }
    }

    function showApiKeyInputModal() {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'fr-modal';
            modal.innerHTML = `
                <div class="fr-modal-content" style="max-width: 400px;">
                    <div class="fr-modal-title">🔑 OpenAI API Key Required</div>
                    <div class="fr-modal-info">
                        Audio mode requires an OpenAI API key.<br>
                        Get your key at <a href="https://platform.openai.com/api-keys" target="_blank" style="color:#58a6ff;">platform.openai.com/api-keys</a>
                    </div>
                    <input type="password" id="fr-api-key-input" placeholder="sk-..." style="
                        width: 100%;
                        padding: 12px;
                        border: 2px solid #ddd;
                        border-radius: 8px;
                        font-size: 14px;
                        margin: 16px 0;
                        box-sizing: border-box;
                    ">
                    <div style="font-size: 12px; color: #888; margin-bottom: 16px;">
                        💾 Your key is stored locally and never sent to any server except OpenAI.
                    </div>
                    <div class="fr-modal-buttons">
                        <button class="fr-modal-btn secondary" id="fr-modal-cancel">${t('cancel')}</button>
                        <button class="fr-modal-btn primary" id="fr-modal-confirm">💾 Save & Continue</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            const input = document.getElementById('fr-api-key-input');
            input.focus();

            document.getElementById('fr-modal-cancel').onclick = () => {
                modal.remove();
                resolve(null);
            };
            document.getElementById('fr-modal-confirm').onclick = () => {
                const key = input.value.trim();
                if (key && key.startsWith('sk-')) {
                    modal.remove();
                    resolve(key);
                } else {
                    input.style.borderColor = '#ef4444';
                    input.placeholder = 'Invalid key - must start with sk-';
                }
            };
            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    document.getElementById('fr-modal-confirm').click();
                }
            };
        });
    }

    function showCostModal(numSentences, totalChars, cost, krw, numParagraphs) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'fr-modal';
            modal.innerHTML = `
                <div class="fr-modal-content">
                    <div class="fr-modal-title">${t('generateAllAudio')}</div>
                    <div class="fr-modal-info">
                        ${t('paragraphsSentences', numParagraphs, numSentences)}<br>
                        📊 ${totalChars.toLocaleString()} characters
                    </div>
                    <div class="fr-modal-cost" style="color: #f59e0b;">
                        ⚠️ ~$${cost} (~${krw}₩)
                    </div>
                    <div class="fr-modal-info" style="font-size:13px; color:#888;">
                        ${t('cachedAudioFree')}<br>
                        ${t('generateOnceUseForever')}
                    </div>
                    <div class="fr-modal-buttons">
                        <button class="fr-modal-btn secondary" id="fr-modal-cancel">${t('cancel')}</button>
                        <button class="fr-modal-btn primary" id="fr-modal-confirm">${t('generateAll')}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            document.getElementById('fr-modal-cancel').onclick = () => {
                modal.remove();
                resolve(false);
            };
            document.getElementById('fr-modal-confirm').onclick = () => {
                modal.remove();
                resolve(true);
            };
        });
    }

    async function generateAllPageAudio() {
        if (isGeneratingAudio) return;
        isGeneratingAudio = true;
        
        const statusEl = document.getElementById('fr-audio-status');
        const progressEl = document.getElementById('fr-audio-progress');
        const textEl = document.getElementById('fr-audio-text');
        
        statusEl.classList.remove('hidden');
        
        let generated = 0;
        let cached = 0;
        let totalProcessed = 0;
        const totalSentences = getTotalSentenceCount();
        
        for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
            const para = paragraphs[pIdx];
            
            for (let sIdx = 0; sIdx < para.sentences.length; sIdx++) {
                if (!audioModeEnabled) break;
                
                const sentence = para.sentences[sIdx];
                const cacheKey = hashText(sentence + '_' + ttsVoice);
                
                const cachedData = await dbGet(cacheKey);
                if (cachedData && cachedData.audio) {
                    audioCache[cacheKey] = cachedData.audio;
                    cached++;
                } else {
                    textEl.textContent = t('generating', totalProcessed + 1, totalSentences);
                    
                    try {
                        // OpenAI TTS
                        const response = await fetch('https://api.openai.com/v1/audio/speech', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${openaiApiKey}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                model: 'gpt-4o-mini-tts',
                                input: sentence,
                                voice: ttsVoice,
                                speed: 1.0
                            })
                        });

                        if (!response.ok) throw new Error('API error');

                        const blob = await response.blob();
                        const arrayBuffer = await blob.arrayBuffer();
                        const audioData = new Uint8Array(arrayBuffer);
                        
                        audioCache[cacheKey] = audioData;
                        await dbPut(cacheKey, { audio: audioData, timestamp: Date.now() });
                        generated++;
                    } catch (e) {
                        console.error('Audio generation failed:', e);
                    }
                }
                
                totalProcessed++;
                progressEl.style.width = `${(totalProcessed / totalSentences) * 100}%`;
            }
            
            if (!audioModeEnabled) break;
        }
        
        allPageAudioGenerated = true;
        isGeneratingAudio = false;
        
        if (cached > 0) {
            const savedCost = (cached * 100 * 15 / 1000000).toFixed(4);
            textEl.textContent = t('completed', generated, cached) + ` (~$${savedCost} saved)`;
        } else {
            textEl.textContent = t('generatedComplete', generated);
        }
        
        showToast(t('allAudioComplete'));
    }

    async function playCurrentSentence() {
        if (!audioModeEnabled) return;
        
        stopAudio();
        
        const sentence = sentences[currentSentenceIndex];
        const cacheKey = hashText(sentence + '_' + ttsVoice);
        const audioData = audioCache[cacheKey];

        if (!audioData) {
            console.log('Audio not found for:', sentence.substring(0, 30));
            return;
        }

        try {
            const blob = new Blob([audioData], { type: 'audio/mpeg' });
            const url = URL.createObjectURL(blob);
            
            ttsAudio = new Audio(url);
            ttsAudio.playbackRate = ttsSpeed;
            isPlaying = true;
            updateActiveSentence();
            
            ttsAudio.onended = () => {
                URL.revokeObjectURL(url);
                isPlaying = false;
                updateActiveSentence();
            };

            await ttsAudio.play();
        } catch (e) {
            console.error('Playback error:', e);
            isPlaying = false;
        }
    }

    function stopAudio() {
        isPlaying = false;
        if (ttsAudio) {
            ttsAudio.pause();
            ttsAudio = null;
        }
    }

    function showToast(message) {
        const existing = document.querySelector('.fr-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'fr-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => toast.remove(), 3000);
    }

    // ========== 키보드 ==========
    document.addEventListener('keydown', (e) => {
        if (!isReadingMode || !readingPanel) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            navigateSentence(-1);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            navigateSentence(1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            navigateParagraph(-1);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            navigateParagraph(1);
        } else if (e.key === ' ') {
            e.preventDefault();
            if (audioModeEnabled) playCurrentSentence();
        } else if (e.key === 'Escape') {
            toggleReadingMode();
        }
    });

    // ========== 메시지 핸들러 (팝업에서 캐시 삭제 요청) ==========
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'TTS_ENGINE_CHANGED') {
            selectedTTSEngine = request.engine;
            console.log('TTS Engine changed to:', selectedTTSEngine);
            return;
        }
        if (request.type === 'TTS_VOICE_CHANGED') {
            ttsVoice = request.voice;
            audioCache = {}; // clear in-memory cache so new voice is used immediately
            console.log('TTS Voice changed to:', ttsVoice);
            return;
        }
        if (request.action === 'getPageKey') {
            sendResponse({ pageKey: PAGE_KEY });
        } else if (request.action === 'clearPageCache') {
            clearPageCache().then(count => {
                sendResponse({ cleared: count });
            });
            return true; // async response
        }
    });

    async function clearPageCache() {
        if (!dbCache) return 0;
        
        return new Promise((resolve) => {
            try {
                const tx = dbCache.transaction('audioCache', 'readwrite');
                const store = tx.objectStore('audioCache');
                const request = store.getAll();
                
                request.onsuccess = () => {
                    const all = request.result || [];
                    let count = 0;
                    
                    all.forEach(item => {
                        if (item.pageKey === PAGE_KEY) {
                            store.delete(item.id);
                            count++;
                        }
                    });
                    
                    tx.oncomplete = () => {
                        audioCache = {};
                        allPageAudioGenerated = false;
                        resolve(count);
                    };
                };
            } catch (e) {
                resolve(0);
            }
        });
    }

    // ========== Init ==========
    async function init() {
        // DOM이 준비될 때까지 대기
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => initAfterDOM());
        } else {
            initAfterDOM();
        }
    }
    
    async function initAfterDOM() {
        injectStyles();
        await initDB();
        await loadSettings();
        createToggleButton();
        console.log('ADHD Focus Reader Extension loaded');
    }

    init();
})();
