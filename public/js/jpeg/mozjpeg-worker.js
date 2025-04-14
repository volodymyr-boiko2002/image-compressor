/**
 * MozJPEG WASM Worker
 *
 * A Web Worker that handles JPEG compression using the MozJPEG WASM module.
 * This worker offloads compression tasks from the main thread to prevent UI freezing.
 *
 * Features:
 * - WASM-based compression using MozJPEG
 * - Progressive JPEG encoding support
 * - Tiled processing for large images
 * - Binary search for optimal quality
 * - Fallback mechanisms for environments without WASM support
 */

// Constants for compression quality range and precision
const MIN_QUALITY = 0.1
const MAX_QUALITY = 0.95
const QUALITY_PRECISION = 0.01

// State to track if the module is loaded
let MozJPEGModule = null
let MozJPEGEncoder = null
let isModuleLoading = false
let moduleLoadPromise = null

/**
 * Main message handler for the worker
 * Processes different message types:
 * - heartbeat: Simple ping to check if worker is alive
 * - init: Initialize the MozJPEG module
 * - processTile: Process a single image tile (for tiled compression)
 * - compressProgressive: Compress using progressive JPEG encoding
 * - compress: Standard compression with quality optimization
 */
self.addEventListener("message", async (event) => {
  const {
    type,
    imageData,
    targetSize,
    quality,
    isLargeFile,
    tile,
    heartbeat,
    preserveOriginalDimensions,
    width,
    height,
  } = event.data

  // Respond to heartbeat messages immediately
  if (type === "heartbeat") {
    self.postMessage({ type: "heartbeat" })
    return
  }

  if (type === "init") {
    // Initialize the module
    try {
      await loadMozJPEGModule()
      self.postMessage({ type: "ready" })
    } catch (error) {
      console.error("Failed to initialize MozJPEG module:", error)
      self.postMessage({
        type: "error",
        error: `Failed to initialize MozJPEG module: ${error.message || "Unknown error"}`,
      })
    }
    return
  }

  if (type === "processTile") {
    try {
      // Process a single tile
      // Make sure the module is loaded
      if (!MozJPEGEncoder) {
        try {
          await loadMozJPEGModule()
        } catch (error) {
          console.error("Failed to load MozJPEG module:", error)
          self.postMessage({
            type: "tileError",
            error: `Failed to load MozJPEG module: ${error.message || "Unknown error"}`,
            tile,
          })
          return
        }
      }

      // Convert ArrayBuffer to ImageData
      const imageDataObj = new ImageData(new Uint8ClampedArray(imageData), tile.width, tile.height)

      // Compress the tile with MozJPEG
      const mozJpegQuality = Math.round(quality * 100)
      const encoder = await MozJPEGEncoder.create()

      const compressedData = await encoder.encode(imageDataObj.data, {
        width: tile.width,
        height: tile.height,
        quality: mozJpegQuality,
        baseline: true,
        progressive: true,
        optimize_coding: true,
      })

      // Send the compressed tile back
      self.postMessage({
        type: "tileResult",
        tile,
        compressedData,
      })
    } catch (error) {
      console.error("Worker tile processing error:", error)
      self.postMessage({
        type: "tileError",
        error: error instanceof Error ? error.message : "Unknown error during tile processing",
        tile,
      })
    }
    return
  }

  if (type === "compressProgressive") {
    try {
      // Compress with progressive JPEG encoding
      // Make sure the module is loaded
      if (!MozJPEGEncoder) {
        try {
          await loadMozJPEGModule()
        } catch (error) {
          console.error("Failed to load MozJPEG module:", error)
          self.postMessage({
            type: "error",
            error: `Failed to load MozJPEG module: ${error.message || "Unknown error"}`,
          })
          return
        }
      }

      // Convert ArrayBuffer to Blob
      const blob = new Blob([imageData], { type: "image/jpeg" })

      // Create an image bitmap
      const imageBitmap = await createImageBitmap(blob)

      // Create a canvas with the original dimensions
      const canvas = new OffscreenCanvas(width, height)
      const ctx = canvas.getContext("2d")

      // Draw the image
      ctx.drawImage(imageBitmap, 0, 0)

      // Get the image data
      const imgData = ctx.getImageData(0, 0, width, height)

      // Initialize MozJPEG encoder
      const encoder = await MozJPEGEncoder.create()

      // Try different qualities with progressive encoding
      let bestQuality = MIN_QUALITY
      let bestData = null
      let bestSize = Number.POSITIVE_INFINITY

      // Try a few quality levels
      const qualityLevels = [0.7, 0.5, 0.3, 0.1]

      for (const quality of qualityLevels) {
        const mozJpegQuality = Math.round(quality * 100)

        // Encode with progressive settings
        const compressedData = await encoder.encode(imgData.data, {
          width: width,
          height: height,
          quality: mozJpegQuality,
          baseline: false,
          arithmetic: false,
          progressive: true,
          optimize_coding: true,
          smoothing: 0,
          color_space: 3 /*YCbCr*/,
          quant_table: 3,
          trellis_multipass: true,
          trellis_opt_zero: true,
          trellis_opt_table: true,
          trellis_loops: 10,
          auto_subsample: true,
          chroma_subsample: 2,
          separate_chroma_quality: false,
          chroma_quality: mozJpegQuality,
        })

        // Check if this meets our target size
        if (compressedData.byteLength <= targetSize && quality > bestQuality) {
          bestQuality = quality
          bestData = compressedData
          bestSize = compressedData.byteLength
        }

        // If we're already under target size, no need to try lower qualities
        if (compressedData.byteLength <= targetSize) {
          break
        }
      }

      // If we found a suitable quality
      if (bestData) {
        // Create a blob from the compressed data
        const compressedBlob = new Blob([bestData], { type: "image/jpeg" })

        // Convert to data URL for preview
        const dataUrl = await blobToDataURL(compressedBlob)

        // Send the result back
        self.postMessage({
          type: "result",
          data: {
            blob: compressedBlob,
            dataUrl,
            quality: bestQuality,
          },
        })
      } else {
        // If we couldn't meet the target size, use the smallest result
        const mozJpegQuality = Math.round(MIN_QUALITY * 100)

        // Encode with progressive settings and minimum quality
        const compressedData = await encoder.encode(imgData.data, {
          width: width,
          height: height,
          quality: mozJpegQuality,
          baseline: false,
          progressive: true,
          optimize_coding: true,
        })

        // Create a blob from the compressed data
        const compressedBlob = new Blob([compressedData], { type: "image/jpeg" })

        // Convert to data URL for preview
        const dataUrl = await blobToDataURL(compressedBlob)

        // Send the result back
        self.postMessage({
          type: "result",
          data: {
            blob: compressedBlob,
            dataUrl,
            quality: MIN_QUALITY,
          },
        })
      }
    } catch (error) {
      console.error("Worker progressive compression error:", error)
      self.postMessage({
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error during progressive compression",
      })
    }
    return
  }

  if (type === "compress") {
    try {
      // Send initial progress
      postProgress(0)

      // Make sure the module is loaded
      if (!MozJPEGEncoder) {
        try {
          await loadMozJPEGModule()
          postProgress(10)
        } catch (error) {
          console.error("Failed to load MozJPEG module:", error)
          self.postMessage({
            type: "error",
            error: `Failed to load MozJPEG module: ${error.message || "Unknown error"}`,
          })
          return
        }
      }

      // Convert ArrayBuffer to Blob
      const blob = new Blob([imageData], { type: "image/jpeg" })

      // If quality is provided, use it directly
      if (quality !== undefined) {
        const result = await compressWithQuality(blob, quality, isLargeFile, preserveOriginalDimensions)
        self.postMessage({
          type: "result",
          data: result,
        })
        return
      }

      // Otherwise, find optimal quality to meet target size
      const result = await findOptimalCompression(blob, targetSize, isLargeFile, preserveOriginalDimensions)

      // Send the result back to the main thread
      self.postMessage({
        type: "result",
        data: result,
      })
    } catch (error) {
      console.error("Worker compression error:", error)
      self.postMessage({
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error during compression",
      })
    }
  }
})

