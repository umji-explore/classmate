# ClassMate — 학교 일정·과제 관리

학생을 위한 일정·과제 관리 앱입니다. 과제·수행평가·시험·학교 행사를 등록하고, 대시보드·달력·통계로 한눈에 관리할 수 있습니다.

- **기술 스택**: Next.js 16 (App Router) · TypeScript · MongoDB Atlas (Mongoose)
- **데이터 저장**: 로그인 없이 브라우저(기기)마다 고유 ID를 만들어 각자의 일정만 저장·조회합니다.
- **데모 모드**: DB에 연결할 수 없으면 자동으로 데모 모드로 전환되어 데이터를 해당 브라우저(localStorage)에만 저장합니다.

## 로컬에서 실행하기

```bash
npm install
cp .env.example .env.local   # 그다음 .env.local 의 MONGODB_URI 를 실제 값으로 수정
npm run dev
```

브라우저에서 <http://localhost:3000> 을 열어 확인합니다.

## MongoDB Atlas 준비

1. <https://cloud.mongodb.com> 에서 무료(M0) 클러스터를 만듭니다.
2. **Database Access**에서 DB 사용자(아이디/비밀번호)를 만듭니다.
3. **Network Access**에서 `0.0.0.0/0`(어디서나 접속 허용)을 추가합니다. Vercel 서버는 IP가 고정되어 있지 않으므로 필요합니다.
4. **Connect → Drivers**에서 연결 문자열을 복사해 `<username>`, `<password>`를 바꾸고, `.net/` 뒤에 DB 이름 `classmate`를 넣습니다.

## Vercel 배포

`.env.local` 은 보안상 GitHub에 올라가지 않으므로 **Vercel에 환경 변수를 따로 등록해야 합니다.**

1. GitHub에 코드를 push 합니다.
2. Vercel에서 **Add New → Project** 로 저장소를 가져옵니다.
3. **Settings → Environment Variables** 에 `MONGODB_URI` 를 추가합니다. (Production / Preview 모두 체크)
4. **Deployments** 에서 **Redeploy** 합니다. (환경 변수는 새로 배포해야 적용됩니다)

배포 후 앱의 **설정** 화면에서 "MongoDB Atlas — 연결됨"이 표시되면 성공입니다. "데모 모드"로 표시되면 그 옆에 나오는 오류 메시지를 확인하세요.

## API

모든 요청에 `x-client-id` 헤더(기기별 ID)가 필요합니다.

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/tasks?status=&search=` | 내 일정 목록 |
| POST | `/api/tasks` | 일정 생성 (배열을 보내면 최대 50개 일괄 생성) |
| DELETE | `/api/tasks` | 내 일정 전체 삭제 |
| PUT | `/api/tasks/:id` | 일정 수정 |
| DELETE | `/api/tasks/:id` | 일정 삭제 |
