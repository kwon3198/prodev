# 호텔스캐너 MVP API 조합 (2026-02-23 기준)

## 1) 결론: 바로 시작 가능한 조합

- 숙소/요금 검색: `Amadeus Self-Service APIs`
- 보강 데이터(국내 지역명/POI): `Naver Search API (Local)`
- 환율: `ExchangeRate-API` 또는 `Open Exchange Rates` 중 1개
- 분석: `Cloudflare Web Analytics`(프론트) + `PostHog`(이벤트)

이 조합은 가입 난이도와 초기 개발속도 기준으로 가장 빠르게 MVP를 만들 수 있다.

## 2) 왜 이 조합인가

- `Google Hotels`, `Agoda`, `Naver 숙박 가격`은 일반 공개형 가격 API로 바로 붙이기 어렵다.
- `Booking.com Demand API`, `Expedia Rapid`는 강력하지만 계약/승인 절차가 있어 초기 진입 속도가 느릴 수 있다.
- `Amadeus Self-Service`는 문서/샌드박스 접근성이 좋아 MVP 1차 구축에 유리하다.

## 3) API별 역할

### A. Amadeus (핵심)
- 호텔 리스트/가용성 검색
- 오퍼(요금) 조회
- (확장) 예약 생성

필수 엔드포인트(예시):
- `GET /v1/reference-data/locations/hotels/by-city`
- `GET /v3/shopping/hotel-offers`
- `GET /v3/shopping/hotel-offers/{offerId}`

### B. Naver Local Search (보강)
- 사용자 입력(예: "강남", "해운대")를 지역/장소 후보로 보강
- 자동완성, 지역 추천 품질 개선

필수 엔드포인트(예시):
- `GET /v1/search/local.json`

### C. 환율 API
- 통화가 다른 채널 금액을 KRW로 통합해 "총 결제금액" 비교

필수 엔드포인트:
- `GET /latest`(서비스별 경로 상이)

### D. 이벤트/분석
- 검색 클릭, 채널 이동 클릭, 필터 사용률 수집

필수 이벤트:
- `search_submitted`
- `result_clicked`
- `filter_changed`

## 4) 서버 API 계약 (프론트가 붙일 내부 API)

정적 사이트 + 서버리스 함수 기준으로 최소 3개면 충분:

1. `GET /api/search`
- query: `destination`, `checkIn`, `checkOut`, `guests`
- 동작: Amadeus 호출 + (옵션) Naver 보강 + 환율 변환
- 반환: 호텔별 채널 오퍼 배열, 최저가, 가격차(spread)

2. `GET /api/suggest`
- query: `q`
- 동작: Naver Local API 호출
- 반환: 자동완성 후보

3. `POST /api/events`
- body: 이벤트 이름 + 메타데이터
- 동작: PostHog/로그 수집

## 5) 환경변수

- `AMADEUS_CLIENT_ID`
- `AMADEUS_CLIENT_SECRET`
- `NAVER_CLIENT_ID`
- `NAVER_CLIENT_SECRET`
- `FX_API_KEY`
- `POSTHOG_KEY` (선택)
- `POSTHOG_HOST` (선택)

## 6) 2주 MVP 구현 순서

1. 서버리스 함수 뼈대 생성 (`/api/search`, `/api/suggest`, `/api/events`)
2. `/api/search`에서 Amadeus 연동 + 응답 정규화
3. 환율 반영(모든 가격 KRW 통일)
4. 프론트의 현재 목데이터 제거 후 `/api/search` 연결
5. `/api/suggest` 연결(목적지 입력 UX 개선)
6. 클릭 이벤트 수집 + 대시보드 확인
7. 캐시(도시+날짜+인원 키, 5~15분) 적용

## 7) 비용/리스크 메모

- Amadeus/공급사 API는 호출량 제한과 상업 사용 조건을 반드시 확인해야 한다.
- 가격 비교 서비스는 세금/수수료/환불정책 반영 방식이 채널마다 달라 "총액 산식"을 서버에서 통일해야 한다.
- 제휴/딥링크 수익화는 API보다 계약 조건이 병목이 될 가능성이 높다.

## 8) 차선 조합 (승인형 공급사 전환)

MVP 검증 후 전환 권장:
- `Booking.com Demand API` 또는 `Expedia Rapid API`를 메인 공급사로 추가
- 도시/기간별 캐시 + 모니터링 고도화
- 채널별 수수료/취소 규정 표준화 테이블 운영

---

## 참고 링크 (공식 문서)

- Amadeus for Developers: https://developers.amadeus.com/
- Amadeus Hotel Search API: https://developers.amadeus.com/self-service/category/hotels/api-doc/hotel-search-api
- Naver Search API (Local): https://developers.naver.com/docs/serviceapi/search/local/local.md
- Booking.com Demand API: https://developers.booking.com/
- Expedia Rapid API docs: https://developers.expediagroup.com/rapid/

