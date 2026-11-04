import type { Metadata, Viewport } from "next";
import "./globals.css";
import {
  SITE_URL,
  SITE_NAME,
  COMPANY_NAME,
  SEO_TITLE,
  SEO_DESCRIPTION,
  SEO_KEYWORDS,
  SEO_JSON_LD,
} from "@/lib/seo-data";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0B0F17",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SEO_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SEO_DESCRIPTION,
  keywords: SEO_KEYWORDS,
  applicationName: SITE_NAME,
  authors: [{ name: COMPANY_NAME, url: SITE_URL }],
  creator: COMPANY_NAME,
  publisher: COMPANY_NAME,
  category: "Industrial & Precious Metal Refining",
  formatDetection: {
    telephone: true,
    email: true,
    address: true,
  },
  alternates: {
    canonical: "/",
    languages: {
      "ko-KR": "/",
    },
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SEO_TITLE,
    description: SEO_DESCRIPTION,
    images: [
      {
        url: `${SITE_URL}/og-image.svg`,
        width: 1200,
        height: 630,
        alt: "이온랩 리파이너리 (IONLAB REFINERY) - 1kg 소량 고순도 금 추출 위탁 정련 센터",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SEO_TITLE,
    description: SEO_DESCRIPTION,
    images: [`${SITE_URL}/og-image.svg`],
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: ["/icon.svg"],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  manifest: "/manifest.webmanifest",
  verification: {
    google: "a_EniNgLktev1_A6aqiWu22LKdwAuAHJybQbyJ95_lQ",
  },
  other: {
    yeti: "index, follow",
    daumoa: "index, follow",
    "geo.region": "KR-41",
    "geo.placename": "평택시, 경기도",
    "geo.position": "37.0456;127.0561",
    ICBM: "37.0456, 127.0561",
    "content-language": "ko-KR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="dark scroll-smooth">
      <head>
        <link
          rel="preconnect"
          href="https://cdn.jsdelivr.net"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(SEO_JSON_LD).replace(/</g, "\\u003c"),
          }}
        />
      </head>
      <body className="bg-[#0B0F17] text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
