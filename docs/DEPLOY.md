# 무료 배포
1. Cloudflare Workers 프로젝트 생성.
2. worker/를 배포하고 frontend/를 Static Assets로 제공합니다.
3. D1 DB 생성 후 worker/migrations/001_init.sql 적용.
4. Worker Secrets에 DART_API_KEY, KRX_API_KEY 등록.
5. 키가 발급되면 provider/dart.js와 provider/krx.js를 현재 공식 명세에 맞춰 연결.
6. 배포 URL을 Safari에서 열고 공유 → 홈 화면에 추가.

중요: API 키를 index.html에 넣지 마세요.
