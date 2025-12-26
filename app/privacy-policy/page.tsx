import Link from "next/link"
import { ArrowLeft, Shield, Lock, Eye, Server, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy | Valdesio Image Compressor",
  description: "Learn how Valdesio Image Compressor protects privacy. No data collection, no tracking, no cookies. 100% client-side image compression for complete user privacy.",
  keywords: "privacy-first image compression, client-side image tool, secure image compression, browser-based image compressor, data-free image compression, no tracking image tool, anonymous image optimization, private image processing, secure photo compression, no cookies image compressor, image compression without data sharing, privacy-focused web app",
  robots: "index, follow",
  openGraph: {
    title: "Privacy Policy | Valdesio Image Compressor",
    description: "Learn how Valdesio Image Compressor protects privacy. No data collection, no tracking, no cookies. 100% client-side image compression for complete user privacy.",
    siteName: "Valdesio Image Compressor",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Privacy Policy | Valdesio Image Compressor",
    description: "Learn how Valdesio Image Compressor protects privacy. No data collection, no tracking, no cookies. 100% client-side image compression for complete user privacy.",
  },
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8" id="main-content" role="main">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-8">
          <Link href="/">
            <Button variant="ghost" className="gap-2" aria-label="Return to image compressor">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to Compressor
            </Button>
          </Link>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl mb-2" id="page-title">
            <span className="text-blue-600">
              Privacy Policy
            </span>
          </h1>
          <p className="text-lg text-gray-600">Last Updated: April 13, 2025</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-8" role="region" aria-labelledby="commitment-heading">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="h-6 w-6 text-blue-600" aria-hidden="true" />
            <h2
              id="commitment-heading"
              className="text-xl font-semibold text-blue-600"
            >
              Our Commitment to Privacy
            </h2>
          </div>
          <p className="text-gray-700 mb-4">
            At Image Compressor, we are committed to protecting your privacy. This Privacy Policy explains how our
            application handles (or rather, doesn't handle) your data when you use our service.
          </p>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
            <p className="text-blue-800 font-medium">
              The Image Compressor operates entirely within your browser. We do not collect, store, or process any of
              your data on our servers.
            </p>
          </div>
        </div>

        <div className="space-y-8">
          <section
            className="bg-white rounded-lg shadow-sm p-6"
            role="region"
            aria-labelledby="data-collection-heading"
          >
            <div className="flex items-center gap-3 mb-4">
              <Lock className="h-6 w-6 text-blue-600" aria-hidden="true" />
              <h2
                id="data-collection-heading"
                className="text-xl font-semibold text-blue-600"
              >
                No Data Collection
              </h2>
            </div>
            <p className="text-gray-700 mb-4">
              Our Image Compressor does not collect, store, or transmit any of your personal information or image data.
              When you upload an image to our application:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>Your image is processed entirely within your browser</li>
              <li>Your image is never uploaded to any server</li>
              <li>No copies of your original or compressed images are stored</li>
              <li>No metadata from your images is extracted or saved</li>
              <li>Once you close or refresh the page, all data is cleared from memory</li>
            </ul>
          </section>

          <section className="bg-white rounded-lg shadow-sm p-6" role="region" aria-labelledby="cookies-heading">
            <div className="flex items-center gap-3 mb-4">
              <Eye className="h-6 w-6 text-green-600" aria-hidden="true" />
              <h2
                id="cookies-heading"
                className="text-xl font-semibold text-blue-600"
              >
                No Cookies or Tracking
              </h2>
            </div>
            <p className="text-gray-700 mb-4">
              We do not use cookies, web beacons, or any other tracking technologies to collect information about you or
              your browsing habits:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>No cookies are set on your device</li>
              <li>No user sessions are created or maintained</li>
              <li>No analytics or tracking scripts are used</li>
              <li>No advertising technologies are implemented</li>
              <li>No user behavior is monitored or recorded</li>
            </ul>
          </section>

          <section className="bg-white rounded-lg shadow-sm p-6" role="region" aria-labelledby="service-heading">
            <div className="flex items-center gap-3 mb-4">
              <Server className="h-6 w-6 text-indigo-600" aria-hidden="true" />
              <h2
                id="service-heading"
                className="text-xl font-semibold text-blue-600"
              >
                How Our Service Works
              </h2>
            </div>
            <p className="text-gray-700 mb-4">
              Our Image Compressor uses client-side technologies to process your images locally:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>
                <strong>Client-Side Processing:</strong> All image compression happens directly in your browser using
                JavaScript and WebAssembly
              </li>
              <li>
                <strong>Local Storage Only:</strong> Any temporary data created during compression exists only in your
                browser's memory
              </li>
              <li>
                <strong>No Server Uploads:</strong> Your images never leave your device during the compression process
              </li>
              <li>
                <strong>Automatic Cleanup:</strong> All data is automatically cleared when you close the page or
                navigate away
              </li>
            </ul>
          </section>

          <section className="bg-white rounded-lg shadow-sm p-6" role="region" aria-labelledby="third-party-heading">
            <div className="flex items-center gap-3 mb-4">
              <Globe className="h-6 w-6 text-amber-600" aria-hidden="true" />
              <h2
                id="third-party-heading"
                className="text-xl font-semibold text-blue-600"
              >
                Third-Party Services
              </h2>
            </div>
            <p className="text-gray-700 mb-4">
              Our application does not integrate with any third-party services that would collect or process your data:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>No third-party analytics services</li>
              <li>No advertising networks</li>
              <li>No social media integrations that share data</li>
              <li>No cloud storage services for your images</li>
              <li>No external APIs that receive your image data</li>
            </ul>
            <p className="text-gray-700 mt-4">
              The only external resources loaded are the necessary code libraries to run the application, which do not
              collect or transmit your data.
            </p>
          </section>

          <section className="bg-white rounded-lg shadow-sm p-6" role="region" aria-labelledby="changes-heading">
            <h2
              id="changes-heading"
              className="text-xl font-semibold mb-4 text-blue-600"
            >
              Changes to This Privacy Policy
            </h2>
            <p className="text-gray-700 mb-4">
              We may update our Privacy Policy from time to time. Any changes to this Privacy Policy will be reflected
              on this page with an updated "Last Updated" date at the top.
            </p>
            <p className="text-gray-700">
              You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy
              are effective when they are posted on this page.
            </p>
          </section>
        </div>

        <div className="mt-12 text-center">
          <Link href="/">
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              aria-label="Return to image compressor"
            >
              Return to Image Compressor
            </Button>
          </Link>
        </div>
      </div>
    </main>
  )
}
