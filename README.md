<div align="center">
  <img src="icons/icon128.png" width="128" height="128" alt="Focus Reader Extension">
  
  # Focus Reader Extension 📚✨
  
  **Chrome Extension for ADHD-Friendly Web Reading**
  
  **[🇺🇸 English](#english) | [��🇷 한국어](#한국어)**

  ---
  
  [![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/thgud1624)
  
</div>

---

# English

## 🎯 What is Focus Reader?

A Chrome extension that transforms any webpage into an **ADHD-friendly reading experience**:

- 🎨 **Color-coded chunks** - Sentences split into meaningful phrases with alternating colors
- **👁️ Bionic Reading** - First letters of words are **bolded** to guide your eyes
- 🎧 **Text-to-Speech** - Listen to any paragraph with AI voices
- 🎯 **Focus Mode** - One paragraph at a time, no distractions

---

## ✨ Features

### 📖 Smart Reading
| Feature | Description |
|---------|-------------|
| **Chunk Highlighting** | Sentences are split into phrases with blue/orange colors |
| **Bionic Reading** | First few letters bolded for faster reading |
| **Paragraph Focus** | Click any paragraph to open focused reader |
| **Keyboard Navigation** | `←` `→` move between sentences, `↑` `↓` jump paragraphs |

### 🎧 Text-to-Speech
| Feature | Description |
|---------|-------------|
| **Kokoro TTS** | Free, local TTS via Docker (am_echo voice) |
| **OpenAI TTS** | Premium quality (requires API key) |
| **Browser TTS** | Built-in browser voices (free) |
| **Sentence Sync** | Highlights current sentence while playing |

### 🎨 Customization
| Feature | Description |
|---------|-------------|
| **TTS Engine Selection** | Choose between Kokoro/OpenAI/Browser |
| **Speed Control** | Adjust TTS playback speed |
| **Theme** | Clean, distraction-free UI |

---

## 🚀 Installation

### Step 1: Download Extension

```bash
git clone https://github.com/thgud1624/focus-reader-extension.git
```

Or download ZIP from [Releases](https://github.com/thgud1624/focus-reader-extension/releases)

### Step 2: Install in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **"Load unpacked"**
4. Select the `focus-reader-extension` folder
5. Done! You'll see the 📚 icon in your toolbar

<details>
<summary>📸 Screenshot Guide</summary>

1. **Open Extensions Page**
   - Type `chrome://extensions/` in address bar
   
2. **Enable Developer Mode**
   - Click toggle in top-right corner
   
3. **Load Extension**
   - Click "Load unpacked" button
   - Navigate to the extension folder
   - Click "Select"

</details>

### Step 3: Start Backend Services (For Kokoro TTS)

For free local TTS, you need Docker running:

```bash
# Clone main project
git clone https://github.com/thgud1624/focus-reader.git
cd focus-reader

# Start services
docker-compose up -d
```

This starts:
- **spaCy** (port 8000) - Sentence chunking
- **Kokoro TTS** (port 8001) - Free local TTS

> 💡 Without Docker, you can still use Browser TTS (free) or OpenAI TTS (paid)

---

## 🎮 How to Use

### Basic Usage

1. **Navigate to any webpage** with text content
2. **Click the Focus Reader icon** 📚 in toolbar (or right-click → "Focus Reader")
3. **Click any paragraph** you want to read
4. **Use keyboard** to navigate:
   - `←` `→` Previous/Next sentence
   - `↑` `↓` Previous/Next paragraph
   - `Space` Play/Pause audio
   - `Esc` Close reader

### TTS Options

Click the **speaker icon** 🔊 to generate audio:
- **🆓 Kokoro** - Free local TTS (requires Docker)
- **⭐ OpenAI** - Premium quality (requires API key)
- **🎙️ Browser** - Built-in browser TTS

---

## �� API Keys (Optional)

### OpenAI API (For Premium TTS)

1. Go to https://platform.openai.com
2. Create an API key
3. Click extension icon → Settings → Enter OpenAI API key

> 💡 Kokoro TTS is completely free - no API key needed!

---

## ❓ Troubleshooting

### Extension not working?
- Make sure you're on a webpage (not chrome:// pages)
- Try refreshing the page
- Check if extension is enabled in `chrome://extensions/`

### TTS not working?
- **Kokoro**: Make sure Docker is running (`docker-compose up -d`)
- **OpenAI**: Check your API key is valid
- **Browser**: Should work without any setup

### Chunking not working?
- Make sure spaCy server is running (port 8000)
- Run: `docker-compose up -d`
- Check: `curl http://localhost:8000/health`

---

## 💝 Support

If you find this helpful, consider buying me a coffee!

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/thgud1624)

---

## 📄 License

Proprietary - Personal use only. See LICENSE file.

---
---

# 한국어

## 🎯 Focus Reader란?

웹페이지를 **ADHD 친화적**으로 읽을 수 있게 해주는 크롬 확장프로그램:

- �� **색상 청크** - 문장을 의미 단위로 쪼개서 파랑/주황 색으로 표시
- **👁️ Bionic Reading** - 단어 앞글자를 **굵게** 해서 눈이 자연스럽게 따라감
- 🎧 **TTS (음성 읽기)** - AI 음성으로 문단 들을 수 있음
- 🎯 **집중 모드** - 한 문단씩, 산만함 없이 읽기

---

## ✨ 기능

### 📖 스마트 리딩
| 기능 | 설명 |
|------|------|
| **청크 하이라이팅** | 문장을 구절로 나눠서 파랑/주황으로 표시 |
| **Bionic Reading** | 단어 앞글자 굵게 해서 빠른 읽기 |
| **문단 집중** | 문단 클릭하면 집중 리더 열림 |
| **키보드 네비게이션** | `←` `→` 문장 이동, `↑` `↓` 문단 이동 |

### 🎧 TTS (음성)
| 기능 | 설명 |
|------|------|
| **Kokoro TTS** | 무료 로컬 TTS (Docker 필요) |
| **OpenAI TTS** | 프리미엄 품질 (API 키 필요) |
| **브라우저 TTS** | 내장 브라우저 음성 (무료) |
| **문장 싱크** | 재생 중 현재 문장 하이라이트 |

---

## 🚀 설치 방법

### 1단계: 확장프로그램 다운로드

```bash
git clone https://github.com/thgud1624/focus-reader-extension.git
```

또는 [Releases](https://github.com/thgud1624/focus-reader-extension/releases)에서 ZIP 다운로드

### 2단계: 크롬에 설치

1. 크롬에서 `chrome://extensions/` 접속
2. 오른쪽 상단 **개발자 모드** 켜기
3. **"압축해제된 확장 프로그램을 로드합니다"** 클릭
4. `focus-reader-extension` 폴더 선택
5. 완료! 툴바에 📚 아이콘이 보일 거예요

<details>
<summary>📸 스크린샷 가이드</summary>

1. **확장프로그램 페이지 열기**
   - 주소창에 `chrome://extensions/` 입력
   
2. **개발자 모드 켜기**
   - 오른쪽 상단 토글 클릭
   
3. **확장프로그램 로드**
   - "압축해제된 확장 프로그램을 로드합니다" 클릭
   - 확장프로그램 폴더로 이동
   - "선택" 클릭

</details>

### 3단계: 백엔드 서비스 시작 (Kokoro TTS용)

무료 로컬 TTS를 쓰려면 Docker가 필요해요:

```bash
# 메인 프로젝트 클론
git clone https://github.com/thgud1624/focus-reader.git
cd focus-reader

# 서비스 시작
docker-compose up -d
```

이렇게 하면:
- **spaCy** (포트 8000) - 문장 청킹
- **Kokoro TTS** (포트 8001) - 무료 로컬 TTS

> 💡 Docker 없이도 브라우저 TTS(무료)나 OpenAI TTS(유료)는 사용 가능해요!

---

## 🎮 사용법

### 기본 사용법

1. **아무 웹페이지**나 열기
2. **Focus Reader 아이콘** 📚 클릭 (또는 우클릭 → "Focus Reader")
3. **읽고 싶은 문단** 클릭
4. **키보드**로 이동:
   - `←` `→` 이전/다음 문장
   - `↑` `↓` 이전/다음 문단
   - `Space` 재생/일시정지
   - `Esc` 리더 닫기

### TTS 옵션

**스피커 아이콘** 🔊 클릭해서 음성 생성:
- **🆓 Kokoro** - 무료 로컬 TTS (Docker 필요)
- **⭐ OpenAI** - 프리미엄 품질 (API 키 필요)
- **🎙️ 브라우저** - 내장 브라우저 TTS

---

## 🔑 API 키 (선택사항)

### OpenAI API (프리미엄 TTS용)

1. https://platform.openai.com 접속
2. API 키 생성
3. 확장프로그램 아이콘 → 설정 → OpenAI API 키 입력

> 💡 Kokoro TTS는 완전 무료예요 - API 키 필요 없음!

---

## ❓ 문제 해결

### 확장프로그램이 안 돼요?
- 웹페이지에서만 작동해요 (chrome:// 페이지 안됨)
- 페이지 새로고침 해보세요
- `chrome://extensions/`에서 확장프로그램이 켜져있는지 확인

### TTS가 안 돼요?
- **Kokoro**: Docker 실행 중인지 확인 (`docker-compose up -d`)
- **OpenAI**: API 키가 유효한지 확인
- **브라우저**: 별도 설정 없이 작동해야 함

### 청킹이 안 돼요?
- spaCy 서버 실행 중인지 확인 (포트 8000)
- 실행: `docker-compose up -d`
- 확인: `curl http://localhost:8000/health`

---

## 💝 후원

도움이 됐다면 커피 한 잔 사주세요!

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/thgud1624)

---

## 📄 라이선스

독점 라이선스 - 개인 사용만 허용. LICENSE 파일 참조.
