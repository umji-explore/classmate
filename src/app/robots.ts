import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// /robots.txt — 검색 엔진이 첫 화면은 수집하고, 데이터 API는 수집하지 않도록 안내
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