// Add a periodic heartbeat to let the main thread know we're still alive
setInterval(() => {
  try {
    self.postMessage({ type: "heartbeat" })
  } catch (e) {
    // Ignore errors if the worker is being terminated
  }
}, 5000)

// Helper function to post progress updates
function postProgress(progress) {
  self.postMessage({
    type: "progress",
    progress,
  })
}

/**
 * Loads the MozJPEG WASM module from local file
 * Includes fallback mechanisms if the module cannot be loaded
 *
 * @returns Promise - Resolves when the module is loaded
 */
async function loadMozJPEGModule() {
  // If already loaded, return immediately
  if (MozJPEGEncoder) {
    return
  }

  // If already loading, wait for it to complete
  if (isModuleLoading && moduleLoadPromise) {
    return moduleLoadPromise
  }

  isModuleLoading = true
  moduleLoadPromise = new Promise(async (resolve, reject) => {
    try {
      // Load from local file
      try {
        // Load the MozJPEG module from local file
        importScripts("./mozjpeg.js")

        if (typeof self.MozJPEGModule !== "undefined") {
          MozJPEGModule = self.MozJPEGModule
          MozJPEGEncoder = MozJPEGModule.MozJPEGEncoder
          isModuleLoading = false
          resolve()
          return
        }
      } catch (localError) {
        console.error("Failed to load MozJPEG from local file:", localError)
      }

      // If local loading fails, fall back to a simpler approach
      // Create a mock MozJPEGEncoder that uses the browser's native JPEG encoding
      MozJPEGEncoder = {
        create: async () => ({
          encode: async (imageData, options) => {
            const { width, height, quality } = options

            // Create a canvas to draw the image
            const canvas = new OffscreenCanvas(width, height)
            const ctx = canvas.getContext("2d")

            // Create an ImageData object
            const imgData = new ImageData(new Uint8ClampedArray(imageData), width, height)

            // Put the image data on the canvas
            ctx.putImageData(imgData, 0, 0)

            // Convert to blob with the specified quality
            const blob = await canvas.convertToBlob({
              type: "image/jpeg",
              quality: quality / 100, // Convert from 0-100 to 0-1
            })

            // Convert blob to ArrayBuffer
            return new Uint8Array(await blob.arrayBuffer())
          },
        }),
      }

      isModuleLoading = false
      resolve()
    } catch (error) {
      console.error("Failed to load MozJPEG module:", error)
      isModuleLoading = false
      reject(error)
    }
  })

  return moduleLoadPromise
}

