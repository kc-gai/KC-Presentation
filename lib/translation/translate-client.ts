interface TranslateResponse {
  translations: string[];
}

export async function translateTexts(
  texts: string[],
  targetLang: "ko" | "ja"
): Promise<string[]> {
  if (texts.length === 0) return [];

  const response = await fetch("/api/translate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ texts, targetLang }),
  });

  if (!response.ok) {
    throw new Error(`Translation failed: ${response.statusText}`);
  }

  const data: TranslateResponse = await response.json();

  // NFC normalize all translated text to prevent encoding issues
  return data.translations.map((t) => t.normalize("NFC"));
}
