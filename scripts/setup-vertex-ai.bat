@echo off
chcp 65001 >nul
echo ============================================================
echo   Vertex AI 서비스 계정 자동 설정
echo   (GCP 인증 → 서비스 계정 생성 → Vercel 환경변수 등록)
echo ============================================================
echo.

set PROJECT_ID=gemini-vertex-470601
set SA_NAME=kc-presentation-ocr
set SA_EMAIL=%SA_NAME%@%PROJECT_ID%.iam.gserviceaccount.com
set GCLOUD="C:\Users\ksh14\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"

:: Step 1: GCP 로그인
echo [1/5] GCP 로그인 중... (브라우저가 열립니다)
call %GCLOUD% auth login --project=%PROJECT_ID% --quiet
if errorlevel 1 (
    echo ERROR: GCP 로그인 실패
    pause
    exit /b 1
)
echo OK: GCP 로그인 완료
echo.

:: Step 2: ADC 갱신
echo [2/5] Application Default Credentials 갱신 중...
call %GCLOUD% auth application-default login --quiet
if errorlevel 1 (
    echo WARN: ADC 갱신 실패 (로컬 Vertex AI는 사용 불가, 계속 진행)
)
echo.

:: Step 3: 서비스 계정 생성 (이미 있으면 스킵)
echo [3/5] 서비스 계정 생성 중...
call %GCLOUD% iam service-accounts describe %SA_EMAIL% --project=%PROJECT_ID% >nul 2>&1
if errorlevel 1 (
    call %GCLOUD% iam service-accounts create %SA_NAME% --project=%PROJECT_ID% --display-name="KC Presentation OCR"
    if errorlevel 1 (
        echo ERROR: 서비스 계정 생성 실패
        pause
        exit /b 1
    )
    :: 권한 부여
    call %GCLOUD% projects add-iam-policy-binding %PROJECT_ID% --member="serviceAccount:%SA_EMAIL%" --role="roles/aiplatform.user" --quiet
    echo OK: 서비스 계정 생성 + 권한 부여 완료
) else (
    echo OK: 서비스 계정이 이미 존재합니다
)
echo.

:: Step 4: 키 생성
echo [4/5] 서비스 계정 키 생성 중...
set KEY_FILE=%TEMP%\gcp-sa-key.json
call %GCLOUD% iam service-accounts keys create "%KEY_FILE%" --iam-account=%SA_EMAIL%
if errorlevel 1 (
    echo ERROR: 키 생성 실패
    pause
    exit /b 1
)
echo OK: 키 생성 완료 (%KEY_FILE%)
echo.

:: Step 5: Vercel 환경변수 등록
echo [5/5] Vercel 환경변수 등록 중...
cd /d "d:\99_개인\website\KC-CRM\Presentation\presentation-editor"

:: Read key file content and pipe to vercel env add
type "%KEY_FILE%" | npx vercel env add GOOGLE_CREDENTIALS_JSON production
if errorlevel 1 (
    echo WARN: Vercel 등록 실패 - 수동으로 등록해주세요
    echo   키 파일: %KEY_FILE%
    echo   명령어: npx vercel env add GOOGLE_CREDENTIALS_JSON production
) else (
    echo OK: Vercel 환경변수 등록 완료
)

:: 키 파일 삭제 (보안)
del "%KEY_FILE%" 2>nul
echo.

echo ============================================================
echo   설정 완료!
echo   - 로컬: gcloud ADC로 Vertex AI 사용 가능
echo   - Vercel: 서비스 계정으로 Vertex AI 사용 가능
echo ============================================================
pause
