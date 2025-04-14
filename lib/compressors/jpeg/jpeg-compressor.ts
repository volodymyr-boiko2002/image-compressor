import type { ImageCompressor, CompressedImageResult } from "../../types"

/**
 * JPEGCompressor Class
 *
 * A simple, browser-based JPEG image compressor that uses the Canvas API.
 * This compressor works in all modern browsers without requiring WASM or Web Workers.
 *
 * Features:
 * - Binary search algorithm to find optimal compression quality
 * - Automatic downscaling for very large images to prevent memory issues
 * - Target file size of 100KB with adjustable quality
 * - Fallback option for the advanced compressor
 */
export class JPEGCompressor implements ImageCompressor {
  supportedTypes = ["image/jpeg", "image/jpg"]

  private readonly TARGET_SIZE = 100 * 1024 // 100KB in bytes
  private readonly MIN_QUALITY = 0.1
  private readonly MAX_QUALITY = 0.95
  private readonly QUALITY_PRECISION = 0.01

  /**
   * Compresses a JPEG image to meet the target file size while maintaining
   * the best possible quality. Uses a binary search algorithm to find the
   * optimal compression quality.
   *
   * @param file - The JPEG file to compress
   * @returns Promise<CompressedImageResult> - The compressed image data
   */
  async compress(file: File): Promise<CompressedImageResult> {
    if (!this.supportedTypes.includes(file.type)) {
      throw new Error("Unsupported file type. Only JPEG/JPG files are supported.")
    }

    // If the file is already under target size, return it as is
    if (file.size <= this.TARGET_SIZE) {
      const dataUrl = await this.fileToDataURL(file)
      return {
        blob: file,
        dataUrl,
        quality: 1.0,
      }
    }

    // Load the image
    const img = await this.createImageFromFile(file)

    // For large images, scale down to prevent memory issues
    let width = img.width
    let height = img.height

    // If the image is extremely large, scale it down for processing
    const isLargeImage = file.size > 5 * 1024 * 1024 // 5MB
    if (isLargeImage && (width > 3000 || height > 3000)) {
      console.log(`Simple JPEG compressor: Processing large image (${width}x${height}), applying downscaling`)
      const MAX_DIMENSION = 2000
      const scale = MAX_DIMENSION / Math.max(width, height)
      width = Math.round(width * scale)
      height = Math.round(height * scale)
    }

    // Create a canvas with the dimensions
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext("2d")
    if (!ctx) {
      throw new Error("Could not get canvas context")
    }

    // Draw the image on the canvas
    ctx.drawImage(img, 0, 0, width, height)

    // Use binary search to find the optimal quality that meets the target size
    // This efficiently narrows down the quality range with each iteration
    let minQuality = this.MIN_QUALITY
    let maxQuality = this.MAX_QUALITY
    let bestQuality = maxQuality
    let bestBlob: Blob | null = null
    let bestDataUrl: string | null = null

    while (maxQuality - minQuality > this.QUALITY_PRECISION) {
      const midQuality = (minQuality + maxQuality) / 2

      // Get blob at current quality
      const { blob, dataUrl } = await this.canvasToBlob(canvas, midQuality)

      if (blob.size <= this.TARGET_SIZE) {
        // This quality works, try to increase quality
        bestQuality = midQuality
        bestBlob = blob
        bestDataUrl = dataUrl
        minQuality = midQuality
      } else {
        // Too large, decrease quality
        maxQuality = midQuality
      }
    }

    // If we couldn't find a suitable quality
    if (!bestBlob || !bestDataUrl) {
      // Try with the minimum quality as a last resort
      const { blob, dataUrl } = await this.canvasToBlob(canvas, this.MIN_QUALITY)

      if (blob.size <= this.TARGET_SIZE) {
        bestBlob = blob
        bestDataUrl = dataUrl
        bestQuality = this.MIN_QUALITY
      } else {
        throw new Error("Could not compress image to target size")
      }
    }

    return {
      blob: bestBlob,
      dataUrl: bestDataUrl,
      quality: bestQuality,
    }
  }

  /**
   * Helper methods for file processing and conversion
   */

  /**
   * Converts a File object to a data URL for preview
   */
  private fileToDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  /**
   * Creates an HTMLImageElement from a File for canvas processing
   */
  private createImageFromFile(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = URL.createObjectURL(file)
      img.crossOrigin = "anonymous" // Avoid CORS issues with canvas
    })
  }

  /**
   * Converts a canvas to a Blob and data URL at a specified quality
   */
  private canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<{ blob: Blob; dataUrl: string }> {
    return new Promise((resolve, reject) => {
      // First get the data URL
      const dataUrl = canvas.toDataURL("image/jpeg", quality)

      // Then get the blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            // Create a new blob with the correct MIME type to ensure proper download
            const properBlob = new Blob([blob], { type: "image/jpeg" })
            resolve({ blob: properBlob, dataUrl })
          } else {
            reject(new Error("Canvas to Blob conversion failed"))
          }
        },
        "image/jpeg",
        quality,
      )
    })
  }
}
