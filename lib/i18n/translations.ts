export type UILanguage = "ko" | "ja" | "en";

export const translations = {
  // Main page
  "app.title": {
    ko: "Document Editor",
    ja: "Document Editor",
    en: "Document Editor",
  },
  "app.description": {
    ko: "PDF 또는 DOCX 파일을 업로드하면 텍스트와 이미지를 분리하여\n편집하고 PPT 또는 DOC으로 내보낼 수 있습니다",
    ja: "PDFまたはDOCXファイルをアップロードすると、テキストと画像を分離して\n編集し、PPTまたはDOCにエクスポートできます",
    en: "Upload a PDF or DOCX file to separate text and images,\nedit them, and export as PPT or DOC",
  },
  "app.step1.title": {
    ko: "파일 업로드",
    ja: "ファイルアップロード",
    en: "Upload File",
  },
  "app.step1.desc": {
    ko: "PDF / DOCX 드래그앤드롭",
    ja: "PDF / DOCX ドラッグ＆ドロップ",
    en: "Drag & drop PDF / DOCX",
  },
  "app.step2.title": {
    ko: "콘텐츠 편집",
    ja: "コンテンツ編集",
    en: "Edit Content",
  },
  "app.step2.desc": {
    ko: "텍스트 + 이미지 개별 편집",
    ja: "テキスト＋画像の個別編集",
    en: "Edit text + images individually",
  },
  "app.step3.title": {
    ko: "내보내기",
    ja: "エクスポート",
    en: "Export",
  },
  "app.step3.desc": {
    ko: "PPT / DOC 한국어/일본어",
    ja: "PPT / DOC 韓国語/日本語",
    en: "PPT / DOC Korean/Japanese",
  },

  // File uploader
  "upload.outputFormat": {
    ko: "최종 출력 형식 선택",
    ja: "出力形式を選択",
    en: "Select output format",
  },
  "upload.ppt": {
    ko: "PPT",
    ja: "PPT",
    en: "PPT",
  },
  "upload.pptDesc": {
    ko: "프레젠테이션",
    ja: "プレゼンテーション",
    en: "Presentation",
  },
  "upload.doc": {
    ko: "DOC",
    ja: "DOC",
    en: "DOC",
  },
  "upload.docDesc": {
    ko: "워드 문서",
    ja: "ワード文書",
    en: "Word Document",
  },
  "upload.dragHere": {
    ko: "여기에 놓으세요",
    ja: "ここにドロップ",
    en: "Drop here",
  },
  "upload.dragFile": {
    ko: "파일을 드래그하세요",
    ja: "ファイルをドラッグしてください",
    en: "Drag a file here",
  },
  "upload.clickToSelect": {
    ko: "또는 클릭하여 파일을 선택하세요",
    ja: "またはクリックしてファイルを選択",
    en: "or click to select a file",
  },
  "upload.invalidFile": {
    ko: "PDF 또는 DOCX 파일만 업로드할 수 있습니다.",
    ja: "PDFまたはDOCXファイルのみアップロードできます。",
    en: "Only PDF or DOCX files can be uploaded.",
  },
  "upload.error": {
    ko: "파일 처리 중 오류가 발생했습니다.",
    ja: "ファイル処理中にエラーが発生しました。",
    en: "An error occurred while processing the file.",
  },

  // Processing status
  "status.loadingPdf": {
    ko: "PDF 로딩 중...",
    ja: "PDF読み込み中...",
    en: "Loading PDF...",
  },
  "status.loadingDocx": {
    ko: "DOCX 로딩 중...",
    ja: "DOCX読み込み中...",
    en: "Loading DOCX...",
  },
  "status.renderingPages": {
    ko: "페이지 렌더링 중",
    ja: "ページレンダリング中",
    en: "Rendering pages",
  },
  "status.extractingImages": {
    ko: "이미지 추출 중",
    ja: "画像抽出中",
    en: "Extracting images",
  },
  "status.ocrProcessing": {
    ko: "텍스트 추출 중",
    ja: "テキスト抽出中",
    en: "Extracting text",
  },

  // Toolbar
  "toolbar.slides": {
    ko: "장",
    ja: "枚",
    en: "slides",
  },
  "toolbar.original": {
    ko: "원문",
    ja: "原文",
    en: "Original",
  },
  "toolbar.korean": {
    ko: "한국어",
    ja: "韓国語",
    en: "Korean",
  },
  "toolbar.japanese": {
    ko: "日本語",
    ja: "日本語",
    en: "Japanese",
  },
  "toolbar.exportPpt": {
    ko: "PPT 내보내기",
    ja: "PPTエクスポート",
    en: "Export PPT",
  },
  "toolbar.exportDoc": {
    ko: "DOC 내보내기",
    ja: "DOCエクスポート",
    en: "Export DOC",
  },
  "toolbar.newFile": {
    ko: "새 파일 열기",
    ja: "新しいファイルを開く",
    en: "Open new file",
  },

  // Navigator
  "navigator.title": {
    ko: "슬라이드",
    ja: "スライド",
    en: "Slides",
  },

  // Tabs
  "tab.extract": {
    ko: "PDF 추출",
    ja: "PDF抽出",
    en: "PDF Extract",
  },
  "tab.extract.desc": {
    ko: "PDF에서 텍스트와 이미지를 추출하여 원본을 만듭니다",
    ja: "PDFからテキストと画像を抽出して原本を作成します",
    en: "Extract text and images from PDF to create original",
  },
  "tab.translate": {
    ko: "번역",
    ja: "翻訳",
    en: "Translate",
  },
  "tab.translate.desc": {
    ko: "DOCX 원본을 업로드하여 한국어/일본어로 번역합니다",
    ja: "DOCX原本をアップロードして韓国語/日本語に翻訳します",
    en: "Upload DOCX original to translate into Korean/Japanese",
  },

  // Translation tab
  "translate.title": {
    ko: "문서 번역",
    ja: "文書翻訳",
    en: "Document Translation",
  },
  "translate.description": {
    ko: "DOCX 파일을 업로드하면 한국어 또는 일본어로 번역합니다",
    ja: "DOCXファイルをアップロードすると韓国語または日本語に翻訳します",
    en: "Upload a DOCX file to translate into Korean or Japanese",
  },
  "translate.selectLang": {
    ko: "번역 언어 선택",
    ja: "翻訳言語を選択",
    en: "Select translation language",
  },
  "translate.start": {
    ko: "번역 시작",
    ja: "翻訳開始",
    en: "Start Translation",
  },
  "translate.translating": {
    ko: "번역 중",
    ja: "翻訳中",
    en: "Translating",
  },
  "translate.complete": {
    ko: "번역 완료",
    ja: "翻訳完了",
    en: "Translation Complete",
  },
  "translate.export": {
    ko: "번역본 내보내기",
    ja: "翻訳版エクスポート",
    en: "Export Translation",
  },
  "translate.dragDocx": {
    ko: "DOCX 파일을 드래그하세요",
    ja: "DOCXファイルをドラッグしてください",
    en: "Drag a DOCX file here",
  },
  "translate.onlyDocx": {
    ko: "DOCX 파일만 지원됩니다",
    ja: "DOCXファイルのみ対応",
    en: "Only DOCX files supported",
  },
  "translate.backToUpload": {
    ko: "다른 파일 번역",
    ja: "別のファイルを翻訳",
    en: "Translate another file",
  },

  // Canvas
  "canvas.noElements": {
    ko: "텍스트/이미지 추출 실패 - 배경 이미지로 내보내기됩니다",
    ja: "テキスト/画像の抽出失敗 - 背景画像としてエクスポートされます",
    en: "Text/image extraction failed - will export as background image",
  },

  // Language switcher
  "langSwitch.label": {
    ko: "언어",
    ja: "言語",
    en: "Language",
  },
} as const;

export type TranslationKey = keyof typeof translations;