/**
 * Compresses an image with a specific quality setting
 *
 * @param blob - The image blob to compress
 * @param quality - The quality setting (0.1-0.95)
 * @param isLargeFile - Whether this is a large file that may need special handling
 * @param preserveOriginalDimensions - Whether to preserve the original dimensions
 * @returns Promise - The compressed image result
 */
async function compressWithQuality(blob, quality, isLargeFile = false, preserveOriginalDimensions = true) {
  try {
    // Load the image
    const imageData = await createImageBitmap(blob)
    postProgress(20)

    // Get original dimensions
    const originalWidth = imageData.width
    const originalHeight = imageData.height

    // Determine if we need to scale down for processing
    // If preserveOriginalDimensions is true, we'll only scale for processing, not for output
    let processingWidth = originalWidth
    let processingHeight = originalHeight
    let needsScaling = false

    // For very large images, we might need to scale down for processing to avoid memory issues
    if (isLargeFile && !preserveOriginalDimensions) {
      const MAX_DIMENSION = 3000
      const MAX_PIXELS = 8000000 // 8 megapixels

      const totalPixels = originalWidth * originalHeight

      if (totalPixels > MAX_PIXELS || originalWidth > MAX_DIMENSION || originalHeight > MAX_DIMENSION) {
        const scaleFactor = Math.min(
          MAX_DIMENSION / Math.max(originalWidth, originalHeight),
          Math.sqrt(MAX_PIXELS / totalPixels),
        )

        processingWidth = Math.round(originalWidth * scaleFactor)
        processingHeight = Math.round(originalHeight * scaleFactor)
        needsScaling = true
      }
    }

    // Create a canvas for processing
    const canvas = new OffscreenCanvas(processingWidth, processingHeight)
    const ctx = canvas.getContext("2d")

    if (!ctx) {
      throw new Error("Could not get canvas context")
    }

    // Draw the image on the canvas
    ctx.drawImage(imageData, 0, 0, processingWidth, processingHeight)
    postProgress(30)

    // Get image data from canvas
    const imgData = ctx.getImageData(0, 0, processingWidth, processingHeight)
    postProgress(40)

    // For large images, we might need to release the original bitmap
    // to free up memory
    imageData.close()

    // Initialize MozJPEG encoder
    const encoder = await MozJPEGEncoder.create()
    postProgress(50)

    // Convert quality from 0-1 range to 0-100 range for MozJPEG
    const mozJpegQuality = Math.round(quality * 100)

    // Encode the image with MozJPEG
    const compressedData = await encoder.encode(imgData.data, {
      width: processingWidth,
      height: processingHeight,
      quality: mozJpegQuality,
      baseline: true,
      arithmetic: false,
      progressive: true,
      optimize_coding: true,
      smoothing: 0,
      color_space: 3 /*YCbCr*/,
      quant_table: 3,
      trellis_multipass: true,
      trellis_opt_zero: true,
      trellis_opt_table: true,
      trellis_loops: 10,
      auto_subsample: true,
      chroma_subsample: 2,
      separate_chroma_quality: false,
      chroma_quality: mozJpegQuality,
    })
    postProgress(80)

    // Create a blob from the compressed data
    const compressedBlob = new Blob([compressedData], { type: "image/jpeg" })

    // Convert to data URL for preview
    const dataUrl = await blobToDataURL(compressedBlob)
    postProgress(100)

    // If we scaled down for processing but want to preserve original dimensions,
    // we need to note this in the result
    return {
      blob: compressedBlob,
      dataUrl,
      quality,
      originalWidth: needsScaling && preserveOriginalDimensions ? originalWidth : processingWidth,
      originalHeight: needsScaling && preserveOriginalDimensions ? originalHeight : processingHeight,
      preserveOriginalDimensions: preserveOriginalDimensions && needsScaling,
    }
  } catch (error) {
    console.error("MozJPEG compression error:", error)
    throw error
  }
}

