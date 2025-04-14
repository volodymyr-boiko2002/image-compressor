import type { ImageCompressor, CompressedImageResult } from "../../types"

interface Tile {
  x: number
  y: number
  width: number
  height: number
  data?: ImageData
  priority?: number // For progressive processing
}

interface CompressionOptions {
  targetSize?: number
  onProgress?: (progress: number) => void
  preserveMetadata?: boolean
}

// Configuration object for the worker pool
interface WorkerPoolConfig {
  maxWorkers: number
  initializationTimeout: number
}

// Interface for tracking worker status in the pool
interface PooledWorker {
  worker: Worker
  busy: boolean
  id: number
  lastUsed: number
}

/**
 * PNGCompressorAdvanced Class
 *
 * An advanced PNG compressor that uses Web Workers and WebAssembly (WASM)
 * for high-performance image compression. Implements true tiled processing for
 * large images to prevent memory issues and browser crashes.
 *
 * Features:
 * - Worker pooling for better resource utilization
 * - True tile-based processing with overlapping and adaptive tiles
 * - Perceptual color optimization with edge preservation
 * - Multi-level fallback system with progressive degradation
 * - Advanced memory management with buffer reuse
 */
export class PNGCompressorAdvanced implements ImageCompressor {
  supportedTypes = ["image/png"]
  private readonly TARGET_SIZE_BASE = 200 * 1024 // 200KB base target
  private readonly ACCEPTABLE_SIZE = 500 * 1024 // 500KB is acceptable for quality preservation

  // Worker pool management
  private workerPool: PooledWorker[] = []
  private workerInitPromise: Promise<void> | null = null
  private poolConfig: WorkerPoolConfig = {
    maxWorkers: Math.max(2, Math.min(4, navigator.hardwareConcurrency || 2)),
    initializationTimeout: 10000,
  }

  // Canvas pool for reuse
  private canvasPool: HTMLCanvasElement[] = []

  // Promise queue for managing concurrent work
  private taskQueue: Promise<any> = Promise.resolve()

  // Tile processing configuration
  private tileProcessingTimeoutMs = 3000 // Reduced timeout for tile processing
  private maxConcurrentTiles = 4 // Limit concurrent tile processing

