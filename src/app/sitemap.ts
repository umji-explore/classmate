import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// /sitemap.xml — 검색 엔진에 알려 줄 주소 목록 (앱은 한 페이지라 첫 화면 하나)
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 }];
}