/**
 * Finds the optimal compression quality to meet the target size
 * Uses binary search to efficiently find the best quality that
 * produces a file size under the target
 *
 * @param file - The image file to compress
 * @param targetSize - The target file size in bytes
 * @param isLargeFile - Whether this is a large file that may need special handling
 * @param preserveOriginalDimensions - Whether to preserve the original dimensions
 * @returns Promise - The compressed image at optimal quality
 */
async function findOptimalCompression(file, targetSize, isLargeFile = false, preserveOriginalDimensions = true) {
  // If the file is already under target size, return it as is
  if (file.size <= targetSize) {
    const dataUrl = await blobToDataURL(file)

    // Get the original dimensions
    const img = await createImageBitmap(file)
    const originalWidth = img.width
    const originalHeight = img.height
    img.close()

    return {
      blob: file,
      dataUrl,
      quality: 1.0,
      originalWidth,
      originalHeight,
      preserveOriginalDimensions: false, // No scaling was needed
    }
  }

  // Use binary search to find the optimal quality
  let minQuality = MIN_QUALITY
  let maxQuality = MAX_QUALITY
  let bestQuality = minQuality
  let bestBlob = null
  let bestDataUrl = null
  let bestOriginalWidth = 0
  let bestOriginalHeight = 0
  let bestPreserveOriginalDimensions = false
  let iteration = 0
  const maxIterations = Math.ceil(Math.log2((MAX_QUALITY - MIN_QUALITY) / QUALITY_PRECISION))

  while (maxQuality - minQuality > QUALITY_PRECISION) {
    iteration++
    const midQuality = (minQuality + maxQuality) / 2

    // Calculate progress (20% to 90%)
    const progressPercent = 20 + 70 * (iteration / maxIterations)
    postProgress(progressPercent)

    // Compress with current quality
    const result = await compressWithQuality(file, midQuality, isLargeFile, preserveOriginalDimensions)

    if (result.blob.size <= targetSize) {
      // This quality works, try to increase quality
      bestQuality = midQuality
      bestBlob = result.blob
      bestDataUrl = result.dataUrl
      bestOriginalWidth = result.originalWidth
      bestOriginalHeight = result.originalHeight
      bestPreserveOriginalDimensions = result.preserveOriginalDimensions
      minQuality = midQuality
    } else {
      // Too large, decrease quality
      maxQuality = midQuality
    }

    // Memory management: If we already have a good result and we're getting close to the target,
    // we can stop early to save resources
    if (bestBlob && iteration > 5 && maxQuality - minQuality < 0.05) {
      break
    }
  }

  // If we couldn't find a suitable quality
  if (!bestBlob || !bestDataUrl) {
    // Try with the minimum quality as a last resort
    const result = await compressWithQuality(file, MIN_QUALITY, isLargeFile, preserveOriginalDimensions)

    if (result.blob.size <= targetSize) {
      bestBlob = result.blob
      bestDataUrl = result.dataUrl
      bestQuality = MIN_QUALITY
      bestOriginalWidth = result.originalWidth
      bestOriginalHeight = result.originalHeight
      bestPreserveOriginalDimensions = result.preserveOriginalDimensions
    } else {
      // If we're preserving original dimensions, we'll still return the result
      if (preserveOriginalDimensions) {
        bestBlob = result.blob
        bestDataUrl = result.dataUrl
        bestQuality = MIN_QUALITY
        bestOriginalWidth = result.originalWidth
        bestOriginalHeight = result.originalHeight
        bestPreserveOriginalDimensions = result.preserveOriginalDimensions
      } else {
        throw new Error("Could not compress image to target size")
      }
    }
  }

  postProgress(100)

  return {
    blob: bestBlob,
    dataUrl: bestDataUrl,
    quality: bestQuality,
    originalWidth: bestOriginalWidth,
    originalHeight: bestOriginalHeight,
    preserveOriginalDimensions: bestPreserveOriginalDimensions,
  }
}

// Helper function to convert a blob to a data URL
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
