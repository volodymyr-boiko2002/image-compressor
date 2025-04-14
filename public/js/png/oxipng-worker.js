/**
 * Enhanced PNG Compression Worker
 *
 * A Web Worker for high-performance PNG compression using WebAssembly.
 * Implements efficient memory management, transferable objects, and
 * advanced color optimization techniques.
 */

// Constants for compression
const TARGET_SIZE_DEFAULT = 200 * 1024 // 200KB default target
const MIN_QUALITY = 0.2
const MAX_QUALITY = 0.95

// WASM module state
let oxipngModule = null
let oxipngInitialized = false
let wasmModuleInitPromise = null

// Buffer pool for memory reuse
const bufferPool = {
  free: [],
  inUse: new Map(),

  // Get a buffer from the pool or create a new one
  getBuffer(size) {
    // Find a suitably sized buffer from the pool
    const index = this.free.findIndex((buf) => buf.byteLength >= size)
    if (index !== -1) {
      const buffer = this.free.splice(index, 1)[0]
      this.inUse.set(buffer, true)
      return buffer
    }

    // Create a new buffer
    const buffer = new ArrayBuffer(size)
    this.inUse.set(buffer, true)
    return buffer
  },

  // Return a buffer to the pool
  recycleBuffer(buffer) {
    if (this.inUse.has(buffer)) {
      this.inUse.delete(buffer)

      // Limit pool size to prevent memory bloat
      if (this.free.length < 10) {
        this.free.push(buffer)
      }
    }
  },

  // Clear the buffer pool
  clear() {
    this.free = []
    this.inUse.clear()
  },
}

// Canvas pool for offscreen canvas reuse
const canvasPool = {
  canvases: [],

  getCanvas(width, height) {
    // Find canvas of the right size
    const index = this.canvases.findIndex((c) => c.width === width && c.height === height)

    if (index !== -1) {
      return this.canvases.splice(index, 1)[0]
    }

    // Create new canvas
    return new OffscreenCanvas(width, height)
  },

  recycleCanvas(canvas) {
    // Limit pool size
    if (this.canvases.length < 5) {
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
      this.canvases.push(canvas)
    }
  },

  clear() {
    this.canvases = []
  },
}

// Set up heartbeat interval
const heartbeatInterval = setInterval(() => {
  try {
    self.postMessage({ type: "heartbeat" })
  } catch (e) {
    // Ignore errors if the worker is being terminated
  }
}, 5000)

