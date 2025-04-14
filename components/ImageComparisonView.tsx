"use client"

import { useState, useEffect } from "react"
import { Download, RefreshCw, ArrowRight, ExternalLink, Link2, Check, ImageOff } from "lucide-react"
import type { CompressedImageResult } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import BeforeAfterSlider from "./BeforeAfterSlider"

interface ImageComparisonViewProps {
  originalImage: File
  compressedResult: CompressedImageResult | null
  isCompressing: boolean
  compressionProgress?: number
  compressionInfo?: string | null
  error: string | null
  onCompress: () => void
  onReset: () => void
  showConvertToJpeg?: boolean
  convertToJpeg?: boolean
  onConvertToJpegChange?: (convert: boolean) => void
}

export default function ImageComparisonView({
  originalImage,
  compressedResult,
  isCompressing,
  compressionProgress = 0,
  compressionInfo = null,
  error,
  onCompress,
  onReset,
  showConvertToJpeg,
  convertToJpeg,
  onConvertToJpegChange,
}: ImageComparisonViewProps) {
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [originalDimensions, setOriginalDimensions] = useState<{ width: number; height: number } | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null)
  const [showDirectLink, setShowDirectLink] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  useEffect(() => {
    if (originalImage) {
      const url = URL.createObjectURL(originalImage)
      setOriginalUrl(url)

      // Get image dimensions
      const img = new Image()
      img.onload = () => {
        setOriginalDimensions({ width: img.width, height: img.height })
      }
      img.src = url

      return () => {
        URL.revokeObjectURL(url)
      }
    }
  }, [originalImage])

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const createDownloadFileName = () => {
    const originalName = originalImage.name
    const lastDotIndex = originalName.lastIndexOf(".")
    const baseName = lastDotIndex !== -1 ? originalName.substring(0, lastDotIndex) : originalName
    const extension = lastDotIndex !== -1 ? originalName.substring(lastDotIndex) : ".jpg"
    return `${baseName}_compressed${extension}`
  }

  const handleCopyUrl = async () => {
    if (!compressedResult || !compressedResult.dataUrl) {
      return
    }

    try {
      await navigator.clipboard.writeText(compressedResult.dataUrl)
      setIsCopied(true)

      // Reset the status after 3 seconds
      setTimeout(() => {
        setIsCopied(false)
      }, 3000)
    } catch (error) {
      console.error("Failed to copy URL:", error)
    }
  }

  const handleDownload = async () => {
    if (!compressedResult || !compressedResult.blob) {
      setDownloadError("No compressed image available to download")
      return
    }

    try {
      setIsDownloading(true)
      setDownloadError(null)
      setDownloadStatus("Starting download process...")

      // Create a new filename with _compressed suffix
      const newFileName = createDownloadFileName()
      setDownloadStatus("Preparing file for download...")

      // Create a blob with the correct MIME type
      const mimeType = originalImage.type || "image/jpeg"
      const blob = new Blob([compressedResult.blob], { type: mimeType })

      // Create a download URL
      const url = URL.createObjectURL(blob)
      setDownloadStatus("Creating download link...")

      // Create and trigger download link
      const a = document.createElement("a")
      a.href = url
      a.download = newFileName
      a.style.display = "none"

      setDownloadStatus("Adding link to document...")
      document.body.appendChild(a)

      setDownloadStatus("Triggering download...")
      a.click()

      // Clean up
      setDownloadStatus("Cleaning up resources...")

      // Use a longer timeout to ensure the download starts before cleanup
      setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        setDownloadStatus("Download complete!")
        setIsDownloading(false)

        // Show direct link option after attempted download
        setShowDirectLink(true)
      }, 1000)
    } catch (error) {
      setDownloadError(`Download failed: ${error instanceof Error ? error.message : "Unknown error"}`)
      setIsDownloading(false)
      // Show direct link option after failed download
      setShowDirectLink(true)
    }
  }

  // Calculate the percentage reduction in file size
  const compressionRatio = compressedResult
    ? ((originalImage.size - compressedResult.blob.size) / originalImage.size) * 100
    : 0

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">
          <span className="bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">
            Image Compression
          </span>
        </h2>
        <Button variant="outline" onClick={onReset}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Start Over
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Original Image */}
        <div className="border rounded-lg overflow-hidden bg-white">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="font-medium">Original Image</h3>
            <div className="text-sm text-gray-500 mt-1">
              {originalDimensions && `${originalDimensions.width} × ${originalDimensions.height} • `}
              {formatFileSize(originalImage.size)}
              {originalImage.type && ` • ${originalImage.type.split("/")[1].toUpperCase()}`}
            </div>
          </div>
          <div className="p-4 flex items-center justify-center bg-gray-100 h-64">
            {originalUrl ? (
              <img
                src={originalUrl || "/placeholder.svg"}
                alt="Original"
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <div className="text-center text-gray-400">
                <ImageOff className="h-8 w-8 mx-auto mb-2" />
                <p>Unable to load original image</p>
              </div>
            )}
          </div>
        </div>

        {/* Compressed Image */}
        <div className="border rounded-lg overflow-hidden bg-white">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="font-medium">Compressed Image</h3>
            {compressedResult ? (
              <div className="text-sm text-gray-500 mt-1">
                {originalDimensions && `${originalDimensions.width} × ${originalDimensions.height} • `}
                {formatFileSize(compressedResult.blob.size)} •{` ${compressionRatio.toFixed(1)}% reduction`}
                {compressedResult.blob.type && ` • ${compressedResult.blob.type.split("/")[1].toUpperCase()}`}
              </div>
            ) : (
              <div className="text-sm text-gray-500 mt-1">Compress to see results</div>
            )}
          </div>
          <div className="p-4 flex items-center justify-center bg-gray-100 h-64">
            {isCompressing ? (
              <div className="text-center w-full px-6">
                <div className="text-sm text-gray-600 mb-2" id="compression-status">
                  Compressing your image...
                </div>
                <Progress
                  value={compressionProgress}
                  className="w-full transition-all duration-700 ease-in-out"
                  aria-labelledby="compression-status"
                  aria-valuenow={Math.round(compressionProgress)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
                <div className="text-xs text-gray-500 mt-1 transition-opacity duration-300" aria-live="polite">
                  {compressionProgress > 0 ? `${Math.round(compressionProgress)}%` : "Getting ready..."}
                </div>
                {compressionInfo && (
                  <div className="text-xs text-gray-600 mt-2 transition-opacity duration-300" aria-live="polite">
                    {compressionInfo}
                  </div>
                )}
              </div>
            ) : compressedResult && originalUrl ? (
              <div className="w-full h-full flex items-center justify-center">
                <BeforeAfterSlider
                  beforeImage={originalUrl}
                  afterImage={compressedResult.dataUrl}
                  className="w-full h-full"
                />
              </div>
            ) : compressedResult ? (
              <img
                src={compressedResult.dataUrl || "/placeholder.svg"}
                alt="Compressed"
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <div className="text-center text-gray-400">
                <ArrowRight className="h-8 w-8 mx-auto mb-2" />
                <p>Click compress to see the result</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" role="alert" aria-live="assertive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {downloadError && (
        <Alert variant="destructive" role="alert" aria-live="assertive">
          <AlertDescription>{downloadError}</AlertDescription>
        </Alert>
      )}

      {downloadStatus && !downloadError && (
        <Alert role="status" aria-live="polite">
          <AlertDescription>{downloadStatus}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
        {!compressedResult && !isCompressing && showConvertToJpeg && (
          <div className="flex items-center mb-4 w-full">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={convertToJpeg || false}
                onChange={(e) => onConvertToJpegChange?.(e.target.checked)}
                aria-label="Convert PNG to JPEG before compression"
              />
              <span className="ml-2 text-sm text-gray-700">
                Convert PNG to JPEG before compression (better for photos, removes transparency)
              </span>
            </label>
          </div>
        )}

        {!compressedResult && !isCompressing && (
          <Button onClick={onCompress} disabled={isCompressing} className="w-full sm:w-auto">
            Compress Image
          </Button>
        )}

        {compressedResult && (
          <>
            {/* Download button (left) */}
            <Button
              onClick={handleDownload}
              className="bg-green-600 hover:bg-green-700 flex items-center w-full sm:w-auto"
              disabled={isDownloading}
              aria-label={isDownloading ? "Downloading compressed image..." : "Download compressed image"}
              aria-busy={isDownloading}
            >
              {isDownloading ? (
                <>
                  <div
                    className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent"
                    aria-hidden="true"
                  ></div>
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                  Download Compressed Image
                </>
              )}
            </Button>

            {/* Save As button (center) */}
            {showDirectLink && compressedResult && compressedResult.dataUrl && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={compressedResult.dataUrl}
                      download={createDownloadFileName()}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 w-full sm:w-auto justify-center"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Open image in new tab to save manually"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" aria-hidden="true" />
                      Right-click and Save As
                    </a>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="bg-[#0a0a0a] text-white rounded-lg p-2 shadow-lg border border-gray-800"
                  >
                    <p>If download button doesn't work, use this alternative method</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Copy URL button (right) with fixed width */}
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleCopyUrl}
                    variant="outline"
                    className="flex items-center justify-center w-full sm:w-[160px]" // Fixed width
                    aria-label={isCopied ? "URL copied to clipboard" : "Copy image URL to clipboard"}
                    aria-pressed={isCopied}
                  >
                    <Link2 className="h-4 w-4 mr-2" aria-hidden="true" />
                    {isCopied ? (
                      <span className="flex items-center">
                        URL Copied! <Check className="h-4 w-4 ml-1 text-green-500" aria-hidden="true" />
                      </span>
                    ) : (
                      "Copy Image URL"
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="bg-[#0a0a0a] text-white rounded-lg p-2 shadow-lg border border-gray-800"
                >
                  <p>Copy the image URL to clipboard</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}
      </div>
    </div>
  )
}
