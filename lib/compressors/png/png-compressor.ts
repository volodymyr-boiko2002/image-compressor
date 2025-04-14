import type { ImageCompressor, CompressedImageResult } from "../../types"

/**
 * Enhanced PNGCompressor with Specialized Techniques
 *
 * Optimized for maximum file size reduction while preserving visual quality.
 * Uses specialized techniques for different image types with particular focus
 * on line art, illustrations, and images with limited color palettes.
 */
export class PNGCompressor implements ImageCompressor {
  supportedTypes = ["image/png"]

  // Target size with reasonable balance between quality and compression
  private readonly TARGET_SIZE = 200 * 1024 // 200KB target
  private readonly MIN_QUALITY = 0.5
  private readonly MAX_QUALITY = 0.9

  /**
   * Main compression method
   */
  async compress(file: File): Promise<CompressedImageResult> {
    if (!this.supportedTypes.includes(file.type)) {
      throw new Error("Unsupported file type. Only PNG files are supported.")
    }

    console.log(`PNG compressor: Processing file ${file.name} (${(file.size / 1024).toFixed(1)}KB)`)

    // If already under target size, return as is
    if (file.size <= this.TARGET_SIZE) {
      console.log(`PNG compressor: File already under target size, no compression needed`)
      const dataUrl = await this.fileToDataURL(file)
      return { blob: file, dataUrl, quality: 1.0 }
    }

    // Load the image
    const img = await this.createImageFromFile(file)
    const { width, height } = img
    console.log(`PNG compressor: Original dimensions ${width}x${height}`)

    // Analyze image to determine best compression strategy
    const imageType = await this.analyzeImageType(img)
    console.log(`PNG compressor: Image analyzed as ${imageType} type`)

    // Apply the appropriate compression strategy based on image type
    switch (imageType) {
      case "lineart":
        return this.compressLineArt(img, file.size)
      case "photographic":
        return this.compressPhotographicPNG(img, file.size)
      case "graphical":
        return this.compressGraphicalPNG(img, file.size)
      case "mixed":
      default:
        return this.compressHybridPNG(img, file.size)
    }
  }

  /**
   * Analyzes the image to determine its type for optimal compression
   */
  private async analyzeImageType(img: HTMLImageElement): Promise<"lineart" | "photographic" | "graphical" | "mixed"> {
    // Create a small canvas for analysis
    const sampleSize = Math.min(img.width, img.height, 300)
    const canvas = document.createElement("canvas")
    canvas.width = sampleSize
    canvas.height = sampleSize
    const ctx = canvas.getContext("2d", { alpha: true })
    if (!ctx) throw new Error("Could not get canvas context")

    // Draw a sample of the image
    ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, sampleSize, sampleSize)

