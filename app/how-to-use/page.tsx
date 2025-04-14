import Link from "next/link"
import {
  Upload,
  ImageIcon,
  FileImage,
  Download,
  Zap,
  Settings,
  HelpCircle,
  FileWarning,
  Lightbulb,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Sparkles,
  Maximize2,
  RefreshCw,
  FileType2,
  Shield,
  FileQuestion,
  GitCompare,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "How to Use | Valdesio Image Compressor",
  description: "Need to shrink your image file size? Learn how to use our browser-based image compressor tool. Safe, fast, and effective.",
  keywords: "image compressor, how to compress images, image compression tutorial, compress JPEG images online, compress PNG images online, optimize image size, reduce image file size, best image compression tool, image optimizer instructions, how to reduce image size, convert PNG to JPEG online, JPEG compression steps, online image compression process, drag and drop image compressor, image compression walkthrough, easy image compression guide, visual image compression guide, interactive image optimizer, compare compressed image quality, image compression before after slider, image compression tips and tricks, image compression troubleshooting, image not uploading fix, why image compression is slow, image compression quality loss fix, download compressed image, save compressed image, secure image compression, privacy friendly image compressor, browser-based image compression, client-side image optimization, responsive image compressor, how image compression works, smart image format detection, JPEG or PNG which is better, batch compress images online, why convert PNG to JPEG, best image compression methods, image compression common questions, step by step image compression, compress photo for website, optimize image for web, compress image under 20MB, compress image for faster loading, image compression best practices, web performance image compression",
  robots: "index, follow",
  openGraph: {
    title: "How to Use Valdesio Image Compressor",
    description: "Need to shrink your image file size? Learn how to use our browser-based image compressor tool. Safe, fast, and effective.",
    siteName: "Valdesio Image Compression",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "How to Use Valdesio Image Compressor",
    description: "Need to shrink your image file size? Learn how to use our browser-based image compressor tool. Safe, fast, and effective.",
  },
};