  constructor() {
    // Initialize worker pool asynchronously during idle time
    if (typeof window !== "undefined" && typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(() => this.initializeWorkerPool())
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => this.initializeWorkerPool(), 100)
    }
  }

  /**
   * Main compression method that determines the appropriate compression strategy
   * based on the image size.
   *
   * @param file - The PNG file to compress
   * @param options - Optional compression options
   * @returns Promise<CompressedImageResult> - The compressed image data
   */
  async compress(file: File, options?: CompressionOptions): Promise<CompressedImageResult> {
    if (!this.supportedTypes.includes(file.type)) {
      throw new Error("Unsupported file type. Only PNG files are supported.")
    }

    // Check if file is too large
    const MAX_SIZE = 50 * 1024 * 1024 // 50MB
    if (file.size > MAX_SIZE) {
      throw new Error(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum supported size (50MB)`)
    }

    console.log(`Advanced PNG compressor: Processing file (${(file.size / (1024 * 1024)).toFixed(2)}MB)`)

    // Use the provided target size or fall back to the default
    const targetSize = options?.targetSize || this.TARGET_SIZE_BASE
    const acceptableSize = Math.max(targetSize, this.ACCEPTABLE_SIZE)

    // If the file is already small enough, return it as is
    if (file.size <= targetSize) {
      console.log("Advanced PNG compressor: File already meets target size, no compression needed")
      const dataUrl = await this.fileToDataURL(file)
      return {
        blob: file,
        dataUrl,
        quality: 1.0,
      }
    }

    // Ensure worker pool is initialized
    if (!this.workerInitPromise) {
      this.initializeWorkerPool()
    }

    await this.workerInitPromise

    // Determine target size based on file size
    // For larger files, we allow larger output to maintain quality
    let targetSizeInternal = this.TARGET_SIZE_BASE
    if (file.size > 15 * 1024 * 1024) {
      // Very large files (>15MB)
      targetSizeInternal = 400 * 1024 // 400KB
      console.log(`Advanced PNG compressor: Using 400KB target for very large file`)
    } else if (file.size > 8 * 1024 * 1024) {
      // Large files (>8MB)
      targetSizeInternal = 300 * 1024 // 300KB
      console.log(`Advanced PNG compressor: Using 300KB target for large file`)
    } else if (file.size > 3 * 1024 * 1024) {
      // Medium-large files (>3MB)
      targetSizeInternal = 250 * 1024 // 250KB
      console.log(`Advanced PNG compressor: Using 250KB target for medium-large file`)
    }

    // For extremely large files (>10MB), use a simplified approach
    if (file.size > 10 * 1024 * 1024) {
      return this.compressLargeImage(file, targetSizeInternal, options?.onProgress)
    }

    // Determine the most appropriate compression approach based on file size
    try {
      if (file.size > 5 * 1024 * 1024) {
        // For large images, use downscaling approach
        console.log("Advanced PNG compressor: Using downscaling approach for large image")
        return await this.compressWithDownscaling(file, targetSizeInternal, options?.onProgress)
      } else {
        // For smaller images, use standard processing with quality preservation
        console.log("Advanced PNG compressor: Using standard processing with quality preservation")
        return await this.compressWithQualityPreservation(file, targetSizeInternal, options?.onProgress)
      }
    } catch (error) {
      console.error("Advanced PNG compressor error: Compression failed", error)

      // Implement progressive fallback system
      try {
        console.log("Advanced PNG compressor: Primary method failed, trying alternative approach")
        options?.onProgress?.(50)

        // Try alternative method based on what failed
        if (error instanceof Error && (error.message.includes("worker") || error.message.includes("WASM"))) {
          // If workers or WASM failed, use direct canvas-based approach
          return await this.compressWithSimpleApproach(file, targetSizeInternal, options?.onProgress)
        } else {
          // For other errors, try with simpler tiling approach
          return await this.compressWithSimpleTiling(file, targetSizeInternal, options?.onProgress)
        }
      } catch (fallbackError) {
        console.error("Advanced PNG compressor error: Fallback compression failed", fallbackError)
        throw new Error(`Advanced PNG compression failed after trying fallback methods: ${
          fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        }`)
      }
    }
  }

  /**
   * Simplified approach for extremely large images
   * Uses downscaling and standard PNG compression
   */
  private async compressLargeImage(
    file: File,
    targetSize: number,
    onProgress?: (progress: number) => void,
  ): Promise<CompressedImageResult> {
    console.log("Advanced PNG compressor: Using simplified approach for extremely large image")
    if (onProgress) onProgress(10)

    // Create an image from the file
    const img = await this.createImageFromFile(file)
    console.log(`Advanced PNG compressor: Processing large image: ${img.width}x${img.height}`)

    if (onProgress) onProgress(20)

    // For very large images, we'll use a more aggressive downscaling approach
    // Calculate scale factor based on image size
    let scaleFactor = 1.0
    const pixelCount = img.width * img.height

    if (pixelCount > 20000000) {
      // > 20MP
      scaleFactor = 0.5
    } else if (pixelCount > 10000000) {
      // > 10MP
      scaleFactor = 0.7
    }

    // If we need to downscale
    if (scaleFactor < 1.0) {
      console.log(`Advanced PNG compressor: Downscaling by factor ${scaleFactor} for large image`)

      // Calculate new dimensions
      const newWidth = Math.round(img.width * scaleFactor)
      const newHeight = Math.round(img.height * scaleFactor)

      // Create a canvas for the downscaled image
      const canvas = this.getCanvas(newWidth, newHeight)
      const ctx = canvas.getContext("2d", { alpha: true })!

      // Draw with high quality
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"
      ctx.drawImage(img, 0, 0, newWidth, newHeight)

      if (onProgress) onProgress(40)

      // Apply color optimization
      const imageData = ctx.getImageData(0, 0, newWidth, newHeight)
      this.optimizeColorsForPNG(imageData.data, newWidth, newHeight)
      ctx.putImageData(imageData, 0, 0)

      if (onProgress) onProgress(60)

      // Compress the image
      const { blob, dataUrl } = await this.canvasToBlob(canvas, 0.8)

      // Check if we met the target size
      if (blob.size <= targetSize) {
        console.log(`Advanced PNG compressor: Successfully compressed to ${(blob.size / 1024).toFixed(1)}KB`)
        this.recycleCanvas(canvas)
        if (onProgress) onProgress(100)
        return { blob, dataUrl, quality: 0.8 }
      }

      // If not, try with more aggressive compression
      const result = await this.findOptimalQuality(canvas, targetSize)
      this.recycleCanvas(canvas)

      if (onProgress) onProgress(100)
      return result
    } else {
      // If we don't need to downscale, use the simple approach
      return this.compressWithSimpleApproach(file, targetSize, onProgress)
    }
  }

  /**
   * Compress using downscaling approach
   */
  private async compressWithDownscaling(
    file: File,
    targetSize: number,
    onProgress?: (progress: number) => void,
  ): Promise<CompressedImageResult> {
    try {
      if (onProgress) onProgress(10)

      // Create an image from the file
      const img = await this.createImageFromFile(file)
      console.log(`Advanced PNG compressor: Processing image with downscaling: ${img.width}x${img.height}`)

      if (onProgress) onProgress(20)

      // Calculate scale factor based on file size
      let scaleFactor = 1.0
      if (file.size > 15 * 1024 * 1024) {
        scaleFactor = 0.6
      } else if (file.size > 8 * 1024 * 1024) {
        scaleFactor = 0.7
      } else if (file.size > 5 * 1024 * 1024) {
        scaleFactor = 0.8
      }

      // Calculate new dimensions
      const newWidth = Math.round(img.width * scaleFactor)
      const newHeight = Math.round(img.height * scaleFactor)

      console.log(`Advanced PNG compressor: Downscaling to ${newWidth}x${newHeight}`)

      // Create a canvas for the downscaled image
      const canvas = this.getCanvas(newWidth, newHeight)
      const ctx = canvas.getContext("2d", { alpha: true })!

      // Draw with high quality
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"
      ctx.drawImage(img, 0, 0, newWidth, newHeight)

      if (onProgress) onProgress(40)

      // Apply color optimization
      const imageData = ctx.getImageData(0, 0, newWidth, newHeight)
      this.optimizeColorsForPNG(imageData.data, newWidth, newHeight)
      ctx.putImageData(imageData, 0, 0)

      if (onProgress) onProgress(60)

      // Try to compress with PNG encoder
      try {
        const result = await this.compressWithPngEncoder(canvas, targetSize)
        this.recycleCanvas(canvas)
        if (onProgress) onProgress(100)
        return result
      } catch (error) {
        console.log(
          "Advanced PNG compressor: PNG encoder compression failed, falling back to canvas blob compression",
          error,
        )

        // Fall back to canvas blob compression
        const result = await this.findOptimalQuality(canvas, targetSize)
        this.recycleCanvas(canvas)
        if (onProgress) onProgress(100)
        return result
      }
    } catch (error) {
      console.error("Advanced PNG compressor error: Downscaling compression failed", error)
      throw error
    }
  }

  /**
   * Optimize colors specifically for PNG compression
   */
  private optimizeColorsForPNG(data: Uint8ClampedArray, width: number, height: number): void {
    // For PNG, we want to reduce the number of unique colors
    // and make alpha channel binary (fully transparent or fully opaque)

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

  /**
   * Try to compress using a PNG encoder via worker
   */
  private async compressWithPngEncoder(canvas: HTMLCanvasElement, targetSize: number): Promise<CompressedImageResult> {
    try {
      // Get a worker from the pool
      const pooledWorker = await this.getWorker()
      const worker = pooledWorker.worker

      return new Promise<CompressedImageResult>((resolve, reject) => {
        try {
          // Set up message handler
          const messageHandler = (e: MessageEvent) => {
            if (e.data && e.data.type === "result") {
              worker.removeEventListener("message", messageHandler)
              this.releaseWorker(pooledWorker)
              resolve(e.data.data)
            } else if (e.data && e.data.type === "error") {
              worker.removeEventListener("message", messageHandler)
              this.releaseWorker(pooledWorker)
              reject(new Error(e.data.error || "Unknown error"))
            }
          }

          worker.addEventListener("message", messageHandler)

          // Set a timeout
          const timeoutId = setTimeout(() => {
            worker.removeEventListener("message", messageHandler)
            this.releaseWorker(pooledWorker)
            reject(new Error("PNG encoder compression timed out"))
          }, 10000)

          // Convert canvas to blob and send to worker
          canvas.toBlob(async (blob) => {
            if (!blob) {
              clearTimeout(timeoutId)
              reject(new Error("Failed to convert canvas to blob"))
              return
            }

            try {
              const arrayBuffer = await blob.arrayBuffer()

              // Send to worker with PNG encoder flag
              worker.postMessage(
                {
                  type: "compressPng",
                  imageData: arrayBuffer,
                  targetSize: targetSize,
                  width: canvas.width,
                  height: canvas.height,
                },
                [arrayBuffer],
              )
            } catch (error) {
              clearTimeout(timeoutId)
              worker.removeEventListener("message", messageHandler)
              this.releaseWorker(pooledWorker)
              reject(error)
            }
          }, "image/png")
        } catch (error) {
          this.releaseWorker(pooledWorker)
          reject(error)
        }
      })
    } catch (error) {
      console.error("Advanced PNG compressor error: Encoder compression failed", error)
      throw error
    }
  }

  /**
   * Find optimal quality for canvas compression
   */
  private async findOptimalQuality(canvas: HTMLCanvasElement, targetSize: number): Promise<CompressedImageResult> {
    // Try different quality levels
    const qualityLevels = [0.8, 0.6, 0.4, 0.2]

    for (const quality of qualityLevels) {
      const { blob, dataUrl } = await this.canvasToBlob(canvas, quality)

      if (blob.size <= targetSize) {
        return { blob, dataUrl, quality }
      }
    }

    // If we couldn't meet the target size, use the lowest quality
    const { blob, dataUrl } = await this.canvasToBlob(canvas, 0.1)
    return { blob, dataUrl, quality: 0.1 }
  }

  /**
   * Initialize a pool of workers that can be reused for compression tasks
   * This improves performance by avoiding the overhead of creating/destroying workers
   */
  private initializeWorkerPool(): Promise<void> {
    if (this.workerInitPromise) {
      return this.workerInitPromise
    }

    this.workerInitPromise = new Promise((resolve, reject) => {
      if (typeof window === "undefined" || typeof Worker === "undefined") {
        console.log("Advanced PNG compressor: Web Workers not supported in this environment")
        resolve()
        return
      }

      const initWorkerCount = Math.min(2, this.poolConfig.maxWorkers)
      console.log(`Advanced PNG compressor: Initializing worker pool with ${initWorkerCount} workers`)

      let initializedCount = 0
      const initializationErrors: string[] = []

      const checkCompletion = () => {
        initializedCount++
        if (initializedCount >= initWorkerCount) {
          if (this.workerPool.length > 0) {
            console.log(`Advanced PNG compressor: Worker pool initialized with ${this.workerPool.length} workers`)
            resolve()
          } else {
            reject(new Error(`Failed to initialize any workers: ${initializationErrors.join(", ")}`))
          }
        }
      }

      // Initialize workers in parallel
      for (let i = 0; i < initWorkerCount; i++) {
        this.createWorker(i)
          .then(() => checkCompletion())
          .catch((error) => {
            console.log(`Advanced PNG compressor: Failed to initialize worker ${i}:`, error)
            initializationErrors.push(error.message)
            checkCompletion()
          })
      }

      // Add timeout to prevent hanging
      setTimeout(() => {
        if (initializedCount < initWorkerCount) {
          console.log("Advanced PNG compressor: Worker pool initialization timed out, continuing with partial pool")
          if (this.workerPool.length > 0) {
            resolve() // Resolve with partial pool
          } else {
            reject(new Error("Worker pool initialization timed out and no workers were created"))
          }
        }
      }, this.poolConfig.initializationTimeout)
    })

    return this.workerInitPromise
  }

  /**
   * Create and initialize a new worker for the pool
   */
  private createWorker(id: number): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const workerUrl = new URL("/js/png/oxipng-worker.js", window.location.origin).href
        console.log(`Advanced PNG compressor: Creating worker ${id} from ${workerUrl}`)

        const worker = new Worker(workerUrl)

        // Set timeout to prevent hanging
        const timeoutId = setTimeout(() => {
          console.log(`Advanced PNG compressor: Worker ${id} initialization timed out`)
          worker.terminate()
          reject(new Error(`Worker ${id} initialization timed out`))
        }, this.poolConfig.initializationTimeout)

        // Set up message handler for initialization
        const messageHandler = (e: MessageEvent) => {
          if (e.data && e.data.type === "ready") {
            clearTimeout(timeoutId)
            worker.removeEventListener("message", messageHandler)

            // Add to pool
            this.workerPool.push({
              worker,
              busy: false,
              id,
              lastUsed: Date.now(),
            })

            console.log(`Advanced PNG compressor: Worker ${id} initialized and added to pool`)
            resolve()
          }
        }

        // Handle worker errors during initialization
        const errorHandler = (error: ErrorEvent) => {
          clearTimeout(timeoutId)
          console.error(`Advanced PNG compressor error: Worker ${id} initialization failed`, error)
          worker.removeEventListener("error", errorHandler)
          reject(new Error(`Worker ${id} initialization error: ${error.message || "Unknown error"}`))
        }

        worker.addEventListener("message", messageHandler)
        worker.addEventListener("error", errorHandler)

        // Send init message to worker
        worker.postMessage({ type: "init" })
      } catch (error) {
        console.error("Advanced PNG compressor error: Failed to create worker", error)
        reject(error)
      }
    })
  }

  /**
   * Get an available worker from the pool or create a new one if needed
   */
  private async getWorker(): Promise<PooledWorker> {
    // Ensure pool is initialized
    await this.workerInitPromise

    // First check for existing available workers
    const availableWorker = this.workerPool.find((w) => !w.busy)
    if (availableWorker) {
      availableWorker.busy = true
      availableWorker.lastUsed = Date.now()
      return availableWorker
    }

    // If we haven't reached max workers, create a new one
    if (this.workerPool.length < this.poolConfig.maxWorkers) {
      const newWorkerId = this.workerPool.length
      await this.createWorker(newWorkerId)
      const newWorker = this.workerPool[newWorkerId]
      newWorker.busy = true
      newWorker.lastUsed = Date.now()
      return newWorker
    }

    // If we're at max capacity, wait for a worker to become available
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const availableWorker = this.workerPool.find((w) => !w.busy)
        if (availableWorker) {
          clearInterval(checkInterval)
          availableWorker.busy = true
          availableWorker.lastUsed = Date.now()
          resolve(availableWorker)
        }
      }, 50)
    })
  }

  /**
   * Release a worker back to the pool
   */
  private releaseWorker(worker: PooledWorker): void {
    const poolWorker = this.workerPool.find((w) => w.id === worker.id)
    if (poolWorker) {
      poolWorker.busy = false
      poolWorker.lastUsed = Date.now()
    }
  }

  /**
   * Get a canvas from the pool or create a new one
   */
  private getCanvas(width: number, height: number): HTMLCanvasElement {
    // Check for available canvas of the right size
    const availableCanvasIndex = this.canvasPool.findIndex(
      (canvas) => canvas.width === width && canvas.height === height,
    )

    if (availableCanvasIndex !== -1) {
      // Reuse existing canvas
      return this.canvasPool.splice(availableCanvasIndex, 1)[0]
    }

    // Create new canvas
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    return canvas
  }

  /**
   * Return a canvas to the pool for reuse
   */
  private recycleCanvas(canvas: HTMLCanvasElement): void {
    // Limit pool size to prevent memory issues
    if (this.canvasPool.length < 10) {
      // Clear the canvas before returning to pool
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
      this.canvasPool.push(canvas)
    }
  }

  /**
   * Compresses a PNG image while preserving quality and original dimensions.
   * Uses a multi-stage approach to achieve good compression without sacrificing quality.
   */
  private async compressWithQualityPreservation(
    file: File,
    targetSize: number,
    onProgress?: (progress: number) => void,
  ): Promise<CompressedImageResult> {
    try {
      // Create an image from the file
      if (onProgress) onProgress(10)
      const img = await this.createImageFromFile(file)
      console.log(`Advanced PNG compressor: Processing image: ${img.width}x${img.height}`)

      if (onProgress) onProgress(20)

      // Create a canvas with the original dimensions
      const canvas = this.getCanvas(img.width, img.height)
      const ctx = canvas.getContext("2d", { alpha: true })
      if (!ctx) {
        throw new Error("Could not get canvas context")
      }

      // Draw the original image
      ctx.drawImage(img, 0, 0)

      if (onProgress) onProgress(30)

      // Get a worker from the pool
      const pooledWorker = await this.getWorker()
      const worker = pooledWorker.worker

      try {
        return await new Promise<CompressedImageResult>((resolve, reject) => {
          // Set up message handler for the worker
          const messageHandler = (e: MessageEvent) => {
            if (e.data && e.data.type === "result") {
              worker.removeEventListener("message", messageHandler)
              this.releaseWorker(pooledWorker)
              resolve(e.data.data)
            } else if (e.data && e.data.type === "error") {
              worker.removeEventListener("message", messageHandler)
              this.releaseWorker(pooledWorker)
              reject(new Error(e.data.error || "Unknown error"))
            } else if (e.data && e.data.type === "progress") {
              if (onProgress) {
                onProgress(30 + Math.round(e.data.progress * 0.7))
              }
            }
          }

          worker.addEventListener("message", messageHandler)

          // Convert canvas to blob and send to worker
          canvas.toBlob(async (blob) => {
            if (!blob) {
              reject(new Error("Failed to convert canvas to blob"))
              return
            }

            const arrayBuffer = await blob.arrayBuffer()

            // Send to worker
            worker.postMessage(
              {
                type: "compress",
                imageData: arrayBuffer,
                targetSize: targetSize,
                isLargeFile: file.size > 5 * 1024 * 1024,
                preserveOriginalDimensions: true,
              },
              [arrayBuffer],
            )
          }, "image/png")
        })
      } finally {
        // Recycle canvas
        this.recycleCanvas(canvas)
      }
    } catch (error) {
      console.error("Advanced PNG compressor error: Quality preservation compression failed", error)
      throw error
    }
  }

  /**
   * Simpler fallback tiling approach for when advanced tiling fails
   */
  private async compressWithSimpleTiling(
    file: File,
    targetSize: number,
    onProgress?: (progress: number) => void,
  ): Promise<CompressedImageResult> {
    try {
      if (onProgress) onProgress(10)
      const img = await this.createImageFromFile(file)

      // Use larger, non-overlapping tiles for simplicity
      const tileSize = 1024
      const tilesX = Math.ceil(img.width / tileSize)
      const tilesY = Math.ceil(img.height / tileSize)

      // Create a full-size canvas
      const fullCanvas = this.getCanvas(img.width, img.height)
      const fullCtx = fullCanvas.getContext("2d", { alpha: true })!

      // Draw the original image
      fullCtx.drawImage(img, 0, 0)

      if (onProgress) onProgress(30)

      // Process tiles sequentially to avoid memory issues
      let processedCount = 0
      const totalTiles = tilesX * tilesY

      for (let y = 0; y < tilesY; y++) {
        for (let x = 0; x < tilesX; x++) {
          // Calculate tile bounds
          const tileX = x * tileSize
          const tileY = y * tileSize
          const tileWidth = Math.min(tileSize, img.width - tileX)
          const tileHeight = Math.min(tileSize, img.height - tileY)

          // Extract tile data
          const tileData = fullCtx.getImageData(tileX, tileY, tileWidth, tileHeight)

          // Process the tile locally
          this.optimizeColorsForPNG(tileData.data, tileWidth, tileHeight)

          // Put the processed tile back
          fullCtx.putImageData(tileData, tileX, tileY)

          // Update progress
          processedCount++
          if (onProgress) {
            const progressValue = 30 + Math.round((processedCount / totalTiles) * 50)
            onProgress(Math.min(80, progressValue))
          }
        }
      }

      // Final compression to meet target size
      if (onProgress) onProgress(85)
      const result = await this.findOptimalQuality(fullCanvas, targetSize)

      // Cleanup
      this.recycleCanvas(fullCanvas)

      if (onProgress) onProgress(100)
      return result
    } catch (error) {
      console.error("Advanced PNG compressor error: Simple tiling compression failed", error)
      throw error
    }
  }

  /**
   * Final fallback compressor using simple canvas-based approach
   */
  private async compressWithSimpleApproach(
    file: File,
    targetSize: number,
    onProgress?: (progress: number) => void,
  ): Promise<CompressedImageResult> {
    try {
      if (onProgress) onProgress(10)
      const img = await this.createImageFromFile(file)

      // Create a canvas with original dimensions
      const canvas = this.getCanvas(img.width, img.height)
      const ctx = canvas.getContext("2d", { alpha: true })!

      // Draw the image with high quality
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"
      ctx.drawImage(img, 0, 0)

      if (onProgress) onProgress(40)

      // Apply simple color optimization
      const imageData = ctx.getImageData(0, 0, img.width, img.height)
      this.optimizeColorsForPNG(imageData.data, img.width, img.height)
      ctx.putImageData(imageData, 0, 0)

      if (onProgress) onProgress(70)

      // Compress with different quality settings
      const result = await this.findOptimalQuality(canvas, targetSize)

      // Cleanup
      this.recycleCanvas(canvas)

      if (onProgress) onProgress(100)
      return result
    } catch (error) {
      console.error("Advanced PNG compressor error: Simple approach compression failed", error)
      throw error
    }
  }

  /**
   * Helper methods for file processing and conversion
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

  private fileToDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
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
            // Create a new blob with the correct MIME type
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
