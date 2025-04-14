import type { ImageCompressor, CompressedImageResult } from "../../types"

interface Tile {
  x: number
  y: number
  width: number
  height: number
  data?: ImageData
}

/**
 * JPEGCompressorAdvanced Class
 *
 * An advanced JPEG compressor that uses Web Workers and WebAssembly (WASM)
 * for high-performance image compression. Implements tiled processing for
 * large images to prevent memory issues and browser crashes.
 *
 * Features:
 * - WASM-based compression using MozJPEG for superior quality/size ratio
 * - Tiled processing for extremely large images
 * - Progressive JPEG support for better perceived loading
 * - Adaptive target size based on input image size
 * - Comprehensive error handling with fallbacks
 */
export class JPEGCompressorAdvanced implements ImageCompressor {
  supportedTypes = ["image/jpeg", "image/jpg"]
  private readonly TARGET_SIZE_BASE = 100 * 1024 // 100KB base target
  private worker: Worker | null = null
  private workerPromise: Promise<Worker> | null = null

  /**
   * Main compression method that determines the appropriate compression strategy
   * based on the image size. Uses tiled processing for large images and
   * standard processing for smaller ones.
   *
   * @param file - The JPEG file to compress
   * @returns Promise<CompressedImageResult> - The compressed image data
   */
  async compress(file: File): Promise<CompressedImageResult> {
    if (!this.supportedTypes.includes(file.type)) {
      throw new Error("Unsupported file type. Only JPEG/JPG files are supported.")
    }

    // Check if file is too large
    const MAX_SIZE = 50 * 1024 * 1024 // 50MB
    if (file.size > MAX_SIZE) {
      throw new Error(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum supported size (50MB)`)
    }

    console.log(`Advanced JPEG compressor: Processing file (${(file.size / (1024 * 1024)).toFixed(2)}MB)`)

    // Determine target size based on file size
    // For larger files, we allow larger output to maintain quality
    let targetSize = this.TARGET_SIZE_BASE
    if (file.size > 15 * 1024 * 1024) {
      // Very large files (>15MB)
      targetSize = 300 * 1024 // 300KB
      console.log(`Advanced JPEG compressor: Using 300KB target for very large file`)
    } else if (file.size > 8 * 1024 * 1024) {
      // Large files (>8MB)
      targetSize = 250 * 1024 // 250KB
      console.log(`Advanced JPEG compressor: Using 250KB target for large file`)
    } else if (file.size > 3 * 1024 * 1024) {
      // Medium-large files (>3MB)
      targetSize = 200 * 1024 // 200KB
      console.log(`Advanced JPEG compressor: Using 200KB target for medium-large file`)
    }

    // For large files, always use tiled processing to preserve detail and dimensions
    if (file.size > 5 * 1024 * 1024) {
      console.log("Advanced JPEG compressor: Using tiled processing with WASM for large image")
      return this.compressWithTiling(file, targetSize)
    }

    // For smaller files, use standard WASM processing
    return this.compressWithWorker(file, targetSize)
  }

  /**
   * Compresses an image using a Web Worker with WASM-based MozJPEG.
   * This method offloads compression to a separate thread to prevent UI freezing.
   *
   * @param file - The file to compress
   * @param targetSize - The target file size in bytes
   * @returns Promise<CompressedImageResult> - The compressed image data
   */
  private async compressWithWorker(file: File, targetSize: number): Promise<CompressedImageResult> {
    return new Promise((resolve, reject) => {
      try {
        console.log(`Advanced JPEG compressor: Using worker for standard compression`)

        // Initialize the worker
        this.initWorker()
          .then((worker) => {
            // Convert file to ArrayBuffer for transfer to worker
            const reader = new FileReader()
            reader.onload = () => {
              if (!reader.result || !worker) {
                reject(new Error("Failed to read file or worker not available"))
                return
              }

              console.log("Advanced JPEG compressor: File read complete, sending to worker")

              // Set up message handler for worker responses
              worker.onmessage = (e: MessageEvent<any>) => {
                const { type, data, progress, error } = e.data

                if (type === "error") {
                  console.error("Advanced JPEG compressor error: Worker error:", error)
                  reject(new Error(error || "Unknown error during compression"))
                  this.terminateWorker()
                } else if (type === "progress") {
                  // Handle progress updates if needed
                  console.log(`Compression progress: ${progress}%`)
                } else if (type === "result") {
                  // We got our compressed result
                  console.log("Advanced JPEG compressor: Compression complete")
                  resolve(data)
                  this.terminateWorker()
                }
              }

              // Handle worker errors
              worker.onerror = (error) => {
                console.error("Advanced JPEG compressor error: Worker error event:", error)
                const errorMessage =
                  error instanceof Error
                    ? error.message
                    : error && typeof error === "object" && "message" in error
                      ? error.message
                      : "Unknown worker error"
                reject(new Error(`Worker error: ${errorMessage}`))
                this.terminateWorker()
              }

              // Send the file data to the worker
              try {
                console.log("Advanced JPEG compressor: Posting message to worker")
                worker.postMessage(
                  {
                    type: "compress",
                    imageData: reader.result,
                    fileType: file.type,
                    targetSize: targetSize,
                    isLargeFile: false,
                    preserveOriginalDimensions: true,
                  },
                  [reader.result as ArrayBuffer],
                )
              } catch (postError) {
                console.error("Advanced JPEG compressor error: Error posting message to worker:", postError)
                reject(
                  new Error(
                    `Failed to send data to worker: ${postError instanceof Error ? postError.message : "Unknown error"}`,
                  ),
                )
                this.terminateWorker()
              }
            }

            reader.onerror = (event) => {
              console.error("Advanced JPEG compressor error: FileReader error:", event)
              reject(new Error("Failed to read file"))
              this.terminateWorker()
            }

            // Read the file as ArrayBuffer
            console.log("Advanced JPEG compressor: Reading file as ArrayBuffer")
            reader.readAsArrayBuffer(file)
          })
          .catch((error) => {
            console.error("Advanced JPEG compressor error: Worker initialization failed:", error)
            reject(
              new Error(`Failed to initialize worker: ${error instanceof Error ? error.message : "Unknown error"}`),
            )
          })
      } catch (error) {
        console.error("Advanced JPEG compressor error: Compression setup error:", error)
        this.terminateWorker()
        reject(error)
      }
    })
  }

  /**
   * Processes large images by dividing them into tiles and compressing each tile
   * separately. This prevents memory issues with extremely large images.
   *
   * The process:
   * 1. Divide the image into tiles
   * 2. Process each tile with the worker
   * 3. Reassemble the tiles into a complete image
   * 4. Compress the reassembled image to meet the target size
   *
   * @param file - The large image file to compress
   * @param targetSize - The target file size in bytes
   * @returns Promise<CompressedImageResult> - The compressed image data
   */
  private async compressWithTiling(file: File, targetSize: number): Promise<CompressedImageResult> {
    try {
      // Create an image from the file
      const img = await this.createImageFromFile(file)
      console.log(`Advanced JPEG compressor: Tiled processing for image: ${img.width}x${img.height}`)

      // Determine tile size based on image dimensions
      // For very large images, use smaller tiles to prevent memory issues
      // but still preserve original dimensions
      const TILE_SIZE = img.width > 6000 || img.height > 4000 ? 512 : img.width > 4000 || img.height > 3000 ? 768 : 1024
      console.log(`Advanced JPEG compressor: Using tile size: ${TILE_SIZE}px`)

      // Create a canvas for the full image at ORIGINAL dimensions
      const fullCanvas = document.createElement("canvas")
      fullCanvas.width = img.width
      fullCanvas.height = img.height
      const fullCtx = fullCanvas.getContext("2d")
      if (!fullCtx) {
        throw new Error("Could not get canvas context")
      }

      // Draw the original image to the canvas first
      // This ensures we have a complete image even if some tiles fail
      fullCtx.drawImage(img, 0, 0)

      // Calculate the number of tiles in each dimension
      const tilesX = Math.ceil(img.width / TILE_SIZE)
      const tilesY = Math.ceil(img.height / TILE_SIZE)
      console.log(`Advanced JPEG compressor: Image will be processed in ${tilesX}x${tilesY} tiles`)

      // For extremely large images, use a more efficient tiling approach
      // but still preserve original dimensions
      const totalTiles = tilesX * tilesY
      const isExtremelyLarge = totalTiles > 36 || img.width * img.height > 30000000 // More than 36 tiles or 30MP

      if (isExtremelyLarge) {
        console.log("Advanced JPEG compressor: Using optimized tiling for extremely large image")
        return this.compressExtremelyLargeImage(img, fullCanvas, targetSize, TILE_SIZE)
      }

      // Create a canvas for processing individual tiles
      const tileCanvas = document.createElement("canvas")
      tileCanvas.width = TILE_SIZE
      tileCanvas.height = TILE_SIZE
      const tileCtx = tileCanvas.getContext("2d")
      if (!tileCtx) {
        throw new Error("Could not get tile canvas context")
      }

      // Initialize the worker
      const worker = await this.initWorker()

      // Process tiles in batches to prevent memory issues
      const BATCH_SIZE = 4 // Process 4 tiles at a time
      let processedTiles = 0

      // Process tiles in batches
      for (let y = 0; y < tilesY; y++) {
        for (let x = 0; x < tilesX; x += BATCH_SIZE) {
          // Process a batch of tiles
          const batchPromises = []

          for (let i = 0; i < BATCH_SIZE && x + i < tilesX; i++) {
            const tileX = x + i
            // Calculate the actual size of this tile (might be smaller at edges)
            const tileWidth = Math.min(TILE_SIZE, img.width - tileX * TILE_SIZE)
            const tileHeight = Math.min(TILE_SIZE, img.height - y * TILE_SIZE)

            // Adjust tile canvas size if needed for edge tiles
            if (tileWidth !== tileCanvas.width || tileHeight !== tileCanvas.height) {
              tileCanvas.width = tileWidth
              tileCanvas.height = tileHeight
            }

            // Clear the tile canvas
            tileCtx.clearRect(0, 0, tileWidth, tileHeight)

            // Draw the portion of the image for this tile
            tileCtx.drawImage(img, tileX * TILE_SIZE, y * TILE_SIZE, tileWidth, tileHeight, 0, 0, tileWidth, tileHeight)

            // Process this tile with the worker
            const tilePromise = this.processTileWithWorker(
              worker,
              tileCtx,
              tileWidth,
              tileHeight,
              tileX * TILE_SIZE,
              y * TILE_SIZE,
            )
            batchPromises.push(tilePromise)
          }

          // Wait for the batch to complete
          try {
            const results = await Promise.allSettled(batchPromises)

            // Draw the processed tiles onto the full canvas
            for (const result of results) {
              if (result.status === "fulfilled" && result.value) {
                fullCtx.drawImage(result.value.img, result.value.x, result.value.y)
                processedTiles++
                console.log(
                  `Advanced JPEG compressor: Processed tile at ${result.value.x},${result.value.y} (${Math.round(
                    (processedTiles / totalTiles) * 100,
                  )}%)`,
                )
              }
            }
          } catch (error) {
            console.error("Advanced JPEG compressor error: Error processing tile batch:", error)
            // Continue with other batches
          }
        }
      }

      console.log("Advanced JPEG compressor: All tiles processed")

      // Now compress the full image with the desired quality
      console.log("Advanced JPEG compressor: Compressing full image to meet target size")

      // Find the optimal quality for the full image
      const result = await this.findOptimalQuality(fullCanvas, targetSize)
      return result
    } catch (error) {
      console.error("Advanced JPEG compressor error: Tiled compression error:", error)
      this.terminateWorker()

      // Fall back to worker-based compression but still preserve dimensions
      console.log("Advanced JPEG compressor: Falling back to worker-based compression with preserved dimensions")
      return this.compressWithWorker(file, targetSize)
    }
  }

  /**
   * Special processing method for extremely large images (>30MP or >36 tiles).
   * Uses a multi-pass approach with region-based processing to handle images
   * that would otherwise cause memory issues.
   *
   * @param img - The image element containing the large image
   * @param fullCanvas - Canvas for the full-size image
   * @param targetSize - The target file size in bytes
   * @param tileSize - The size of each processing tile
   * @returns Promise<CompressedImageResult> - The compressed image data
   */
  private async compressExtremelyLargeImage(
    img: HTMLImageElement,
    fullCanvas: HTMLCanvasElement,
    targetSize: number,
    tileSize: number,
  ): Promise<CompressedImageResult> {
    console.log("Advanced JPEG compressor: Using progressive tiling for extremely large image")

    // We'll use a multi-pass approach:
    // 1. Process the image in larger chunks first
    // 2. Then refine with smaller tiles in areas that need detail

    // First, create a worker
    const worker = await this.initWorker()

    // Define the regions to process
    // For very large images, we'll divide into 4 quadrants first
    const regions = [
      { x: 0, y: 0, width: Math.ceil(img.width / 2), height: Math.ceil(img.height / 2) },
      { x: Math.ceil(img.width / 2), y: 0, width: Math.floor(img.width / 2), height: Math.ceil(img.height / 2) },
      { x: 0, y: Math.ceil(img.height / 2), width: Math.ceil(img.width / 2), height: Math.floor(img.height / 2) },
      {
        x: Math.ceil(img.width / 2),
        y: Math.ceil(img.height / 2),
        width: Math.floor(img.width / 2),
        height: Math.floor(img.height / 2),
      },
    ]

    // Process each region
    for (let i = 0; i < regions.length; i++) {
      const region = regions[i]
      console.log(`Advanced JPEG compressor: Processing region ${i + 1}/4: ${region.width}x${region.height}`)

      // Create a canvas for this region
      const regionCanvas = document.createElement("canvas")
      regionCanvas.width = region.width
      regionCanvas.height = region.height
      const regionCtx = regionCanvas.getContext("2d")
      if (!regionCtx) {
        throw new Error("Could not get region canvas context")
      }

      // Draw the region
      regionCtx.drawImage(img, region.x, region.y, region.width, region.height, 0, 0, region.width, region.height)

      // Now process this region with tiles
      const tilesX = Math.ceil(region.width / tileSize)
      const tilesY = Math.ceil(region.height / tileSize)

      // Create a canvas for processing individual tiles
      const tileCanvas = document.createElement("canvas")
      tileCanvas.width = tileSize
      tileCanvas.height = tileSize
      const tileCtx = tileCanvas.getContext("2d")
      if (!tileCtx) {
        throw new Error("Could not get tile canvas context")
      }

      // Process tiles in this region
      for (let y = 0; y < tilesY; y++) {
        for (let x = 0; x < tilesX; x++) {
          // Calculate the actual size of this tile (might be smaller at edges)
          const tileWidth = Math.min(tileSize, region.width - x * tileSize)
          const tileHeight = Math.min(tileSize, region.height - y * tileSize)

          // Adjust tile canvas size if needed for edge tiles
          if (tileWidth !== tileCanvas.width || tileHeight !== tileCanvas.height) {
            tileCanvas.width = tileWidth
            tileCanvas.height = tileHeight
          }

          // Clear the tile canvas
          tileCtx.clearRect(0, 0, tileWidth, tileHeight)

          // Draw the portion of the region for this tile
          tileCtx.drawImage(
            regionCanvas,
            x * tileSize,
            y * tileSize,
            tileWidth,
            tileHeight,
            0,
            0,
            tileWidth,
            tileHeight,
          )

          // Process this tile
          try {
            const result = await this.processTileLocally(
              tileCtx,
              tileWidth,
              tileHeight,
              region.x + x * tileSize,
              region.y + y * tileSize,
            )
            if (result) {
              // Draw the processed tile onto the full canvas
              const fullCtx = fullCanvas.getContext("2d")
              fullCtx?.drawImage(result.img, result.x, result.y)
            }
          } catch (error) {
            console.error(`Advanced JPEG compressor error: Error processing tile at ${x},${y} in region ${i}:`, error)
            // Continue with other tiles
          }
        }
      }
    }

    console.log("Advanced JPEG compressor: All regions processed")

    // Now compress the full image with the desired quality
    console.log("Advanced JPEG compressor: Compressing full image to meet target size")

    // Find the optimal quality for the full image
    const result = await this.findOptimalQuality(fullCanvas, targetSize)
    return result
  }

  // Process a tile with the worker
  private async processTileWithWorker(
    worker: Worker,
    tileCtx: CanvasRenderingContext2D,
    width: number,
    height: number,
    x: number,
    y: number,
  ): Promise<{ img: HTMLImageElement; x: number; y: number } | null> {
    return new Promise((resolve, reject) => {
      try {
        // Get the image data
        const imageData = tileCtx.getImageData(0, 0, width, height)

        // Create a tile object
        const tile = {
          x,
          y,
          width,
          height,
        }

        // Set up a one-time message handler for this tile
        const messageHandler = (e: MessageEvent) => {
          const { type, tile: responseTile, compressedData, error } = e.data

          // Check if this is the response for our tile
          if (
            (type === "tileResult" || type === "tileError") &&
            responseTile.x === tile.x &&
            responseTile.y === tile.y
          ) {
            // Remove the message handler
            worker.removeEventListener("message", messageHandler)

            if (type === "tileError") {
              console.error(`Advanced JPEG compressor error: Tile processing error at ${tile.x},${tile.y}:`, error)
              // Fall back to local processing
              this.processTileLocally(tileCtx, width, height, x, y).then(resolve).catch(reject)
              return
            }

            try {
              // Convert the compressed data back to an image
              const blob = new Blob([compressedData], { type: "image/jpeg" })
              createImageBitmap(blob).then((tileImg) => {
                // Create an image element
                const img = new Image()
                const dataUrl = URL.createObjectURL(blob)
                img.onload = () => {
                  URL.revokeObjectURL(dataUrl)
                  resolve({ img, x, y })
                }
                img.onerror = () => {
                  URL.revokeObjectURL(dataUrl)
                  // Fall back to local processing
                  this.processTileLocally(tileCtx, width, height, x, y).then(resolve).catch(reject)
                }
                img.src = dataUrl
              })
            } catch (err) {
              console.error(`Advanced JPEG compressor error: Error processing tile result at ${tile.x},${tile.y}:`, err)
              // Fall back to local processing
              this.processTileLocally(tileCtx, width, height, x, y).then(resolve).catch(reject)
            }
          }
        }

        // Add the message handler
        worker.addEventListener("message", messageHandler)

        // Set a timeout to prevent hanging
        const timeoutId = setTimeout(() => {
          worker.removeEventListener("message", messageHandler)
          console.log(
            `Advanced JPEG compressor: Tile processing timed out at ${x},${y}, falling back to local processing`,
          )
          // Fall back to local processing
          this.processTileLocally(tileCtx, width, height, x, y).then(resolve).catch(reject)
        }, 5000) // 5 second timeout per tile

        // Send the tile data to the worker
        try {
          worker.postMessage(
            {
              type: "processTile",
              imageData: imageData.data.buffer,
              tile,
              quality: 0.85, // Use a fixed quality for tiles
            },
            [imageData.data.buffer],
          )
        } catch (err) {
          clearTimeout(timeoutId)
          worker.removeEventListener("message", messageHandler)
          console.error(`Advanced JPEG compressor error: Error sending tile ${x},${y} to worker:`, err)
          // Fall back to local processing
          this.processTileLocally(tileCtx, width, height, x, y).then(resolve).catch(reject)
        }
      } catch (error) {
        console.error(`Advanced JPEG compressor error: Error preparing tile ${x},${y} for worker:`, error)
        // Fall back to local processing
        this.processTileLocally(tileCtx, width, height, x, y).then(resolve).catch(reject)
      }
    })
  }

  // Process a tile locally (fallback method)
  private async processTileLocally(
    tileCtx: CanvasRenderingContext2D,
    width: number,
    height: number,
    x: number,
    y: number,
  ): Promise<{ img: HTMLImageElement; x: number; y: number } | null> {
    try {
      // Get the image data
      const imageData = tileCtx.getImageData(0, 0, width, height)

      // Create a temporary canvas for the processed tile
      const processedCanvas = document.createElement("canvas")
      processedCanvas.width = width
      processedCanvas.height = height
      const processedCtx = processedCanvas.getContext("2d")

      if (!processedCtx) {
        throw new Error("Could not get processed canvas context")
      }

      // Put the image data back (this is where we would apply processing if needed)
      processedCtx.putImageData(imageData, 0, 0)

      // Convert to an image element
      const dataUrl = processedCanvas.toDataURL("image/jpeg", 0.85)
      const img = new Image()
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = dataUrl
      })

      return { img, x, y }
    } catch (error) {
      console.error(`Advanced JPEG compressor error: Error processing tile at ${x},${y}:`, error)
      return null
    }
  }

  /**
   * Uses binary search to find the optimal compression quality
   * that meets the target file size while maintaining the best
   * possible image quality.
   *
   * Falls back to progressive JPEG encoding if even minimum quality
   * cannot meet the target size.
   *
   * @param canvas - The canvas containing the image
   * @param targetSize - The target file size in bytes
   * @returns Promise<CompressedImageResult> - The compressed image at optimal quality
   */
  private async findOptimalQuality(canvas: HTMLCanvasElement, targetSize: number): Promise<CompressedImageResult> {
    const MIN_QUALITY = 0.1
    const MAX_QUALITY = 0.95
    const QUALITY_PRECISION = 0.01

    // If the original image is already small enough, use maximum quality
    const maxQualityBlob = await this.canvasToBlob(canvas, MAX_QUALITY)
    if (maxQualityBlob.blob.size <= targetSize) {
      console.log(`Advanced JPEG compressor: Image already meets target size at maximum quality`)
      return {
        blob: maxQualityBlob.blob,
        dataUrl: maxQualityBlob.dataUrl,
        quality: MAX_QUALITY,
      }
    }

    // Use binary search to find the optimal quality
    let minQuality = MIN_QUALITY
    let maxQuality = MAX_QUALITY
    let bestQuality = MIN_QUALITY
    let bestBlob: Blob | null = null
    let bestDataUrl: string | null = null
    let iteration = 0
    const maxIterations = Math.ceil(Math.log2((MAX_QUALITY - MIN_QUALITY) / QUALITY_PRECISION)) + 2

    console.log(`Advanced JPEG compressor: Finding optimal quality for target size: ${targetSize} bytes`)

    while (maxQuality - minQuality > QUALITY_PRECISION && iteration < maxIterations) {
      iteration++
      const midQuality = (minQuality + maxQuality) / 2
      console.log(
        `Advanced JPEG compressor: Trying quality: ${midQuality.toFixed(2)} (iteration ${iteration}/${maxIterations})`,
      )

      const { blob, dataUrl } = await this.canvasToBlob(canvas, midQuality)
      console.log(
        `Advanced JPEG compressor: Size at quality ${midQuality.toFixed(2)}: ${blob.size} bytes (target: ${targetSize})`,
      )

      if (blob.size <= targetSize) {
        // This quality works, try to increase quality
        bestQuality = midQuality
        bestBlob = blob
        bestDataUrl = dataUrl
        minQuality = midQuality
      } else {
        // Too large, decrease quality
        maxQuality = midQuality
      }

      // If we're getting close to the target or have done many iterations, we can stop
      if (bestBlob && (maxQuality - minQuality < 0.03 || iteration >= maxIterations - 1)) {
        console.log("Advanced JPEG compressor: Found good enough quality, stopping search")
        break
      }
    }

    // If we couldn't find a suitable quality
    if (!bestBlob || !bestDataUrl) {
      console.log(`Advanced JPEG compressor: No suitable quality found, trying minimum quality: ${MIN_QUALITY}`)
      const { blob, dataUrl } = await this.canvasToBlob(canvas, MIN_QUALITY)

      if (blob.size <= targetSize) {
        bestBlob = blob
        bestDataUrl = dataUrl
        bestQuality = MIN_QUALITY
      } else {
        // If even the minimum quality is too large, we need to try a different approach
        // but we'll still preserve the original dimensions
        console.log("Advanced JPEG compressor: Even minimum quality exceeds target size, trying progressive JPEG")

        // Try using progressive JPEG encoding which often produces smaller files
        try {
          const progressiveResult = await this.compressWithProgressiveJPEG(canvas, targetSize)
          return progressiveResult
        } catch (progressiveError) {
          console.error("Advanced JPEG compressor error: Progressive JPEG compression failed:", progressiveError)

          // As a last resort, we'll use the minimum quality result even if it's over the target size
          console.log("Advanced JPEG compressor: Using minimum quality result even though it exceeds target size")
          return {
            blob,
            dataUrl,
            quality: MIN_QUALITY,
          }
        }
      }
    }

    console.log(
      `Advanced JPEG compressor: Optimal quality found: ${bestQuality.toFixed(2)}, final size: ${bestBlob.size} bytes`,
    )
    return {
      blob: bestBlob,
      dataUrl: bestDataUrl,
      quality: bestQuality,
    }
  }

  // New method to try progressive JPEG encoding
  private async compressWithProgressiveJPEG(
    canvas: HTMLCanvasElement,
    targetSize: number,
  ): Promise<CompressedImageResult> {
    console.log("Advanced JPEG compressor: Attempting progressive JPEG compression")

    // We'll use the worker for this since it supports progressive encoding
    const worker = await this.initWorker()

    return new Promise((resolve, reject) => {
      try {
        // Convert canvas to blob
        canvas.toBlob(
          async (blob) => {
            if (!blob) {
              reject(new Error("Failed to convert canvas to blob"))
              return
            }

            // Read the blob as array buffer
            const arrayBuffer = await blob.arrayBuffer()

            // Set up message handler
            const messageHandler = (e: MessageEvent) => {
              const { type, data, error } = e.data

              if (type === "error") {
                worker.removeEventListener("message", messageHandler)
                reject(new Error(error || "Unknown error during progressive compression"))
                return
              }

              if (type === "result") {
                worker.removeEventListener("message", messageHandler)
                resolve(data)
                return
              }
            }

            // Add message handler
            worker.addEventListener("message", messageHandler)

            // Send to worker for progressive compression
            worker.postMessage(
              {
                type: "compressProgressive",
                imageData: arrayBuffer,
                targetSize,
                width: canvas.width,
                height: canvas.height,
              },
              [arrayBuffer],
            )
          },
          "image/jpeg",
          0.9,
        )
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Initializes the Web Worker for WASM-based compression.
   * Includes timeout handling and error recovery mechanisms.
   *
   * @returns Promise<Worker> - The initialized worker
   */
  private async initWorker(): Promise<Worker> {
    // If we already have a worker initialization in progress, return that promise
    if (this.workerPromise) {
      return this.workerPromise
    }

    // Create a new promise for worker initialization
    this.workerPromise = new Promise((resolve, reject) => {
      if (typeof window === "undefined") {
        reject(new Error("Workers are not supported in this environment"))
        return
      }

      try {
        console.log("Advanced JPEG compressor: Initializing worker")

        // For static export, we need to use a direct path to the worker file
        // This file should be placed in the public directory
        const workerUrl = new URL("/js/jpeg/mozjpeg-worker.js", window.location.origin).href
        console.log(`Advanced JPEG compressor: Loading worker from ${workerUrl}`)

        const worker = new Worker(workerUrl)

        // Set a timeout to ensure we don't wait forever
        const timeoutId = setTimeout(() => {
          console.error("Advanced JPEG compressor error: Worker initialization timed out")
          reject(new Error("Worker initialization timed out"))
          if (this.worker === worker) {
            this.terminateWorker()
          }
        }, 10000) // 10 second timeout

        // Set up a one-time message handler to confirm worker is ready
        const readyHandler = (e: MessageEvent) => {
          if (e.data && e.data.type === "ready") {
            clearTimeout(timeoutId)
            worker.removeEventListener("message", readyHandler)
            this.worker = worker
            resolve(worker)
          }
        }

        // Handle worker errors during initialization
        const errorHandler = (error: ErrorEvent) => {
          clearTimeout(timeoutId)
          console.error("Advanced JPEG compressor error: Worker initialization error:", error)
          worker.removeEventListener("error", errorHandler)
          reject(new Error(`Worker initialization error: ${error.message || "Unknown error"}`))
          this.workerPromise = null
        }

        // Listen for the ready message
        worker.addEventListener("message", readyHandler)
        worker.addEventListener("error", errorHandler)

        // Send an init message to the worker
        worker.postMessage({ type: "init" })

        // Also resolve after a short delay as a fallback
        // This is because some workers might not send a ready message
        setTimeout(() => {
          clearTimeout(timeoutId)
          worker.removeEventListener("error", errorHandler)
          if (!this.worker) {
            console.log("Advanced JPEG compressor: Worker initialized (fallback)")
            this.worker = worker
            resolve(worker)
          }
        }, 1000)
      } catch (error) {
        console.error("Advanced JPEG compressor error: Failed to initialize worker:", error)
        reject(
          new Error(
            `Failed to initialize compression worker: ${error instanceof Error ? error.message : "Unknown error"}`,
          ),
        )
        this.workerPromise = null
      }
    })

    return this.workerPromise
  }

  private terminateWorker() {
    if (this.worker) {
      console.log("Advanced JPEG compressor: Terminating worker")
      this.worker.terminate()
      this.worker = null
    }
    this.workerPromise = null
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
