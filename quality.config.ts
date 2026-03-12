/**
 * AI-SDLC Quality Configuration
 * presentation-editor 프로젝트 품질 설정
 *
 * auto-detected (2026-02-24):
 *   - hasPrisma: false  (prisma/schema.prisma 없음)
 *   - hasI18n:   false  (next-intl / next-i18next 의존성 없음)
 *   - hasAPI:    true   (app/api/ 라우트 존재: ocr-fallback, translate)
 *   - hasAuth:   false  (next-auth / @auth/core 없음)
 *   - testRunner: none  (vitest / jest devDependencies 없음)
 *   - port: 3002        (WARN — 표준 포트 3000 아님)
 */
export default {
  projectName: 'presentation-editor',

  // 테스트 설정
  testRunner: 'none',
  coverageThreshold: 0,

  // 프로젝트 특성 플래그
  hasPrisma: false,
  hasI18n: false,
  i18nLocales: [],
  hasAPI: true,
  hasAuth: false,

  // AI Slop Detection 조정
  slop: {
    disablePatterns: [],
    warningAsError: [],
    excludePaths: [
      'node_modules/',
      '.next/',
      'scripts/',
      'prisma/',
      'public/',
    ],
  },

  // Quality Gate 설정 — Phase 0: 측정만 (FAIL 없음)
  gate: {
    failOnWarning: false,
    changedOnly: false,
  },
};
