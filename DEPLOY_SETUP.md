# 호텔스캐너 배포 환경변수 설정

Cloudflare Pages 프로젝트 기준:

1. Cloudflare Dashboard > `Workers & Pages` > 프로젝트 선택
2. `Settings` > `Environment variables`
3. 아래 키를 `Production`에 추가
4. 저장 후 `Retry deployment` 또는 새 커밋 푸시

## 필수

- `AMADEUS_CLIENT_ID`
- `AMADEUS_CLIENT_SECRET`

## 선택

- `NAVER_CLIENT_ID`
- `NAVER_CLIENT_SECRET`
- `POSTHOG_KEY`
- `POSTHOG_HOST` (예: `https://app.posthog.com`)

## 동작 확인

- 환경변수 없음: `/api/search`가 데모 데이터 반환
- Amadeus 값 있음: `/api/search`가 Amadeus 테스트 API 우선 사용
- PostHog 값 있음: `/api/events`가 이벤트 전달

## 참고

- 키 값은 절대 Git에 커밋하지 말고 Dashboard Secret로만 관리
- 로컬 실행 없이도 Git push만 하면 배포 반영됨
