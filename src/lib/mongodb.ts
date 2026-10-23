import mongoose from 'mongoose';

// 환경 변수가 없을 때 던지는 에러 (API에서 503 응답으로 구분하기 위해 별도 클래스로 정의)
export class MissingDatabaseUriError extends Error {
  constructor() {
    super('MONGODB_URI 환경 변수가 설정되어 있지 않습니다. (로컬: .env.local / 배포: Vercel 프로젝트 설정 → Environment Variables)');
    this.name = 'MissingDatabaseUriError';
  }
}

// Mongoose 전역 캐싱 (Next.js 핫 리로드·서버리스 인스턴스 재사용 시 연결 중복 방지)
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongoose: MongooseCache;
}

const cached: MongooseCache = global.mongoose ?? { conn: null, promise: null };

if (!global.mongoose) {
  global.mongoose = cached;
}

export async function connectToDatabase() {
  // 모듈을 불러올 때가 아니라 실제로 연결할 때 확인해야
  // 환경 변수가 없는 빌드 단계(Vercel 등)에서 빌드가 실패하지 않는다.
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new MissingDatabaseUriError();
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 8000,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    // 실패한 연결을 캐시에 남겨두면 다음 요청도 계속 실패하므로 초기화
    cached.promise = null;
    throw error;
  }
  return cached.conn;
}
