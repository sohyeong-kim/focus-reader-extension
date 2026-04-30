<div align="center">
  <img src="icons/icon128.png" width="128" height="128" alt="ADHD Focus Reader">

  # ADHD Focus Reader

  **Chrome Extension for ADHD-Friendly Web Reading**

  **[🇺🇸 English](#english) | [🇰🇷 한국어](#한국어)**

  ---

  [![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/thgud1624)

</div>

---

# English

## What is ADHD Focus Reader?

A Chrome extension that transforms any webpage into an **ADHD-friendly reading experience**:

- 🎨 **Color-coded phrase chunks** — sentences split into noun/verb/adjective groups via [Compromise.js](https://compromise.cool/) (fully local, no server needed)
- 👁️ **Bionic Reading** — first letters of words are **bolded** to guide your eyes
- 🎧 **OpenAI TTS** — listen sentence-by-sentence with IndexedDB caching (each sentence is generated only once)
- 🎯 **Focus Mode** — one paragraph at a time, no distractions

---

## Dependencies

**No install step required.** All dependencies are bundled in the repo.

| Dependency | Purpose | License |
|---|---|---|
| [Compromise.js](https://github.com/spencermountain/compromise) (`compromise.min.js`) | Client-side NLP phrase chunking — runs entirely in the browser | MIT |

**External service called at runtime:**

| Service | When | Cost |
|---|---|---|
| OpenAI TTS API (`gpt-4o-mini-tts`) | Audio mode only, per sentence (cached after first generation) | ~$0.015 / 1K characters |

---

## Installation

### Requirements

| Requirement | Notes |
|---|---|
| Chrome 114+ (or any Chromium browser) | Required |
| OpenAI API key | Required for audio mode only |

No Node.js, Python, Docker, or local server needed.

### Step 1 — Get the extension

```bash
git clone https://github.com/thgud1624/focus-reader-extension.git
```

Or download the ZIP from [Releases](https://github.com/thgud1624/focus-reader-extension/releases).

### Step 2 — Load in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `focus-reader-extension/` folder
5. The 🐶 icon appears in your toolbar

### Step 3 — Add your OpenAI API key

1. Click the extension icon in the toolbar
2. Paste your `sk-...` key into the **OpenAI API Key** field
3. Click **Save**

Get a key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys). Your key is stored in local Chrome storage only — never synced or sent anywhere except OpenAI.

---

## How to Use

1. Navigate to any webpage with text
2. Click the **📖** floating button (bottom-right corner) or press `Alt+R`
3. The reading panel opens on the right, highlighting the first paragraph
4. Navigate with the keyboard:

| Key | Action |
|---|---|
| `←` / `→` | Previous / next sentence |
| `↑` / `↓` | Previous / next paragraph |
| `Alt+R` | Toggle reading mode |

5. Click **🔊 Audio Mode** to generate and play TTS for the current paragraph
6. Double-click any paragraph on the page to jump to it in the reader

---

## File Structure

```
focus-reader-extension/
├── manifest.json        # Manifest V3
├── content.js           # Reading mode UI injected into pages
├── background.js        # Service worker
├── popup.html           # Extension popup
├── popup.js             # Popup logic (API key, cache management)
├── compromise.min.js    # Bundled NLP library for phrase chunking
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Troubleshooting

**Extension not working?**
- Reading mode only works on regular web pages, not `chrome://` pages
- Reload the page after installing the extension

**Audio not working?**
- Confirm your OpenAI API key is saved and starts with `sk-`
- Check the browser console (F12 → Console) for API error messages

**No paragraphs detected?**
- The extension requires at least 50 characters of text per element
- On heavy JavaScript pages, wait for the page to fully load before activating

---

## Privacy

- Your OpenAI API key is stored in `chrome.storage.local` (never synced)
- Audio data is only sent to `api.openai.com` — no other third-party services
- No analytics or tracking

---

## Support

If this extension is useful to you, consider buying me a coffee!

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/thgud1624)

---

## License

Proprietary — personal use only. See LICENSE file.

---
---

# 한국어

## ADHD Focus Reader란?

웹페이지를 **ADHD 친화적**으로 읽을 수 있게 해주는 크롬 확장프로그램:

- 🎨 **색상 청크** — [Compromise.js](https://compromise.cool/)로 문장을 명사구/동사구/형용사구로 분리 (완전 로컬, 서버 불필요)
- 👁️ **Bionic Reading** — 단어 앞글자를 **굵게** 해서 시선이 자연스럽게 따라감
- 🎧 **OpenAI TTS** — 문장별 음성 재생, IndexedDB 캐시로 한 번 생성 후 무료 재사용
- 🎯 **집중 모드** — 한 문단씩, 산만함 없이 읽기

---

## 의존성

**별도 설치 불필요.** 모든 의존성이 레포에 포함되어 있습니다.

| 의존성 | 용도 | 라이선스 |
|---|---|---|
| [Compromise.js](https://github.com/spencermountain/compromise) (`compromise.min.js`) | 브라우저 내 로컬 NLP 청킹 | MIT |

**런타임에 호출하는 외부 서비스:**

| 서비스 | 시점 | 비용 |
|---|---|---|
| OpenAI TTS API (`gpt-4o-mini-tts`) | 오디오 모드에서 문장별 호출 (캐시 후 재사용) | 약 $0.015 / 1천 자 |

---

## 설치 방법

### 필요 사항

| 항목 | 설명 |
|---|---|
| Chrome 114+ (또는 Chromium 계열 브라우저) | 필수 |
| OpenAI API 키 | 오디오 모드에서만 필요 |

Node.js, Python, Docker, 로컬 서버 없이 바로 실행됩니다.

### 1단계 — 확장프로그램 다운로드

```bash
git clone https://github.com/thgud1624/focus-reader-extension.git
```

또는 [Releases](https://github.com/thgud1624/focus-reader-extension/releases)에서 ZIP 다운로드.

### 2단계 — 크롬에 로드

1. `chrome://extensions/` 접속
2. 오른쪽 상단 **개발자 모드** 켜기
3. **"압축해제된 확장 프로그램을 로드합니다"** 클릭
4. `focus-reader-extension/` 폴더 선택
5. 툴바에 🐶 아이콘 등장

### 3단계 — OpenAI API 키 등록

1. 툴바의 확장프로그램 아이콘 클릭
2. **OpenAI API Key** 필드에 `sk-...` 키 입력
3. **Save** 클릭

키는 로컬 Chrome 저장소에만 저장되며 OpenAI 외 어디로도 전송되지 않습니다.
API 키는 [platform.openai.com/api-keys](https://platform.openai.com/api-keys)에서 발급받을 수 있습니다.

---

## 사용법

1. 아무 웹페이지나 열기
2. 화면 우측 하단 **📖** 버튼 클릭 또는 `Alt+R`
3. 우측 패널이 열리며 첫 번째 문단 하이라이트
4. 키보드로 이동:

| 키 | 동작 |
|---|---|
| `←` / `→` | 이전 / 다음 문장 |
| `↑` / `↓` | 이전 / 다음 문단 |
| `Alt+R` | 리딩 모드 토글 |

5. **🔊 오디오 모드** 클릭 → 현재 문단 TTS 생성 및 재생
6. 페이지의 문단을 **더블클릭**하면 해당 문단으로 바로 이동

---

## 문제 해결

**확장프로그램이 안 돼요?**
- `chrome://` 페이지에서는 동작 안 함, 일반 웹페이지에서 사용
- 설치 후 페이지를 새로고침하세요

**오디오가 안 돼요?**
- API 키가 `sk-`로 시작하는지 확인
- F12 → Console에서 API 에러 메시지 확인

**문단이 탐지 안 돼요?**
- 50자 이상의 텍스트가 있는 요소만 탐지됨
- JS 렌더링이 많은 페이지는 완전히 로딩된 후 활성화하세요

---

## 후원

도움이 됐다면 커피 한 잔 사주세요!

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/thgud1624)

---

## 라이선스

독점 라이선스 — 개인 사용만 허용. LICENSE 파일 참조.
