import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://abi.agavesysmx.com'
  return [
    { url: siteUrl, changeFrequency: 'weekly', priority: 1 },
    { url: `${siteUrl}/privacidad`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${siteUrl}/terminos`, changeFrequency: 'yearly', priority: 0.2 },
  ]
}