// Main message handler with comprehensive error handling
self.addEventListener("message", async (event) => {
  try {
    const data = event.data || {}
    const type = data.type || "unknown"

    // Handle heartbeat messages immediately
    if (type === "heartbeat") {
      self.postMessage({ type: "heartbeat" })
      return
    }

    // Handle initialization
    if (type === "init") {
      try {
        await initWasmModule()
        self.postMessage({ type: "ready" })
      } catch (err) {
        console.error("Failed to initialize WASM module:", err)
        // Continue without WASM - we'll use fallback methods
        self.postMessage({ type: "ready" })
      }
      return
    }

    // Handle PNG-specific compression
    if (type === "compressPng") {
      try {
        const { imageData, targetSize, width, height } = data

        // Send initial progress
        postProgress(10)

        // Create a blob from the data
        const blob = new Blob([imageData], { type: "image/png" })

        // Create an image from the blob
        const img = await createImageBitmap(blob)

        // Create a canvas with the original dimensions
        const canvas = canvasPool.getCanvas(width, height)
        const ctx = canvas.getContext("2d")

        // Draw the image
        ctx.drawImage(img, 0, 0)

        // Apply PNG-specific optimizations
        const imgData = ctx.getImageData(0, 0, width, height)
        optimizeForPng(imgData.data, width, height)
        ctx.putImageData(imgData, 0, 0)

        // Send initial progress
        postProgress(50)

        // Try different quality levels
        const qualityLevels = [0.8, 0.6, 0.4, 0.2, 0.1]

        for (const quality of qualityLevels) {
          try {
            const compressedBlob = await canvas.convertToBlob({
              type: "image/png",
              quality,
            })

            if (compressedBlob.size <= targetSize) {
              const dataUrl = await blobToDataURL(compressedBlob)
              canvasPool.recycleCanvas(canvas)

              self.postMessage({
                type: "result",
                data: {
                  blob: compressedBlob,
                  dataUrl,
                  quality,
                },
              })
              return
            }
          } catch (error) {
            console.error(`Error at quality ${quality}:`, error)
          }
        }

        // If we couldn't meet the target size, return the smallest result
        const finalBlob = await canvas.convertToBlob({
          type: "image/png",
          quality: 0.1,
        })
        const dataUrl = await blobToDataURL(finalBlob)

        canvasPool.recycleCanvas(canvas)

        self.postMessage({
          type: "result",
          data: {
            blob: finalBlob,
            dataUrl,
            quality: 0.1,
          },
        })
      } catch (error) {
        console.error("PNG compression error:", error)
        self.postMessage({
          type: "error",
          error: error instanceof Error ? error.message : "Unknown error during PNG compression",
        })
      }
      return
    }

    // Handle tile processing
    if (type === "processTile") {
      try {
        const { imageData, tile, fastMode } = data

        // Create ImageData from the ArrayBuffer
        const imgData = new ImageData(new Uint8ClampedArray(imageData), tile.width, tile.height)

        // Process the tile
        const optimizedData = processTileData(imgData, tile, fastMode || false)

        // Send the result back
        self.postMessage(
          {
            type: "tileResult",
            tile,
            optimizedData: optimizedData.buffer,
          },
          [optimizedData.buffer],
        )
      } catch (error) {
        console.error("Tile processing error:", error)
        self.postMessage({
          type: "tileError",
          tile: data.tile,
          error: error.message || "Unknown error in tile processing",
        })
      }
      return
    }

    // For compression requests
    if (type === "compress") {
      try {
        // Extract parameters with safe defaults
        const imageData = data.imageData
        const targetSize = data.targetSize || TARGET_SIZE_DEFAULT
        const isLargeFile = data.isLargeFile || false
        const preserveOriginalDimensions = data.preserveOriginalDimensions !== false

        if (!imageData) {
          throw new Error("No image data provided")
        }

        // Send initial progress
        postProgress(5)

        // Process the image
        const blob = new Blob([imageData], { type: "image/png" })

        // Fall back to optimized canvas-based compression
        postProgress(30)
        const result = await compressWithOptimizedCanvas(blob, targetSize, isLargeFile, preserveOriginalDimensions)

        self.postMessage({
          type: "result",
          data: result,
        })
      } catch (error) {
        console.error("Compression error:", error)
        self.postMessage({
          type: "error",
          error: error instanceof Error ? error.message : "Unknown error during compression",
        })
      }
    }
  } catch (error) {
    console.error("Worker error:", error)
    self.postMessage({
      type: "error",
      error: error instanceof Error ? error.message : "Unknown error in worker",
    })
  }
})

// Process tile data with optimized color handling
function processTileData(imgData, tile, fastMode = false) {
  const { data, width, height } = imgData
  const resultData = new Uint8ClampedArray(data)

  // In fast mode, use simpler processing
  if (fastMode) {
    // Apply quick color optimization
    applyQuickColorOptimization(resultData, width, height)
    return resultData
  }

  // Apply PNG-specific optimizations
  optimizeForPng(resultData, width, height)
  return resultData
}

// Quick color optimization for fast mode
function applyQuickColorOptimization(data, width, height) {
  // Use a fixed quantization level for speed
  const colorPrecision = 8

  for (let i = 0; i < data.length; i += 4) {
    // Skip fully transparent pixels
    if (data[i + 3] === 0) continue

    // Quantize RGB channels
    data[i] = Math.round(data[i] / colorPrecision) * colorPrecision
    data[i + 1] = Math.round(data[i + 1] / colorPrecision) * colorPrecision
    data[i + 2] = Math.round(data[i + 2] / colorPrecision) * colorPrecision

    // Make alpha channel binary
    data[i + 3] = data[i + 3] < 128 ? 0 : 255
  }
}

