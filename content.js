// Focus Reader - Chrome Extension Content Script
// 데스크톱 앱과 동일한 방식의 리딩 모드

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
    let openaiApiKey = '';
    let allPageAudioGenerated = false;
    let isGeneratingAudio = false;
    let selectedTTSEngine = null; // will be loaded from chrome.storage
    
    // 페이지 키 (캐시 분리용)
    const PAGE_KEY = location.hostname + location.pathname;
    
    const SERVER_URL = 'http://localhost:8000';
    
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
            position: fixed;
            bottom: 24px;
            right: 24px;
            width: 56px;
            height: 56px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 50%;
            border: none;
            color: white;
            font-size: 24px;
            cursor: pointer;
            box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
            z-index: 2147483646;
            transition: all 0.3s ease;
        }
        .fr-toggle:hover { transform: scale(1.1); }
        .fr-toggle.active {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
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
            margin-right: 45vw !important;
        }
        body.fr-active {
            margin-right: 0 !important;
        }

        .fr-panel {
            position: fixed;
            top: 0;
            right: 0;
            width: 45vw;
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
            chrome.storage.sync.get(['openai_api_key', 'tts_speed'], (result) => {
                // Also load TTS engine from local storage
                chrome.storage.local.get(['ttsEngine'], (localResult) => {
                    if (localResult.ttsEngine) selectedTTSEngine = localResult.ttsEngine;
                });
                if (result.openai_api_key) openaiApiKey = result.openai_api_key;
                if (result.tts_speed) ttsSpeed = result.tts_speed;
                resolve();
            });
        });
    }

    function createToggleButton() {
        if (floatingButton) return;
        floatingButton = document.createElement('button');
        floatingButton.className = 'fr-toggle';
        floatingButton.innerHTML = '📖';
        floatingButton.title = 'Focus Reader 리딩 모드';
        floatingButton.onclick = toggleReadingMode;
        document.body.appendChild(floatingButton);
    }

    // ========== 문단 탐지 ==========
    function detectParagraphs() {
        paragraphs = [];
        const candidates = document.querySelectorAll('p, article > div, section > div, [class*="content"] > div, [class*="paragraph"], [class*="text"]');
        
        candidates.forEach(el => {
            const text = el.textContent.trim();
            if (text.length < 100) return;
            if (el.querySelector('p, div, article, section')) return;
            if (paragraphs.some(p => p.element.contains(el) || el.contains(p.element))) return;
            
            const sents = splitSentences(text);
            paragraphs.push({
                element: el,
                text: text,
                sentences: sents
            });
        });
        
        console.log(`Focus Reader: ${paragraphs.length}개 문단 탐지됨`);
        return paragraphs;
    }

    function getTotalSentenceCount() {
        return paragraphs.reduce((sum, p) => sum + p.sentences.length, 0);
    }

    function getTotalCharCount() {
        return paragraphs.reduce((sum, p) => sum + p.text.length, 0);
    }

    // ========== 리딩 모드 ==========
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
            showToast('⚠️ 문단을 찾을 수 없습니다');
            isReadingMode = false;
            floatingButton.classList.remove('active');
            floatingButton.innerHTML = '📖';
            return;
        }

        paragraphs.forEach((p, i) => {
            p.element.classList.add('fr-paragraph');
            p.element.dataset.frIndex = i;
            p.element.addEventListener('click', handleParagraphClick);
        });

        currentParagraphIndex = 0;
        openPanel();
        loadParagraph(0);
        
        showToast(`📖 ${paragraphs.length}개 문단, ${getTotalSentenceCount()}개 문장! ←→: 문장, ↑↓: 문단`);
    }

    function disableReadingMode() {
        paragraphs.forEach(p => {
            p.element.classList.remove('fr-paragraph', 'current');
            p.element.removeEventListener('click', handleParagraphClick);
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

    // ========== 문단 로드 ==========
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
            info.textContent = `문단 ${currentParagraphIndex + 1} / ${paragraphs.length}`;
        }
    }

    // ========== 문장 ==========
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

    async function fetchChunksForSentences() {
        try {
            const response = await fetch(`${SERVER_URL}/chunk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sentences })
            });
            
            if (response.ok) {
                const data = await response.json();
                sentenceChunks = data.results.map(r => r.chunks || []);
            }
        } catch (e) {
            console.log('Focus Reader: spaCy 서버 연결 안됨');
        }
        
        renderSentences();
    }

    // ========== 패널 ==========
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
                <span class="fr-title">📖 Focus Reader</span>
                <button class="fr-close" id="fr-close">✕</button>
            </div>
            <div class="fr-para-nav">
                <button class="fr-para-nav-btn" id="fr-para-prev" title="이전 문단 (↑)">◀</button>
                <span class="fr-para-info" id="fr-para-info">문단 1 / 1</span>
                <button class="fr-para-nav-btn" id="fr-para-next" title="다음 문단 (↓)">▶</button>
            </div>
            <div class="fr-toolbar">
                <button class="fr-btn fr-btn-secondary" id="fr-audio-toggle">🔊 오디오 모드</button>
                <div class="fr-speed">
                    <span>속도</span>
                    <input type="range" id="fr-speed" min="0.5" max="2" step="0.1" value="${ttsSpeed}">
                    <span id="fr-speed-val">${ttsSpeed}x</span>
                </div>
            </div>
            <div class="fr-audio-status hidden" id="fr-audio-status">
                <span class="fr-dog">🐕</span>
                <div class="fr-audio-progress">
                    <div class="fr-audio-progress-bar" id="fr-audio-progress"></div>
                </div>
                <span class="fr-audio-text" id="fr-audio-text">준비 중...</span>
            </div>
            <div class="fr-sent-nav">
                <button class="fr-nav-btn" id="fr-sent-prev" title="이전 문장 (←)">←</button>
                <div class="fr-progress">
                    <div class="fr-progress-bar" id="fr-sent-progress"></div>
                </div>
                <span class="fr-nav-info" id="fr-sent-info">1 / 1</span>
                <button class="fr-nav-btn" id="fr-sent-next" title="다음 문장 (→)">→</button>
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

    // ========== 오디오 ==========
    async function toggleAudioMode() {
        // TTS 엔진 선택 안 했으면 먼저 선택
        if (!selectedTTSEngine) {
            const choice = await showTTSSelectModal();
            if (!choice) return;
            selectedTTSEngine = choice;
            chrome.storage.local.set({ ttsEngine: choice });
        }
        
        // OpenAI 선택했는데 API 키 없으면
        if (selectedTTSEngine === 'openai') {
            if (!openaiApiKey) await loadSettings();
            if (!openaiApiKey) {
                showToast('⚠️ 팝업에서 OpenAI API 키를 설정해주세요');
                return;
            }
        }
        
        // Kokoro 선택 시 서버 체크
        if (selectedTTSEngine === 'kokoro') {
            try {
                const res = await fetch('http://localhost:8001/health');
                if (!res.ok) throw new Error();
            } catch (e) {
                showToast('⚠️ Kokoro 서버가 실행되지 않았습니다. python server_kokoro.py 실행하세요');
                return;
            }
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
            btn.textContent = '🔊 오디오 ON';
            
            await generateAllPageAudio();
            playCurrentSentence();
        } else {
            audioModeEnabled = false;
            stopAudio();
            btn.classList.remove('active');
            btn.textContent = '🔊 오디오 모드';
            document.getElementById('fr-audio-status').classList.add('hidden');
        }
    }

    function showTTSSelectModal() {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'fr-modal';
            modal.innerHTML = `
                <div class="fr-modal-content" style="max-width: 360px;">
                    <div class="fr-modal-title">🎙️ TTS 엔진 선택</div>
                    <div style="margin-bottom: 16px;">
                        <div class="fr-tts-option" id="fr-tts-kokoro" style="padding: 14px; border: 2px solid #444; border-radius: 10px; cursor: pointer; margin-bottom: 10px; transition: all 0.2s;">
                            <div style="font-weight: 600; margin-bottom: 4px;">🆓 Kokoro TTS (로컬)</div>
                            <div style="font-size: 13px; color: #999;">무료 • 로컬에서 실행 • 빠름</div>
                            <div style="font-size: 12px; color: #10b981; margin-top: 4px;">💰 비용: $0</div>
                        </div>
                        <div class="fr-tts-option" id="fr-tts-openai" style="padding: 14px; border: 2px solid #444; border-radius: 10px; cursor: pointer; transition: all 0.2s;">
                            <div style="font-weight: 600; margin-bottom: 4px;">⭐ OpenAI TTS (클라우드)</div>
                            <div style="font-size: 13px; color: #999;">최고 품질 • API 키 필요</div>
                            <div style="font-size: 12px; color: #f59e0b; margin-top: 4px;">💰 $15 / 1M 글자</div>
                        </div>
                    </div>
                    <div class="fr-modal-buttons">
                        <button class="fr-modal-btn secondary" id="fr-modal-cancel">취소</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            const kokoroBtn = document.getElementById('fr-tts-kokoro');
            const openaiBtn = document.getElementById('fr-tts-openai');
            
            kokoroBtn.onmouseenter = () => kokoroBtn.style.borderColor = '#667eea';
            kokoroBtn.onmouseleave = () => kokoroBtn.style.borderColor = '#444';
            openaiBtn.onmouseenter = () => openaiBtn.style.borderColor = '#667eea';
            openaiBtn.onmouseleave = () => openaiBtn.style.borderColor = '#444';

            kokoroBtn.onclick = () => { modal.remove(); resolve('kokoro'); };
            openaiBtn.onclick = () => { modal.remove(); resolve('openai'); };
            document.getElementById('fr-modal-cancel').onclick = () => { modal.remove(); resolve(null); };
        });
    }

    function showCostModal(numSentences, totalChars, cost, krw, numParagraphs) {
        return new Promise((resolve) => {
            const isKokoro = selectedTTSEngine === 'kokoro';
            const costText = isKokoro 
                ? '<div class="fr-modal-cost" style="color: #10b981;">$0 (무료)</div>'
                : `<div class="fr-modal-cost">~$${cost} (약 ${krw}원)</div>`;
            const engineName = isKokoro ? 'Kokoro (무료)' : 'OpenAI';
            
            const modal = document.createElement('div');
            modal.className = 'fr-modal';
            modal.innerHTML = `
                <div class="fr-modal-content">
                    <div class="fr-modal-title">🔊 전체 페이지 오디오 생성 (${engineName})</div>
                    <div class="fr-modal-info">
                        📄 ${numParagraphs}개 문단 · 📝 ${numSentences}개 문장<br>
                        📊 ${totalChars.toLocaleString()}자
                    </div>
                    ${costText}
                    <div class="fr-modal-info" style="font-size:13px; color:#888;">
                        💾 캐시된 오디오는 무료 재사용<br>
                        한 번 생성하면 계속 사용 가능!
                    </div>
                    <div style="margin-top: 12px; text-align: center;">
                        <button class="fr-modal-btn" style="font-size: 11px; padding: 4px 8px;" id="fr-change-engine">🔄 엔진 변경</button>
                    </div>
                    <div class="fr-modal-buttons">
                        <button class="fr-modal-btn secondary" id="fr-modal-cancel">취소</button>
                        <button class="fr-modal-btn primary" id="fr-modal-confirm">🎵 전체 생성</button>
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
            document.getElementById('fr-change-engine').onclick = async () => {
                modal.remove();
                selectedTTSEngine = null;
                localStorage.removeItem('fr_tts_engine');
                toggleAudioMode(); // 다시 시작
                resolve(false);
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
        const isKokoro = selectedTTSEngine === 'kokoro';
        const engineLabel = isKokoro ? '(Kokoro)' : '(OpenAI)';
        
        for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
            const para = paragraphs[pIdx];
            
            for (let sIdx = 0; sIdx < para.sentences.length; sIdx++) {
                if (!audioModeEnabled) break;
                
                const sentence = para.sentences[sIdx];
                const cacheKey = hashText(sentence);
                
                const cachedData = await dbGet(cacheKey);
                if (cachedData && cachedData.audio) {
                    audioCache[cacheKey] = cachedData.audio;
                    cached++;
                } else {
                    textEl.textContent = `${engineLabel} 생성 중... ${totalProcessed + 1}/${totalSentences}`;
                    
                    try {
                        let audioData;
                        
                        if (isKokoro) {
                            // Kokoro TTS (로컬)
                            const response = await fetch('http://localhost:8001/tts', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    text: sentence,
                                    voice: 'am_echo',
                                    speed: 1.0
                                })
                            });
                            if (!response.ok) throw new Error('Kokoro 오류');
                            const blob = await response.blob();
                            const arrayBuffer = await blob.arrayBuffer();
                            audioData = new Uint8Array(arrayBuffer);
                        } else {
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
                                    voice: 'cedar',
                                    speed: 1.0
                                })
                            });

                            if (!response.ok) throw new Error('API 오류');

                            const blob = await response.blob();
                            const arrayBuffer = await blob.arrayBuffer();
                            audioData = new Uint8Array(arrayBuffer);
                        }
                        
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
        
        if (isKokoro) {
            textEl.textContent = `✅ 완료! ${generated}개 생성 (무료)${cached > 0 ? ` + ${cached}개 캐시` : ''}`;
        } else if (cached > 0) {
            const savedCost = (cached * 100 * 15 / 1000000).toFixed(4);
            textEl.textContent = `✅ 완료! ${cached}개 캐시 (~$${savedCost} 절약)`;
        } else {
            textEl.textContent = `✅ ${generated}개 생성 완료!`;
        }
        
        showToast('✅ 전체 페이지 오디오 생성 완료! 방향키로 이동하세요');
    }

    async function playCurrentSentence() {
        if (!audioModeEnabled) return;
        
        stopAudio();
        
        const sentence = sentences[currentSentenceIndex];
        const cacheKey = hashText(sentence);
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
        injectStyles();
        await initDB();
        await loadSettings();
        createToggleButton();
        console.log('Focus Reader Extension loaded');
    }

    init();
})();