    // Get image data
    const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize)
    const data = imageData.data

    // Analyze color distribution and edges
    const uniqueColors = new Set<string>()
    let edgeCount = 0
    let transparentPixels = 0
    let blackPixels = 0
    let whitePixels = 0
    let grayPixels = 0
    let coloredPixels = 0

    // Sample pixels (skip some for performance)
    const stride = Math.max(1, Math.floor(sampleSize / 50))
    const totalSampledPixels = Math.floor(sampleSize / stride) * Math.floor(sampleSize / stride)

    for (let y = 0; y < sampleSize; y += stride) {
      for (let x = 0; x < sampleSize; x += stride) {
        const i = (y * sampleSize + x) * 4

        // Check for transparency
        if (data[i + 3] < 255) {
          transparentPixels++
          if (data[i + 3] === 0) continue // Skip fully transparent pixels
        }

        // Check for black, white, or gray pixels
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]

        // Is it black (or very dark)?
        if (r < 30 && g < 30 && b < 30) {
          blackPixels++
        }
        // Is it white (or very light)?
        else if (r > 225 && g > 225 && b > 225) {
          whitePixels++
        }
        // Is it gray? (r, g, b values are close to each other)
        else if (Math.abs(r - g) < 20 && Math.abs(r - b) < 20 && Math.abs(g - b) < 20) {
          grayPixels++
        } else {
          coloredPixels++
        }

        // Add color to unique set (with reduced precision)
        const colorKey = `${Math.floor(r / 5)},${Math.floor(g / 5)},${Math.floor(b / 5)}`
        uniqueColors.add(colorKey)

        // Check for edges (high contrast between adjacent pixels)
        if (x < sampleSize - stride && y < sampleSize - stride) {
          const rightIdx = (y * sampleSize + (x + stride)) * 4
          const bottomIdx = ((y + stride) * sampleSize + x) * 4

          const colorDiff1 =
            Math.abs(data[i] - data[rightIdx]) +
            Math.abs(data[i + 1] - data[rightIdx + 1]) +
            Math.abs(data[i + 2] - data[rightIdx + 2])

          const colorDiff2 =
            Math.abs(data[i] - data[bottomIdx]) +
            Math.abs(data[i + 1] - data[bottomIdx + 1]) +
            Math.abs(data[i + 2] - data[bottomIdx + 2])

          if (colorDiff1 > 100 || colorDiff2 > 100) {
            edgeCount++
          }
        }
      }
    }

    // Calculate metrics
    const colorRatio = uniqueColors.size / totalSampledPixels
    const edgeRatio = edgeCount / totalSampledPixels
    const blackWhiteRatio = (blackPixels + whitePixels) / totalSampledPixels
    const grayRatio = grayPixels / totalSampledPixels
    const hasTransparency = transparentPixels > 0

    // Determine if this is line art (black/white/gray with high contrast edges)
    if ((blackWhiteRatio > 0.8 || blackWhiteRatio + grayRatio > 0.9) && edgeRatio > 0.05) {
      return "lineart"
    }
    // Determine image type
    else if (colorRatio > 0.5 && edgeRatio < 0.1) {
      return "photographic" // Smooth gradients, many colors, few edges
    } else if (colorRatio < 0.2 || edgeRatio > 0.2 || hasTransparency) {
      return "graphical" // Few colors or many edges or has transparency
    } else {
      return "mixed" // Mix of both characteristics
    }
  }

  /**
   * Specialized compression for line art images
   * Optimized for images with limited color palette and high contrast edges
   */
  private async compressLineArt(img: HTMLImageElement, originalSize: number): Promise<CompressedImageResult> {
    console.log("PNG compressor: Using specialized line art compression strategy")

    // Create a canvas with original dimensions
    const canvas = document.createElement("canvas")
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext("2d", { alpha: true })
    if (!ctx) throw new Error("Could not get canvas context")

    // Draw the image
    ctx.drawImage(img, 0, 0)

    // Get image data
    const imageData = ctx.getImageData(0, 0, img.width, img.height)
    const data = imageData.data

    // Apply specialized line art optimization
    this.optimizeLineArt(data)

    // Put the processed image data back
    ctx.putImageData(imageData, 0, 0)

    // Try different quality levels
    const qualityLevels = [0.7, 0.5, 0.3, 0.2, 0.1]

    for (const quality of qualityLevels) {
      const { blob, dataUrl } = await this.canvasToBlob(canvas, quality)

      // Check if we've achieved significant reduction (at least 40%)
      if (blob.size <= originalSize * 0.6) {
        console.log(
          `PNG compressor: Achieved ${((1 - blob.size / originalSize) * 100).toFixed(1)}% reduction with quality ${quality}`,
        )
        return { blob, dataUrl, quality }
      }
    }

    // If we couldn't achieve 40% reduction, try more aggressive optimization
    this.optimizeLineArtAggressively(data)
    ctx.putImageData(imageData, 0, 0)

    for (const quality of qualityLevels) {
      const { blob, dataUrl } = await this.canvasToBlob(canvas, quality)

      if (blob.size <= originalSize * 0.6) {
        console.log(
          `PNG compressor: Achieved ${((1 - blob.size / originalSize) * 100).toFixed(1)}% reduction with aggressive optimization`,
        )
        return { blob, dataUrl, quality }
      }
    }

    // Last resort: use the smallest result we got
    const { blob, dataUrl } = await this.canvasToBlob(canvas, 0.1)
    console.log(
      `PNG compressor: Using minimum quality compression with ${((1 - blob.size / originalSize) * 100).toFixed(1)}% reduction`,
    )
    return { blob, dataUrl, quality: 0.1 }
  }

  /**
   * Specialized optimization for line art
   * Reduces colors while preserving edges and line quality
   */
  private optimizeLineArt(data: Uint8ClampedArray): void {
    // For line art, we want to:
    // 1. Make the background pure black
    // 2. Quantize the line colors to a few shades
    // 3. Preserve edge sharpness

    // Define thresholds for black and white
    const BLACK_THRESHOLD = 30
    const WHITE_THRESHOLD = 200
    const GRAY_LEVELS = 4 // Number of gray levels to preserve

    for (let i = 0; i < data.length; i += 4) {
      // Skip fully transparent pixels
      if (data[i + 3] === 0) continue

      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]

      // Check if pixel is dark (background)
      if (r < BLACK_THRESHOLD && g < BLACK_THRESHOLD && b < BLACK_THRESHOLD) {
        // Make it pure black
        data[i] = 0
        data[i + 1] = 0
        data[i + 2] = 0
        continue
      }

      // Check if pixel is very light
      if (r > WHITE_THRESHOLD && g > WHITE_THRESHOLD && b > WHITE_THRESHOLD) {
        // Make it pure white
        data[i] = 255
        data[i + 1] = 255
        data[i + 2] = 255
        continue
      }

      // For gray pixels, quantize to a few levels
      if (Math.abs(r - g) < 20 && Math.abs(r - b) < 20 && Math.abs(g - b) < 20) {
        // Calculate gray level (0-255)
        const grayLevel = Math.round((r + g + b) / 3)

        // Quantize to one of GRAY_LEVELS levels
        const quantizedGray = Math.round(grayLevel / (255 / (GRAY_LEVELS - 1))) * (255 / (GRAY_LEVELS - 1))

        data[i] = quantizedGray
        data[i + 1] = quantizedGray
        data[i + 2] = quantizedGray
        continue
      }

      // For colored pixels, reduce color depth
      data[i] = Math.round(r / 32) * 32
      data[i + 1] = Math.round(g / 32) * 32
      data[i + 2] = Math.round(b / 32) * 32
    }
  }

  /**
   * More aggressive optimization for line art
   * Further reduces colors for maximum compression
   */
  private optimizeLineArtAggressively(data: Uint8ClampedArray): void {
    // For aggressive optimization, we:
    // 1. Make the background pure black
    // 2. Reduce to just 2-3 shades for the lines
    // 3. Binarize alpha channel

    // Define thresholds
    const BLACK_THRESHOLD = 40
    const GRAY_THRESHOLD = 150

    for (let i = 0; i < data.length; i += 4) {
      // Make alpha channel binary
      data[i + 3] = data[i + 3] < 128 ? 0 : 255

      // Skip fully transparent pixels
      if (data[i + 3] === 0) continue

      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const brightness = (r + g + b) / 3

      // Make dark pixels pure black
      if (brightness < BLACK_THRESHOLD) {
        data[i] = 0
        data[i + 1] = 0
        data[i + 2] = 0
        continue
      }

      // Reduce to just 2-3 shades
      if (brightness < GRAY_THRESHOLD) {
        // Mid gray
        data[i] = 128
        data[i + 1] = 128
        data[i + 2] = 128
      } else {
        // White/light
        data[i] = 255
        data[i + 1] = 255
        data[i + 2] = 255
      }
    }
  }

  /**
   * Compresses photographic PNG images
   * These typically have smooth gradients and many colors
   */
  private async compressPhotographicPNG(img: HTMLImageElement, originalSize: number): Promise<CompressedImageResult> {
    console.log("PNG compressor: Using photographic compression strategy")

    // Create a canvas with original dimensions
    const canvas = document.createElement("canvas")
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext("2d", { alpha: true })
    if (!ctx) throw new Error("Could not get canvas context")

    // Draw the image
    ctx.drawImage(img, 0, 0)

    // Get image data
    const imageData = ctx.getImageData(0, 0, img.width, img.height)
    const data = imageData.data

    // Apply color reduction optimized for photos
    this.reduceColorsForPhotographic(data)

    // Put the processed image data back
    ctx.putImageData(imageData, 0, 0)

    // Try different quality levels
    const qualityLevels = [0.8, 0.7, 0.6, 0.5, 0.4]

    for (const quality of qualityLevels) {
      const { blob, dataUrl } = await this.canvasToBlob(canvas, quality)

      // Check if we've achieved meaningful reduction (at least 15%)
      if (blob.size <= originalSize * 0.85) {
        console.log(
          `PNG compressor: Achieved ${((1 - blob.size / originalSize) * 100).toFixed(1)}% reduction with quality ${quality}`,
        )
        return { blob, dataUrl, quality }
      }
    }

    // If we couldn't achieve 15% reduction, accept 5% reduction
    for (const quality of qualityLevels) {
      const { blob, dataUrl } = await this.canvasToBlob(canvas, quality)

      if (blob.size <= originalSize * 0.95) {
        console.log(
          `PNG compressor: Achieved ${((1 - blob.size / originalSize) * 100).toFixed(1)}% reduction with quality ${quality}`,
        )
        return { blob, dataUrl, quality }
      }
    }

    // Last resort: use the smallest result we got
    const { blob, dataUrl } = await this.canvasToBlob(canvas, 0.4)
    console.log(
      `PNG compressor: Using minimum quality compression with ${((1 - blob.size / originalSize) * 100).toFixed(1)}% reduction`,
    )
    return { blob, dataUrl, quality: 0.4 }
  }

  /**
   * Compresses graphical PNG images
   * These typically have few colors, sharp edges, text, or transparency
   */
  private async compressGraphicalPNG(img: HTMLImageElement, originalSize: number): Promise<CompressedImageResult> {
    console.log("PNG compressor: Using graphical compression strategy")

    // Create a canvas with original dimensions
    const canvas = document.createElement("canvas")
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext("2d", { alpha: true })
    if (!ctx) throw new Error("Could not get canvas context")

    // Draw the image
    ctx.drawImage(img, 0, 0)

    // Get image data
    const imageData = ctx.getImageData(0, 0, img.width, img.height)
    const data = imageData.data

    // Apply color reduction optimized for graphics
    this.reduceColorsForGraphical(data)

    // Put the processed image data back
    ctx.putImageData(imageData, 0, 0)

    // Try different quality levels
    const qualityLevels = [0.9, 0.8, 0.7, 0.6, 0.5]

    for (const quality of qualityLevels) {
      const { blob, dataUrl } = await this.canvasToBlob(canvas, quality)

      // Check if we've achieved meaningful reduction (at least 20%)
      if (blob.size <= originalSize * 0.8) {
        console.log(
          `PNG compressor: Achieved ${((1 - blob.size / originalSize) * 100).toFixed(1)}% reduction with quality ${quality}`,
        )
        return { blob, dataUrl, quality }
      }
    }

    // If we couldn't achieve 20% reduction, accept 10% reduction
    for (const quality of qualityLevels) {
      const { blob, dataUrl } = await this.canvasToBlob(canvas, quality)

      if (blob.size <= originalSize * 0.9) {
        console.log(
          `PNG compressor: Achieved ${((1 - blob.size / originalSize) * 100).toFixed(1)}% reduction with quality ${quality}`,
        )
        return { blob, dataUrl, quality }
      }
    }

    // Last resort: use the smallest result we got
    const { blob, dataUrl } = await this.canvasToBlob(canvas, 0.5)
    console.log(
      `PNG compressor: Using minimum quality compression with ${((1 - blob.size / originalSize) * 100).toFixed(1)}% reduction`,
    )
    return { blob, dataUrl, quality: 0.5 }
  }

  /**
   * Compresses mixed-content PNG images
   * These have characteristics of both photographic and graphical images
   */
  private async compressHybridPNG(img: HTMLImageElement, originalSize: number): Promise<CompressedImageResult> {
    console.log("PNG compressor: Using hybrid compression strategy")

    // Create a canvas with original dimensions
    const canvas = document.createElement("canvas")
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext("2d", { alpha: true })
    if (!ctx) throw new Error("Could not get canvas context")

    // Draw the image
    ctx.drawImage(img, 0, 0)

    // Get image data
    const imageData = ctx.getImageData(0, 0, img.width, img.height)
    const data = imageData.data

    // Apply adaptive color reduction
    this.reduceColorsAdaptive(data, img.width, img.height)

    // Put the processed image data back
    ctx.putImageData(imageData, 0, 0)

    // Try different quality levels
    const qualityLevels = [0.85, 0.75, 0.65, 0.55, 0.45]

    for (const quality of qualityLevels) {
      const { blob, dataUrl } = await this.canvasToBlob(canvas, quality)

      // Check if we've achieved meaningful reduction (at least 15%)
      if (blob.size <= originalSize * 0.85) {
        console.log(
          `PNG compressor: Achieved ${((1 - blob.size / originalSize) * 100).toFixed(1)}% reduction with quality ${quality}`,
        )
        return { blob, dataUrl, quality }
      }
    }

    // If we couldn't achieve 15% reduction, try more aggressive color reduction
    this.reduceColorsAggressively(data)
    ctx.putImageData(imageData, 0, 0)

    for (const quality of qualityLevels) {
      const { blob, dataUrl } = await this.canvasToBlob(canvas, quality)

      if (blob.size <= originalSize * 0.85) {
        console.log(
          `PNG compressor: Achieved ${((1 - blob.size / originalSize) * 100).toFixed(1)}% reduction with aggressive color reduction`,
        )
        return { blob, dataUrl, quality }
      }
    }

    // Last resort: try downscaling slightly
    const scaleFactor = 0.9
    const downscaledCanvas = document.createElement("canvas")
    downscaledCanvas.width = Math.floor(img.width * scaleFactor)
    downscaledCanvas.height = Math.floor(img.height * scaleFactor)
    const downscaledCtx = downscaledCanvas.getContext("2d", { alpha: true })
    if (!downscaledCtx) throw new Error("Could not get downscaled canvas context")

    // Draw with high quality
    downscaledCtx.imageSmoothingEnabled = true
    downscaledCtx.imageSmoothingQuality = "high"
    downscaledCtx.drawImage(img, 0, 0, downscaledCanvas.width, downscaledCanvas.height)

    // Apply color reduction
    const downscaledImageData = downscaledCtx.getImageData(0, 0, downscaledCanvas.width, downscaledCanvas.height)
    this.reduceColorsAdaptive(downscaledImageData.data, downscaledCanvas.width, downscaledCanvas.height)
    downscaledCtx.putImageData(downscaledImageData, 0, 0)

    // Try with downscaled image
    const { blob, dataUrl } = await this.canvasToBlob(downscaledCanvas, 0.7)
    console.log(
      `PNG compressor: Using downscaled image with ${((1 - blob.size / originalSize) * 100).toFixed(1)}% reduction`,
    )
    return { blob, dataUrl, quality: 0.7 }
  }

  /**
   * Reduces colors for photographic images
   * Preserves smooth gradients while reducing unique colors
   */
  private reduceColorsForPhotographic(data: Uint8ClampedArray): void {
    // For photographic images, use gentle quantization
    // that preserves gradients but reduces unique colors
    const quantizationLevel = 4 // Adjust color values to multiples of this

    for (let i = 0; i < data.length; i += 4) {
      // Skip fully transparent pixels
      if (data[i + 3] === 0) continue

      // Quantize RGB channels
      data[i] = Math.floor(data[i] / quantizationLevel) * quantizationLevel
      data[i + 1] = Math.floor(data[i + 1] / quantizationLevel) * quantizationLevel
      data[i + 2] = Math.floor(data[i + 2] / quantizationLevel) * quantizationLevel

      // Make alpha channel binary (fully transparent or fully opaque)
      data[i + 3] = data[i + 3] < 128 ? 0 : 255
    }
  }

  /**
   * Reduces colors for graphical images
   * Preserves sharp edges and text clarity
   */
  private reduceColorsForGraphical(data: Uint8ClampedArray): void {
    // For graphical images, use more aggressive quantization
    // but preserve sharp edges
    const quantizationLevel = 8 // Adjust color values to multiples of this

    for (let i = 0; i < data.length; i += 4) {
      // Skip fully transparent pixels
      if (data[i + 3] === 0) continue

      // Quantize RGB channels
      data[i] = Math.floor(data[i] / quantizationLevel) * quantizationLevel
      data[i + 1] = Math.floor(data[i + 1] / quantizationLevel) * quantizationLevel
      data[i + 2] = Math.floor(data[i + 2] / quantizationLevel) * quantizationLevel

      // Make alpha channel binary (fully transparent or fully opaque)
      data[i + 3] = data[i + 3] < 128 ? 0 : 255
    }
  }

  /**
   * Reduces colors adaptively based on local image characteristics
   */
  private reduceColorsAdaptive(data: Uint8ClampedArray, width: number, height: number): void {
    // Create an edge detection map
    const edgeMap = new Uint8Array(width * height)

    // Detect edges
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4
        const leftIdx = (y * width + (x - 1)) * 4
        const rightIdx = (y * width + (x + 1)) * 4
        const topIdx = ((y - 1) * width + x) * 4
        const bottomIdx = ((y + 1) * width + x) * 4

        // Skip transparent pixels
        if (data[idx + 3] < 128) continue

        // Calculate color differences with neighbors
        const leftDiff =
          Math.abs(data[idx] - data[leftIdx]) +
          Math.abs(data[idx + 1] - data[leftIdx + 1]) +
          Math.abs(data[idx + 2] - data[leftIdx + 2])

        const rightDiff =
          Math.abs(data[idx] - data[rightIdx]) +
          Math.abs(data[idx + 1] - data[rightIdx + 1]) +
          Math.abs(data[idx + 2] - data[rightIdx + 2])

        const topDiff =
          Math.abs(data[idx] - data[topIdx]) +
          Math.abs(data[idx + 1] - data[topIdx + 1]) +
          Math.abs(data[idx + 2] - data[topIdx + 2])

        const bottomDiff =
          Math.abs(data[idx] - data[bottomIdx]) +
          Math.abs(data[idx + 1] - data[bottomIdx + 1]) +
          Math.abs(data[idx + 2] - data[bottomIdx + 2])

        // Mark as edge if high contrast with any neighbor
        const maxDiff = Math.max(leftDiff, rightDiff, topDiff, bottomDiff)
        edgeMap[y * width + x] = maxDiff > 100 ? 255 : 0
      }
    }

    // Apply adaptive quantization based on edge map
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4

        // Skip fully transparent pixels
        if (data[i + 3] === 0) continue

        // Check if this is an edge pixel
        const isEdge = edgeMap[y * width + x] > 0

        // Use different quantization levels based on whether it's an edge
        const quantizationLevel = isEdge ? 2 : 6

        // Quantize RGB channels
        data[i] = Math.floor(data[i] / quantizationLevel) * quantizationLevel
        data[i + 1] = Math.floor(data[i + 1] / quantizationLevel) * quantizationLevel
        data[i + 2] = Math.floor(data[i + 2] / quantizationLevel) * quantizationLevel

        // Make alpha channel binary
        data[i + 3] = data[i + 3] < 128 ? 0 : 255
      }
    }
  }

  /**
   * Reduces colors aggressively as a last resort
   */
  private reduceColorsAggressively(data: Uint8ClampedArray): void {
    // Use more aggressive quantization
    const quantizationLevel = 16

    for (let i = 0; i < data.length; i += 4) {
      // Skip fully transparent pixels
      if (data[i + 3] === 0) continue

      // Quantize RGB channels more aggressively
      data[i] = Math.floor(data[i] / quantizationLevel) * quantizationLevel
      data[i + 1] = Math.floor(data[i + 1] / quantizationLevel) * quantizationLevel
      data[i + 2] = Math.floor(data[i + 2] / quantizationLevel) * quantizationLevel

      // Make alpha channel binary
      data[i + 3] = data[i + 3] < 128 ? 0 : 255
    }
  }

  /**
   * Helper methods for file processing and conversion
   */
  private fileToDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  private createImageFromFile(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = URL.createObjectURL(file)
      img.crossOrigin = "anonymous" // Avoid CORS issues with canvas
    })
  }

  private canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<{ blob: Blob; dataUrl: string }> {
    return new Promise((resolve, reject) => {
      // First get the data URL
      const dataUrl = canvas.toDataURL("image/png", quality)

      // Then get the blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const properBlob = new Blob([blob], { type: "image/png" })
            resolve({ blob: properBlob, dataUrl })
          } else {
            reject(new Error("Canvas to Blob conversion failed"))
          }
        },
        "image/png",
        quality,
      )
    })
  }
}