export default function HowToUsePage() {
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
            <span className="bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">
              How to Use the Image Compressor
            </span>
          </h1>
          <p className="text-lg text-gray-600">A simple guide to compress your images while maintaining quality</p>
        </div>

        {/* Getting Started Section */}
        <section className="mb-12" aria-labelledby="getting-started-heading">
          <div className="flex items-center gap-2 mb-6">
            <Zap className="h-6 w-6 text-purple-600" aria-hidden="true" />
            <h2
              id="getting-started-heading"
              className="text-2xl font-semibold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent"
            >
              Getting Started
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-purple-100 p-2 rounded-full">
                    <Upload className="h-5 w-5 text-purple-600" />
                  </div>
                  <h3 className="font-medium text-lg">Step 1: Upload Your Image</h3>
                </div>
                <p className="text-gray-600 mb-4">
                  Click on the upload area or drag and drop your image file. The compressor supports JPEG/JPG and PNG
                  files up to 20MB.
                </p>
                <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50">
                  <FileImage className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">Click or drag and drop your image here</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <Settings className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="font-medium text-lg">Step 2: Compression Options</h3>
                </div>
                <p className="text-gray-600 mb-4">
                  For PNG files, you can choose to convert to JPEG before compression for better results with
                  photographic images.
                </p>
                <div className="flex items-center mb-4 p-3 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled
                  />
                  <span className="ml-2 text-sm text-gray-700">Convert PNG to JPEG before compression</span>
                </div>
                <p className="text-sm text-gray-500">This option appears only when you upload a PNG file</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-green-100 p-2 rounded-full">
                    <Sparkles className="h-5 w-5 text-green-600" />
                  </div>
                  <h3 className="font-medium text-lg">Step 3: Compress</h3>
                </div>
                <p className="text-gray-600 mb-4">
                  Click the "Compress Image" button and wait for the process to complete. The application will
                  automatically select the best compression method based on your image type.
                </p>
                <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600">
                  <p>The application will automatically analyze and optimize your image</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-indigo-100 p-2 rounded-full">
                    <Download className="h-5 w-5 text-indigo-600" />
                  </div>
                  <h3 className="font-medium text-lg">Step 4: Download</h3>
                </div>
                <p className="text-gray-600 mb-4">
                  After compression, you can download your optimized image, copy its URL, or use the "Save As" option if
                  the download button doesn't work.
                </p>
                <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600">
                  <p>Save your optimized image with significantly reduced file size</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Features Section */}
        <section className="mb-12" aria-labelledby="features-heading">
          <div className="flex items-center gap-2 mb-6">
            <ImageIcon className="h-6 w-6 text-purple-600" aria-hidden="true" />
            <h2
              id="features-heading"
              className="text-2xl font-semibold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent"
            >
              Key Features
            </h2>
          </div>

          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="bg-purple-100 p-2 rounded-full shrink-0 mt-1">
                  <Maximize2 className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-medium text-lg mb-2">Before/After Comparison</h3>
                  <p className="text-gray-600 mb-2">
                    Use the interactive slider to compare your original and compressed images side by side. This helps
                    you verify the quality is maintained while seeing the file size reduction.
                  </p>
                  <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600">
                    <p>Drag the slider left and right to compare the original and compressed versions</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="bg-blue-100 p-2 rounded-full shrink-0 mt-1">
                  <FileType2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-lg mb-2">Smart Format Detection</h3>
                  <p className="text-gray-600 mb-2">
                    The compressor automatically detects your image type (photographic, line art, graphical) and applies
                    the most appropriate compression technique.
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="bg-gray-50 p-2 rounded">
                      <p className="font-medium">Photographs</p>
                      <p className="text-gray-500">Optimized for natural images</p>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                      <p className="font-medium">Line Art</p>
                      <p className="text-gray-500">Preserves sharp edges</p>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                      <p className="font-medium">Graphics</p>
                      <p className="text-gray-500">Maintains color accuracy</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="bg-green-100 p-2 rounded-full shrink-0 mt-1">
                  <RefreshCw className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium text-lg mb-2">Format Conversion</h3>
                  <p className="text-gray-600 mb-2">
                    Convert PNG to JPEG for better compression with photographic images. This option is especially
                    useful for PNG photos that don't need transparency.
                  </p>
                  <div className="bg-yellow-50 p-3 rounded-lg text-sm border-l-4 border-yellow-400 pl-4">
                    <p className="text-yellow-800">
                      <strong>Note:</strong> Converting PNG to JPEG will remove any transparency in the image.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Tips and Best Practices */}
        <section className="mb-12" aria-labelledby="tips-heading">
          <div className="flex items-center gap-2 mb-6">
            <Lightbulb className="h-6 w-6 text-purple-600" aria-hidden="true" />
            <h2
              id="tips-heading"
              className="text-2xl font-semibold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent"
            >
              Tips & Best Practices
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  <h3 className="font-medium">Choose the Right Format</h3>
                </div>
                <p className="text-gray-600 text-sm">
                  Use JPEG for photographs and PNG for graphics with transparency or sharp edges. Convert PNG to JPEG
                  for photos that don't need transparency.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  <h3 className="font-medium">Check the Comparison</h3>
                </div>
                <p className="text-gray-600 text-sm">
                  Always use the comparison slider to verify the compressed image maintains acceptable quality before
                  downloading.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  <h3 className="font-medium">Batch Processing</h3>
                </div>
                <p className="text-gray-600 text-sm">
                  For multiple images, process them one by one and download each before uploading the next for best
                  results.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  <h3 className="font-medium">Resize Before Uploading</h3>
                </div>
                <p className="text-gray-600 text-sm">
                  If you need a specific size, resize your image before compression for better results rather than after
                  compression.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Common Questions */}
        <section className="mb-12" aria-labelledby="questions-heading">
          <div className="flex items-center gap-2 mb-6">
            <HelpCircle className="h-6 w-6 text-purple-600" aria-hidden="true" />
            <h2
              id="questions-heading"
              className="text-2xl font-semibold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent"
            >
              Common Questions
            </h2>
          </div>

          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-100 p-2 rounded-full shrink-0 mt-1">
                    <Shield className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-lg mb-2">Is my data secure?</h3>
                    <p className="text-gray-600">
                      Yes, all processing happens in your browser. Your images are never uploaded to any server,
                      ensuring complete privacy and security.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="bg-purple-100 p-2 rounded-full shrink-0 mt-1">
                    <FileQuestion className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-lg mb-2">Why isn't my image compressing much?</h3>
                    <p className="text-gray-600">
                      Some images may already be well-optimized or use formats that don't compress further without
                      quality loss. Try the PNG to JPEG conversion option for photographic images if maximum compression
                      is needed.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="bg-indigo-100 p-2 rounded-full shrink-0 mt-1">
                    <GitCompare className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-lg mb-2">What's the difference between the compression methods?</h3>
                    <p className="text-gray-600">The application uses different techniques based on your image:</p>
                    <ul className="list-disc pl-5 mt-2 text-gray-600 space-y-1">
                      <li>Standard compression for smaller images</li>
                      <li>Advanced compression for larger files</li>
                      <li>Specialized algorithms for line art, photos, and graphics</li>
                      <li>Format conversion when beneficial</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="bg-amber-100 p-2 rounded-full shrink-0 mt-1">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-lg mb-2">The download button isn't working. What should I do?</h3>
                    <p className="text-gray-600">
                      If the download button doesn't work, use the "Right-click and Save As" option that appears after
                      compression. This alternative method works in all browsers.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Troubleshooting */}
        <section aria-labelledby="troubleshooting-heading">
          <div className="flex items-center gap-2 mb-6">
            <FileWarning className="h-6 w-6 text-purple-600" aria-hidden="true" />
            <h2
              id="troubleshooting-heading"
              className="text-2xl font-semibold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent"
            >
              Troubleshooting
            </h2>
          </div>

          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                  <h3 className="font-medium">Image Fails to Upload</h3>
                </div>
                <p className="text-gray-600 text-sm mb-2">If your image fails to upload, check:</p>
                <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                  <li>The file is under 20MB</li>
                  <li>The format is JPEG/JPG or PNG</li>
                  <li>The file isn't corrupted</li>
                  <li>Try refreshing the page and uploading again</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                  <h3 className="font-medium">Compression Takes Too Long</h3>
                </div>
                <p className="text-gray-600 text-sm mb-2">
                  For very large images, compression may take longer. If it seems stuck:
                </p>
                <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                  <li>Wait at least 1-2 minutes for large files</li>
                  <li>Check your internet connection</li>
                  <li>Try refreshing and using the standard compression option</li>
                  <li>Consider resizing very large images before uploading</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                  <h3 className="font-medium">Quality Issues After Compression</h3>
                </div>
                <p className="text-gray-600 text-sm mb-2">If you notice quality issues in the compressed image:</p>
                <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                  <li>Use the comparison slider to check specific areas</li>
                  <li>Try again without the PNG to JPEG conversion option</li>
                  <li>Some images with fine details may require less compression</li>
                  <li>Consider using the "Start Over" button and trying again</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Footer */}
        <div className="mt-16 text-center">
          <Link href="/">
            <Button
              className="bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600"
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
