import type React from "react"
import "./globals.css"
import { Header } from "@/components/navigation/Header"
import { Footer } from "@/components/navigation/Footer"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Free Online Image Compressor powered by Valdesio",
  description: "Compress your images instantly with intelligent size reduction. Valdesio Image Compression is a fast, free, and privacy-focused online tool to reduce file sizes and optimize web performance.",
  keywords: "valdesio, online image compressor, fast image compression tool, free image optimizer, compress JPG and PNG online, reduce image file size, lossless image compression, image compression for web, privacy-first image compression, compress images without quality loss, Valdesio image tools, optimize images for faster loading, best online image compressor, drag and drop image compressor, secure photo compression, web-friendly image formats, responsive image optimization, browser-based image compression, Valdesio image utility, lightweight image compressor, compress images instantly, image compression with preview, smart image optimizer",
  robots: "index, follow",
  openGraph: {
    title: "Free Online Image Compressor powered by Valdesio",
    description: "Compress your images instantly with intelligent size reduction. Valdesio Image Compression is a fast, free, and privacy-focused online tool to reduce file sizes and optimize web performance.",
    siteName: "Valdesio Image Compression",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Free Online Image Compressor powered by Valdesio",
    description: "Compress your images instantly with intelligent size reduction. Valdesio Image Compression is a fast, free, and privacy-focused online tool to reduce file sizes and optimize web performance.",
  },
  verification: {
    google: "g3Bv6_c1t0nGBPWn5wi7JUIEMcGQWBcqe7C3JPd7B10",
  },
  alternates: {
    canonical: "https://valdesiocompressor.pages.dev/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {

  return (
    <html lang="en">
      <head>
        {/* Preload WASM compression scripts for faster first compression */}
        <link rel="preload" href="/js/jpeg/mozjpeg-worker.js" as="script" />
        <link rel="preload" href="/js/jpeg/mozjpeg.js" as="script" />
        <link rel="preload" href="/js/png/oxipng-worker.js" as="script" />
        <link rel="preload" href="/js/png/oxipng.js" as="script" />
        <meta httpEquiv="Content-Security-Policy"
          content="
          default-src 'self';
          script-src 'self' 'unsafe-eval' 'unsafe-inline';
          style-src 'self' 'unsafe-inline';
          img-src 'self' blob: data:;
          font-src 'self';
          object-src 'none';
          base-uri 'self';
          frame-src 'none';
          manifest-src 'self';
          media-src 'self';
          worker-src 'self';
          "
        />
      </head>
      <body className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-grow">{children}</div>
        <Footer />
      </body>
    </html>
  )
}


import './globals.css'