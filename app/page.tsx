"use client"

import { useState, useEffect } from "react"
import ImageUploader from "@/components/ImageUploader"
import ImageComparisonView from "@/components/ImageComparisonView"
import { JPEGCompressor } from "@/lib/compressors/jpeg/jpeg-compressor"
import { JPEGCompressorAdvanced } from "@/lib/compressors/jpeg/jpeg-compressor-advanced"
import { PNGCompressor } from "@/lib/compressors/png/png-compressor"
import { PNGCompressorAdvanced } from "@/lib/compressors/png/png-compressor-advanced"
import type { CompressedImageResult } from "@/lib/types"
import { convertPngToJpeg } from "@/lib/compressors/png/png-to-jpeg-converter"

/**
 * Standardized compression method labels for consistent UI experience
 */
const COMPRESSION_METHODS = {
  // JPEG compression methods
  JPEG_STANDARD: "Standard JPEG Compression",
  JPEG_ADVANCED: "Advanced JPEG Compression",

  // PNG compression methods
  PNG_STANDARD: "Standard PNG Compression",
  PNG_ADVANCED: "Advanced PNG Compression",

  // Fallback methods
  STANDARD_FALLBACK: "Standard Compression (Fallback)",

  // Conversion methods
  PNG_TO_JPEG: "PNG to JPEG Conversion",

  // Combined methods
  PNG_TO_JPEG_STANDARD: "PNG to JPEG + Standard Compression",
  PNG_TO_JPEG_ADVANCED: "PNG to JPEG + Advanced Compression",
}

/**
 * Main application page component for the client-side image compressor.
 * This component orchestrates the image compression workflow, handling:
 * - Feature detection for advanced compression capabilities
 * - State management for the compression process
 * - Conditional rendering of uploader or comparison view
 * - Error handling and fallback mechanisms
 */
