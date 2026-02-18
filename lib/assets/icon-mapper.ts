/**
 * Icon Mapper
 *
 * Gemini가 추천한 아이콘 이름을 Lucide 아이콘으로 매핑.
 * PPTX에서는 SVG 삽입, DOCX에서는 유니코드 이모지로 대체.
 */

/**
 * Lucide 아이콘 이름 → 유니코드 이모지 폴백 매핑
 * (DOCX나 SVG 미지원 환경용)
 */
const ICON_EMOJI_MAP: Record<string, string> = {
  // 경고/상태
  "alert-triangle": "⚠️",
  "alert-circle": "⚠️",
  "check-circle": "✅",
  "x-circle": "❌",
  "info": "ℹ️",
  "shield": "🛡️",
  "shield-check": "🛡️",
  "shield-alert": "🛡️",

  // 차트/데이터
  "bar-chart": "📊",
  "bar-chart-2": "📊",
  "bar-chart-3": "📊",
  "line-chart": "📈",
  "pie-chart": "📊",
  "trending-up": "📈",
  "trending-down": "📉",
  "activity": "📈",

  // 사람
  "users": "👥",
  "user": "👤",
  "user-check": "👤",
  "user-plus": "👤",

  // 시간
  "clock": "🕐",
  "calendar": "📅",
  "timer": "⏱️",
  "hourglass": "⏳",

  // 문서
  "file": "📄",
  "file-text": "📄",
  "folder": "📁",
  "clipboard": "📋",
  "book": "📖",
  "book-open": "📖",

  // 금융
  "dollar-sign": "💰",
  "credit-card": "💳",
  "wallet": "💰",
  "banknote": "💵",
  "coins": "🪙",

  // 커뮤니케이션
  "mail": "📧",
  "message-circle": "💬",
  "phone": "📞",
  "globe": "🌐",
  "wifi": "📶",

  // 기타
  "star": "⭐",
  "heart": "❤️",
  "home": "🏠",
  "settings": "⚙️",
  "search": "🔍",
  "lock": "🔒",
  "unlock": "🔓",
  "key": "🔑",
  "map": "🗺️",
  "map-pin": "📍",
  "navigation": "🧭",
  "target": "🎯",
  "zap": "⚡",
  "flame": "🔥",
  "sun": "☀️",
  "moon": "🌙",
  "cloud": "☁️",
  "umbrella": "☂️",
  "truck": "🚚",
  "car": "🚗",
  "plane": "✈️",
  "rocket": "🚀",
  "building": "🏢",
  "building-2": "🏢",
  "factory": "🏭",
  "hospital": "🏥",
  "graduation-cap": "🎓",
  "lightbulb": "💡",
  "puzzle": "🧩",
  "flag": "🏴",
  "award": "🏆",
  "trophy": "🏆",
  "medal": "🏅",
  "thumbs-up": "👍",
  "thumbs-down": "👎",
  "handshake": "🤝",
  "eye": "👁️",
  "scale": "⚖️",
  "microscope": "🔬",
  "stethoscope": "🩺",
  "pill": "💊",
  "syringe": "💉",
  "dna": "🧬",
  "atom": "⚛️",
  "cpu": "💻",
  "server": "🖥️",
  "database": "🗄️",
  "hard-drive": "💽",
  "code": "💻",
  "terminal": "💻",
  "git-branch": "🌿",
  "package": "📦",
  "box": "📦",
  "layers": "📚",
  "grid": "📊",
  "layout": "📐",
  "maximize": "🔲",
  "minimize": "🔳",
  "refresh-cw": "🔄",
  "rotate-cw": "🔄",
  "download": "⬇️",
  "upload": "⬆️",
  "share": "🔗",
  "link": "🔗",
  "external-link": "🔗",
  "arrow-right": "➡️",
  "arrow-left": "⬅️",
  "arrow-up": "⬆️",
  "arrow-down": "⬇️",
  "check": "✓",
  "x": "✗",
  "plus": "➕",
  "minus": "➖",
  "circle": "⚪",
};

/**
 * 아이콘 설명 → Lucide 아이콘 이름 매핑 (키워드 기반)
 */
const DESCRIPTION_KEYWORDS: Record<string, string[]> = {
  "alert-triangle": ["warning", "caution", "danger", "risk", "alert", "exclamation"],
  "shield": ["security", "protection", "defense", "safe", "shield"],
  "bar-chart-2": ["chart", "graph", "statistics", "data", "analytics", "bar"],
  "trending-up": ["growth", "increase", "trend", "rising", "up"],
  "trending-down": ["decline", "decrease", "falling", "down"],
  "users": ["people", "team", "group", "community", "audience"],
  "clock": ["time", "schedule", "deadline", "timing", "clock", "hour"],
  "calendar": ["date", "calendar", "event", "schedule", "planning"],
  "target": ["goal", "target", "objective", "aim", "focus"],
  "lightbulb": ["idea", "innovation", "insight", "light", "bulb", "creative"],
  "globe": ["global", "world", "international", "earth", "worldwide"],
  "dollar-sign": ["money", "cost", "price", "financial", "dollar", "revenue", "budget"],
  "scale": ["balance", "justice", "legal", "law", "compare", "weigh"],
  "rocket": ["launch", "startup", "speed", "fast", "accelerate"],
  "building-2": ["company", "office", "building", "corporate", "enterprise"],
  "graduation-cap": ["education", "learning", "school", "university", "academic"],
  "heart": ["health", "care", "love", "wellness", "medical"],
  "lock": ["secure", "lock", "privacy", "encrypted", "password"],
  "search": ["search", "find", "discover", "explore", "investigate"],
  "settings": ["settings", "configuration", "gear", "tool", "setup"],
  "zap": ["energy", "power", "electric", "lightning", "fast"],
  "flag": ["milestone", "flag", "mark", "checkpoint", "stage"],
  "puzzle": ["puzzle", "solution", "integrate", "piece", "fit"],
  "handshake": ["partnership", "agreement", "deal", "cooperation", "collaborate"],
  "eye": ["vision", "view", "watch", "observe", "monitor", "oversight"],
  "map-pin": ["location", "place", "address", "position", "map"],
  "file-text": ["document", "file", "report", "paper", "form"],
  "check-circle": ["complete", "done", "approved", "verified", "success"],
  "x-circle": ["error", "fail", "cancel", "reject", "remove"],
};

/**
 * 아이콘 이름 정규화 (Gemini가 불완전한 이름을 줄 수 있으므로)
 */
export function normalizeIconName(name: string): string {
  // 이미 유효한 Lucide 이름이면 그대로
  if (ICON_EMOJI_MAP[name]) return name;

  // kebab-case로 변환
  const kebab = name
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (ICON_EMOJI_MAP[kebab]) return kebab;

  // 부분 매칭 시도
  const match = Object.keys(ICON_EMOJI_MAP).find(
    (k) => k.includes(kebab) || kebab.includes(k)
  );

  return match || "circle";
}

/**
 * 아이콘 설명에서 가장 적합한 Lucide 아이콘 찾기
 */
export function descriptionToIconName(description: string): string {
  const lower = description.toLowerCase();

  let bestMatch = "circle";
  let bestScore = 0;

  for (const [iconName, keywords] of Object.entries(DESCRIPTION_KEYWORDS)) {
    const score = keywords.filter((kw) => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = iconName;
    }
  }

  return bestMatch;
}

/**
 * 아이콘 이름 → 이모지 (DOCX 폴백용)
 */
export function iconToEmoji(iconName: string): string {
  return ICON_EMOJI_MAP[normalizeIconName(iconName)] || "⚪";
}
