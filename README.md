# ClassMate — 학교 일정·과제 관리

학생을 위한 일정·과제 관리 앱입니다. 과제·수행평가·시험·학교 행사를 등록하고, 대시보드·달력·통계로 한눈에 관리할 수 있습니다.

- **기술 스택**: Next.js 16 (App Router) · TypeScript · MongoDB Atlas (Mongoose)
- **회원 기능**: 아이디/비밀번호로 회원가입·로그인합니다. 비밀번호는 scrypt로 암호화해 저장하고, 로그인 상태는 httpOnly 쿠키 세션(30일)으로 유지합니다.
- **데이터 저장**: 모든 일정은 로그인한 사용자별로 MongoDB Atlas에 저장되어 어느 기기에서든 같은 일정을 볼 수 있습니다.

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

배포 후 시작 화면에서 회원가입이 되면 성공입니다. DB 연결에 문제가 있으면 시작 화면 위쪽에 오류 메시지가 표시됩니다.

## API

로그인 후 발급되는 `cm_session` 쿠키로 사용자를 구분합니다. 과제 API는 로그인하지 않으면 `401`을 돌려줍니다.

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| POST | `/api/auth/signup` | 회원가입 `{ username, password, nickname }` 후 바로 로그인 |
| POST | `/api/auth/login` | 로그인 `{ username, password }` |
| POST | `/api/auth/logout` | 로그아웃 |
| GET | `/api/auth/me` | 현재 로그인한 사용자 |
| DELETE | `/api/auth/me` | 회원 탈퇴 `{ password }` (계정·일정 모두 삭제) |
| GET | `/api/tasks?status=&search=` | 내 일정 목록 |
| POST | `/api/tasks` | 일정 생성 (배열을 보내면 최대 50개 일괄 생성) |
| DELETE | `/api/tasks` | 내 일정 전체 삭제 |
| PUT | `/api/tasks/:id` | 일정 수정 |
| DELETE | `/api/tasks/:id` | 일정 삭제 |