export default function Home() {
  const [originalImage, setOriginalImage] = useState<File | null>(null)
  const [compressedResult, setCompressedResult] = useState<CompressedImageResult | null>(null)
  const [isCompressing, setIsCompressing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [compressionProgress, setCompressionProgress] = useState<number>(0)
  const [supportsAdvancedFeatures, setSupportsAdvancedFeatures] = useState<boolean>(false)
  const [isAdvancedCompression, setIsAdvancedCompression] = useState<boolean>(false)
  const [compressionInfo, setCompressionInfo] = useState<string | null>(null)
  const [compressionMethod, setCompressionMethod] = useState<string | null>(null)
  const [convertToJpeg, setConvertToJpeg] = useState<boolean>(false)
  const [isPngImage, setIsPngImage] = useState<boolean>(false)
  const [isAlreadyOptimized, setIsAlreadyOptimized] = useState<boolean>(false)

  const isImageAlreadyOptimized = (originalSize: number, compressedSize: number): boolean => {
    // Check if there was exactly 0% reduction
    return originalSize === compressedSize
  }

  // Helper function to check and set optimization status
  const checkAndSetOptimizationStatus = (result: CompressedImageResult) => {
    const alreadyOptimized = isImageAlreadyOptimized(originalImage!.size, result.blob.size)
    setIsAlreadyOptimized(alreadyOptimized)
  }

  // Check if the browser supports advanced features needed for WASM-based compression
  useEffect(() => {
    const checkSupport = async () => {
      try {
        // Check if Web Workers are supported for multi-threaded processing
        const hasWorkers = typeof Worker !== "undefined"

        // Check if OffscreenCanvas is supported for off-main-thread rendering
        const hasOffscreenCanvas = typeof OffscreenCanvas !== "undefined"

        const supported = hasWorkers && hasOffscreenCanvas
        console.log(
          `Image compressor: Advanced features support check: Workers: ${hasWorkers}, OffscreenCanvas: ${hasOffscreenCanvas}`,
        )
        setSupportsAdvancedFeatures(supported)
      } catch (error) {
        console.error("Image compressor error: Error checking for advanced features:", error)
        setSupportsAdvancedFeatures(false)
      }
    }

    checkSupport()
  }, [])

  const handleImageUpload = (file: File) => {
    setOriginalImage(file)
    setCompressedResult(null)
    setError(null)
    setCompressionProgress(0)
    setIsAdvancedCompression(false)
    setCompressionInfo(null)
    setCompressionMethod(null)
    setIsPngImage(file.type === "image/png")
    setConvertToJpeg(false) // Reset the convert option when a new image is uploaded
  }

  const handleConvertToJpegChange = (convert: boolean) => {
    setConvertToJpeg(convert)
  }

  /**
   * Handles the image compression process with automatic selection between
   * advanced (worker-based) and simple compression methods.
   *
   * For large images (>1MB), it attempts to use the advanced compressor with
   * Web Workers, falling back to the simple compressor if any errors occur.
   *
   * Includes progress tracking, timeout handling, and comprehensive error management.
   */
  const handleCompress = async () => {
    if (!originalImage) return

    try {
      setIsCompressing(true)
      setError(null)
      setCompressionProgress(0)
      setCompressionInfo(null)
      setCompressionMethod(null)

      // Get the file to process (original or converted)
      let fileToProcess = originalImage
      let conversionApplied = false

      // Check if we need to convert PNG to JPEG
      if (originalImage.type === "image/png" && convertToJpeg) {
        try {
          setCompressionInfo("Converting image format...")
          fileToProcess = await convertPngToJpeg(originalImage)
          conversionApplied = true
          setCompressionProgress(10)
        } catch (conversionError) {
          console.error("Image compressor error: PNG to JPEG conversion failed:", conversionError)
          setCompressionInfo("Using original image format...")
          // Continue with the original PNG file
        }
      }

      // Detect file format of the file to process
      const isJPEG = ["image/jpeg", "image/jpg"].includes(fileToProcess.type)
      const isPNG = fileToProcess.type === "image/png"

      if (!isJPEG && !isPNG) {
        throw new Error(`Unsupported file type: ${fileToProcess.type}. Only JPEG/JPG and PNG files are supported.`)
      }

      // Determine if we should use the advanced implementation
      // Use advanced features for images larger than 1MB
      const isLargeImage = fileToProcess.size > 1 * 1024 * 1024

      if (isPNG) {
        console.log(
          `Image compressor: Processing PNG file ${fileToProcess.name} (${(fileToProcess.size / (1024 * 1024)).toFixed(2)}MB)`,
        )

        // For larger PNG images, attempt to use the advanced worker-based compressor
        if (supportsAdvancedFeatures && isLargeImage) {
          try {
            console.log(
              `Image compressor: Attempting advanced PNG compression for ${fileToProcess.name} (${(fileToProcess.size / (1024 * 1024)).toFixed(2)}MB)`,
            )
            setCompressionInfo("Preparing to compress your image...")

            // Use the advanced PNG compressor
            const compressor = new PNGCompressorAdvanced()

            // Set up a progress tracking function
            const trackProgress = (progress: number) => {
              setCompressionProgress(Math.min(95, progress))
            }

            // Add a timeout for very large images
            const timeoutPromise = new Promise<CompressedImageResult>((_, reject) => {
              // Increase timeout for very large images
              const timeoutMs =
                fileToProcess.size > 15 * 1024 * 1024
                  ? 300000 // 5 minutes for very large images
                  : fileToProcess.size > 8 * 1024 * 1024
                    ? 180000 // 3 minutes for large images
                    : 120000 // 2 minutes for medium images
              setTimeout(() => {
                reject(new Error("Advanced PNG compression timed out, falling back to simple compression"))
              }, timeoutMs)
            })

            // Race the compression against the timeout
            const result = await Promise.race([
              compressor.compress(fileToProcess, {
                onProgress: trackProgress,
                // Increase target size for PNG files to preserve quality
                targetSize: 800 * 1024, // 800KB for better quality - UPDATED VALUE
              }),
              timeoutPromise,
            ])

            setCompressionProgress(100)
            setCompressionInfo("Compression complete!")

            setCompressedResult(result)
            setIsAdvancedCompression(true)
            setCompressionMethod(COMPRESSION_METHODS.PNG_ADVANCED)
            // Check if the image is already optimized
            checkAndSetOptimizationStatus(result)
            console.log("Image compressor: Advanced PNG compression successful")
          } catch (advancedError) {
            console.log("Image compressor: Advanced PNG compression failed, falling back to simple compressor")

            // Reset progress for simple compression
            setCompressionProgress(0)
            setCompressionInfo("Trying alternative compression method...")

            // Fall back to simple compressor
            const compressor = new PNGCompressor()

            // Create a progress tracker for simple compression
            const fallbackProgressTracker = setInterval(() => {
              setCompressionProgress((prev) => {
                // Slowly increment progress to show activity
                if (prev < 90) return prev + 2
                return prev
              })
            }, 500)

            try {
              const result = await compressor.compress(fileToProcess)
              setCompressedResult(result)
              setIsAdvancedCompression(false)
              setCompressionMethod(COMPRESSION_METHODS.STANDARD_FALLBACK)
              // Check if the image is already optimized
              checkAndSetOptimizationStatus(result)
            } catch (fallbackError) {
              console.error("Image compressor error: Both compression methods failed", fallbackError)
              throw new Error("Both advanced and simple PNG compression failed. Please try a different image.")
            } finally {
              // Clear the progress tracker
              clearInterval(fallbackProgressTracker)
              setCompressionProgress(100)
              setCompressionInfo(null)
            }
          }
        } else {
          // Use the simple PNG compressor
          setCompressionInfo("Compressing your image...")
          const compressor = new PNGCompressor()

          // Create a progress tracker for simple compression
          const progressTracker = setInterval(() => {
            setCompressionProgress((prev) => {
              // Slowly increment progress to show activity
              if (prev < 90) return prev + 2
              return prev
            })
          }, 500)

          try {
            const result = await compressor.compress(fileToProcess)
            setCompressedResult(result)
            setIsAdvancedCompression(false)
            setCompressionMethod(COMPRESSION_METHODS.PNG_STANDARD)
            // Check if the image is already optimized
            checkAndSetOptimizationStatus(result)
          } catch (simpleError) {
            console.error("Image compressor error: Standard PNG compression failed:", simpleError)
            throw new Error("PNG compression failed. Please try a different image or format.")
          } finally {
            // Clear the progress tracker
            clearInterval(progressTracker)
            setCompressionProgress(100)
            setCompressionInfo(null)
          }
        }
      } else if (isJPEG) {
        // For JPEG files, add info about conversion if applied
        if (conversionApplied) {
          console.log(
            `Image compressor: Processing converted JPEG file (originally PNG): ${fileToProcess.name} (${(fileToProcess.size / (1024 * 1024)).toFixed(2)}MB)`,
          )
        } else {
          console.log(
            `Image compressor: Processing JPEG file ${fileToProcess.name} (${(fileToProcess.size / (1024 * 1024)).toFixed(2)}MB)`,
          )
        }

        // For larger images, attempt to use the advanced WASM-based compressor
        if (supportsAdvancedFeatures && isLargeImage) {
          try {
            console.log(
              `Image compressor: Attempting advanced compression for ${fileToProcess.name} (${(fileToProcess.size / (1024 * 1024)).toFixed(2)}MB)`,
            )

            // Use the advanced implementation with tiled processing
            const compressor = new JPEGCompressorAdvanced()

            // Create a progress tracker
            let progressCounter = 0
            const progressTracker = setInterval(() => {
              progressCounter += 1
              // Slow down progress for very large images
              const increment = fileToProcess.size > 10 * 1024 * 1024 ? 1 : 2
              const progress = Math.min(progressCounter * increment, 95) // Cap at 95%
              setCompressionProgress(progress)

              // Update compression info
              if (progress < 30) {
                setCompressionInfo("Analyzing your image...")
              } else if (progress < 60) {
                setCompressionInfo("Processing your image...")
              } else {
                setCompressionInfo("Optimizing quality...")
              }
            }, 200)

            // Add a timeout for very large images
            const timeoutPromise = new Promise<CompressedImageResult>((_, reject) => {
              const timeoutMs = fileToProcess.size > 15 * 1024 * 1024 ? 60000 : 30000 // 60s for very large images
              setTimeout(() => {
                reject(new Error("Advanced compression timed out, falling back to simple compression"))
              }, timeoutMs)
            })

            // Race the compression against the timeout
            const result = await Promise.race([compressor.compress(fileToProcess), timeoutPromise])

            // Clear the progress tracker
            clearInterval(progressTracker)
            setCompressionProgress(100)
            setCompressionInfo(null)

            setCompressedResult(result)
            setIsAdvancedCompression(true)

            // Set the appropriate method label based on whether conversion was applied
            if (conversionApplied) {
              setCompressionMethod(COMPRESSION_METHODS.PNG_TO_JPEG_ADVANCED)
            } else {
              setCompressionMethod(COMPRESSION_METHODS.JPEG_ADVANCED)
            }
            // Check if the image is already optimized
            checkAndSetOptimizationStatus(result)

            console.log("Image compressor: Advanced compression successful")
          } catch (advancedError) {
            console.log("Image compressor: Advanced compression failed, falling back to simple compressor")

            // Reset progress for simple compression
            setCompressionProgress(0)
            setCompressionInfo("Trying alternative compression method...")

            // Fall back to simple compressor
            const compressor = new JPEGCompressor()
            const result = await compressor.compress(fileToProcess)
            setCompressedResult(result)
            setIsAdvancedCompression(false)

            // Set the appropriate method label based on whether conversion was applied
            if (conversionApplied) {
              setCompressionMethod(COMPRESSION_METHODS.PNG_TO_JPEG_STANDARD)
            } else {
              setCompressionMethod(COMPRESSION_METHODS.JPEG_STANDARD)
            }
            // Check if the image is already optimized
            checkAndSetOptimizationStatus(result)
          }
        } else {
          // Use the simple compressor for smaller images or when advanced features aren't supported
          console.log("Image compressor: Using simple compressor")
          setCompressionInfo("Compressing your image...")
          const compressor = new JPEGCompressor()

          // Create a progress tracker for simple compression too
          const progressTracker = setInterval(() => {
            setCompressionProgress((prev) => {
              // Slowly increment progress to show activity
              if (prev < 90) return prev + 2
              return prev
            })
          }, 500)

          try {
            const result = await compressor.compress(fileToProcess)
            setCompressedResult(result)
            setIsAdvancedCompression(false)

            // Set the appropriate method label based on whether conversion was applied
            if (conversionApplied) {
              setCompressionMethod(COMPRESSION_METHODS.PNG_TO_JPEG_STANDARD)
            } else {
              setCompressionMethod(COMPRESSION_METHODS.JPEG_STANDARD)
            }
            // Check if the image is already optimized
            checkAndSetOptimizationStatus(result)
          } catch (simpleError) {
            console.error("Image compressor error: Standard JPEG compression failed:", simpleError)
            throw new Error("JPEG compression failed. Please try a different image or format.")
          } finally {
            // Clear the progress tracker
            clearInterval(progressTracker)
            setCompressionProgress(100)
            setCompressionInfo(null)
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred during compression"
      console.error("Image compressor error:", errorMessage)
    } finally {
      setIsCompressing(false)
    }
  }

  /**
   * Resets the application state to allow processing a new image.
   * Clears all state variables related to the current compression process.
   */
  const handleReset = () => {
    setOriginalImage(null)
    setCompressedResult(null)
    setError(null)
    setCompressionProgress(0)
    setIsAdvancedCompression(false)
    setCompressionInfo(null)
    setCompressionMethod(null)
    setIsPngImage(false)
    setConvertToJpeg(false)
    setIsAlreadyOptimized(false)
  }

  // Add a fallback message for browsers that don't support the File API
  useEffect(() => {
    // Check if the browser supports the File API
    if (typeof window !== "undefined" && (!window.File || !window.FileReader || !window.FileList || !window.Blob)) {
      setError("Your browser does not support the File API required for this application to work.")
    }
  }, [])

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            <span className="text-blue-600">
              Image Compressor
            </span>{" "}
            powered by{" "}
            <a
              href="https://valdesio.pages.dev"
              target="_blank"
              className="text-blue-600 transition-transform duration-200 hover:scale-105 inline-block"
            >
              Valdesio
            </a>
          </h1>
          <p className="mt-3 text-lg text-gray-500">
            Compress your JPEG/JPG and PNG images with intelligent size reduction
          </p>
          {supportsAdvancedFeatures && (
            <div
              className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
              role="status"
            >
              Advanced compression enabled
            </div>
          )}
          {compressionMethod && compressedResult && (
            <div
              className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 ml-2"
              role="status"
              aria-live="polite"
            >
              {compressionMethod}
            </div>
          )}
          {isAlreadyOptimized && compressedResult && (
            <div
              className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 ml-2"
              role="status"
              aria-live="polite"
            >
              Already Optimized
            </div>
          )}
        </div>

        {!originalImage ? (
          <ImageUploader onImageUpload={handleImageUpload} />
        ) : (
          <ImageComparisonView
            originalImage={originalImage}
            compressedResult={compressedResult}
            isCompressing={isCompressing}
            compressionProgress={compressionProgress}
            compressionInfo={compressionInfo}
            error={error}
            onCompress={handleCompress}
            onReset={handleReset}
            showConvertToJpeg={isPngImage}
            convertToJpeg={convertToJpeg}
            onConvertToJpegChange={handleConvertToJpegChange}
          />
        )}
      </div>
    </main>
  )
}