// Optimize specifically for PNG compression
function optimizeForPng(data, width, height) {
  // For PNG, we want to reduce the number of unique colors
  // and make alpha channel binary

  // Determine color precision based on image size
  const colorPrecision = width * height > 1000000 ? 16 : 8

  for (let i = 0; i < data.length; i += 4) {
    // Make alpha channel binary
    if (data[i + 3] < 128) {
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
      data[i + 3] = 0
      continue
    } else {
      data[i + 3] = 255
    }

    // Quantize RGB channels to reduce unique colors
    data[i] = Math.floor(data[i] / colorPrecision) * colorPrecision
    data[i + 1] = Math.floor(data[i + 1] / colorPrecision) * colorPrecision
    data[i + 2] = Math.floor(data[i + 2] / colorPrecision) * colorPrecision
  }
}

// Helper function to post progress updates
function postProgress(progress, message = null) {
  self.postMessage({
    type: "progress",
    progress,
    message,
  })
}

// Helper function to convert a blob to a data URL
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = (error) => {
      console.error("Error converting blob to data URL:", error)
      reject(error)
    }
    reader.readAsDataURL(blob)
  })
}

/**
 * Initialize Oxipng WASM module with improved error handling
 * Uses local file instead of CDN to eliminate external dependencies
 */
async function initWasmModule() {
  // If already initialized, return immediately
  if (oxipngInitialized) return Promise.resolve(oxipngModule)

  // If already initializing, wait for it to complete
  if (wasmModuleInitPromise) return wasmModuleInitPromise

  wasmModuleInitPromise = new Promise(async (resolve, reject) => {
    try {
      // Try to load from local path
      try {
        importScripts("./oxipng.js")

        if (typeof self.OxipngModule !== "undefined") {
          // Initialize the module
          oxipngModule = self.OxipngModule
          oxipngInitialized = true
          resolve(oxipngModule)
          return
        }
      } catch (err) {
        console.error("Failed to load Oxipng from local path:", err)
        // Continue to fallback
      }

      // If we get here, local loading failed
      resolve(null) // Resolve with null to indicate fallback should be used
    } catch (error) {
      console.error("Oxipng initialization failed:", error)
      reject(error)
    }
  })

  return wasmModuleInitPromise
}

/**
 * Compresses using optimized canvas-based approach
 */
async function compressWithOptimizedCanvas(blob, targetSize, isLargeFile, preserveOriginalDimensions) {
  try {
    // Create an image from the blob
    const img = await createImageBitmap(blob)
    postProgress(40)

    // Determine dimensions to use based on settings
    const width = img.width
    const height = img.height

    // Create a canvas with the desired dimensions
    const canvas = canvasPool.getCanvas(width, height)
    const ctx = canvas.getContext("2d")

    // Draw the image with high quality
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(img, 0, 0, width, height)
    postProgress(50)

    // Get image data for optimization
    const imageData = ctx.getImageData(0, 0, width, height)

    // Apply PNG-specific optimizations
    optimizeForPng(imageData.data, width, height)
    ctx.putImageData(imageData, 0, 0)

    postProgress(80)

    // Try different quality levels to meet target size
    const qualityLevels = [0.8, 0.6, 0.4, 0.2]

    let bestBlob = null
    let bestDataUrl = null
    let bestQuality = 0

    for (const quality of qualityLevels) {
      try {
        const blob = await canvas.convertToBlob({ type: "image/png", quality })

        if (blob.size <= targetSize) {
          const dataUrl = await blobToDataURL(blob)
          canvasPool.recycleCanvas(canvas)

          postProgress(100)
          return {
            blob,
            dataUrl,
            quality,
          }
        }

        // Keep track of the best result
        if (!bestBlob || blob.size < bestBlob.size) {
          bestBlob = blob
          bestDataUrl = await blobToDataURL(blob)
          bestQuality = quality
        }
      } catch (error) {
        console.error(`Error at quality ${quality}:`, error)
      }
    }

    // If we couldn't meet the target size, return the best we could do
    if (bestBlob && bestDataUrl) {
      canvasPool.recycleCanvas(canvas)
      postProgress(100)

      return {
        blob: bestBlob,
        dataUrl: bestDataUrl,
        quality: bestQuality,
      }
    }

    throw new Error("Could not compress image to an acceptable size")
  } catch (error) {
    console.error("Canvas compression error:", error)
    throw error
  }
}

// Clean up resources when the worker is terminated
self.addEventListener("close", () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
  }

  // Clear pools
  bufferPool.clear()
  canvasPool.clear()
})
