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
- `AGODA_SEARCH_ENDPOINT`
- `AGODA_API_KEY`
- `BOOKING_SEARCH_ENDPOINT`
- `BOOKING_API_KEY`
- `EXPEDIA_SEARCH_ENDPOINT`
- `EXPEDIA_API_KEY`

## 실데이터 동작 확인

- 환경변수 없음: `/api/search`는 404(`no_live_offers`) 반환
- Amadeus 값 있음: `/api/search`가 Amadeus 실시간 결과 사용
- Agoda/Booking/Expedia 값 있음: 해당 프록시 엔드포인트 결과를 함께 병합
- PostHog 값 있음: `/api/events`가 이벤트 전달

## 참고

- 키 값은 절대 Git에 커밋하지 말고 Dashboard Secret로만 관리
- 로컬 실행 없이도 Git push만 하면 배포 반영됨
- Agoda/Booking/Expedia는 보통 직접 공개 API보다 제휴/프록시 연동 방식이 현실적임
