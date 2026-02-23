# 호텔스캐너 (Hotel Scanner)

채널별 숙박 가격 비교 MVP.

- 프론트: 정적 페이지 (`index.html`, `script.js`, `styles.css`)
- 백엔드: Cloudflare Pages Functions (`functions/api/*`)

## 기능

- 목적지/체크인/체크아웃/인원 검색
- 가격/평점/채널 가격차 정렬
- 무료취소/조식포함/현장결제 필터
- 목적지 자동완성 (`/api/suggest`)
- 이벤트 수집 (`/api/events`)
- 실시간 API 실패 시 데모 데이터 fallback

## API 엔드포인트

- `GET /api/search`
  - query: `destination`, `checkIn`, `checkOut`, `guests`
  - 실시간 공급자 결과만 사용 (가짜/fallback 가격 없음)
  - Amadeus + (선택) Agoda/Booking/Expedia 프록시 결과 병합
- `GET /api/suggest`
  - query: `q`
  - 우선 Naver Local API 사용, 실패 시 fallback
- `POST /api/events`
  - body: `{ "name": "...", "properties": { ... } }`
  - 서버 로그 + 선택적으로 PostHog 전송

## 환경변수

`.env.example` 참고.

필수:
- `AMADEUS_CLIENT_ID`
- `AMADEUS_CLIENT_SECRET`

선택:
- `NAVER_CLIENT_ID`
- `NAVER_CLIENT_SECRET`
- `POSTHOG_KEY`
- `POSTHOG_HOST`
- `AGODA_SEARCH_ENDPOINT`
- `AGODA_API_KEY`
- `BOOKING_SEARCH_ENDPOINT`
- `BOOKING_API_KEY`
- `EXPEDIA_SEARCH_ENDPOINT`
- `EXPEDIA_API_KEY`

Cloudflare Pages 설정은 `DEPLOY_SETUP.md` 참고.

## 배포

이 프로젝트는 Git push 기반 배포를 전제로 함.

1. `main` 브랜치에 푸시
2. Cloudflare Pages가 자동 빌드/배포
3. 사이트에서 `/api/search` 동작 확인

## 주의

- 시크릿 키는 Git에 커밋하지 않기
- 한글 깨짐 방지를 위해 파일 인코딩 UTF-8 유지
