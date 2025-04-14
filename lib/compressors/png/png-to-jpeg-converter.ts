/**
 * PNG to JPEG Converter
 *
 * Converts PNG images to JPEG format for more efficient compression.
 * Handles transparency by replacing it with a configurable background color.
 * This conversion can significantly improve compression ratios for photographic content.
 */

/**
 * Options for PNG to JPEG conversion
 */
export interface PngToJpegOptions {
  /**
   * Quality of the JPEG output (0.0 to 1.0)
   * @default 0.95
   */
  quality?: number

  /**
   * Background color to use for transparent pixels
   * @default "#FFFFFF" (white)
   */
  backgroundColor?: string

  /**
   * Whether to preserve metadata like EXIF data
   * @default false
   */
  preserveMetadata?: boolean
}

/**
 * Converts a PNG file to JPEG format
 *
 * @param file - The PNG file to convert
 * @param options - Conversion options
 * @returns Promise<File> - A new File object in JPEG format
 */
export async function convertPngToJpeg(file: File, options: PngToJpegOptions = {}): Promise<File> {
  // Set default options
  const quality = options.quality ?? 0.95
  const backgroundColor = options.backgroundColor ?? "#FFFFFF"

  // Validate input
  if (file.type !== "image/png") {
    throw new Error("Input file must be a PNG image")
  }

  try {
    // Create an image from the file
    const img = await createImageFromFile(file)

    // Create a canvas with the same dimensions
    const canvas = document.createElement("canvas")
    canvas.width = img.width
    canvas.height = img.height

    // Get the canvas context
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      throw new Error("Could not get canvas context")
    }

    // Fill the canvas with the background color for transparency
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw the image on top
    ctx.drawImage(img, 0, 0)

    // Convert to JPEG blob
    const blob = await canvasToBlob(canvas, "image/jpeg", quality)

    // Create a new filename with .jpg extension
    const originalName = file.name
    const baseName = originalName.substring(0, originalName.lastIndexOf(".")) || originalName
    const newFileName = `${baseName}.jpg`

    // Create a new File object
    const jpegFile = new File([blob], newFileName, { type: "image/jpeg" })

    return jpegFile
  } catch (error) {
    console.error("PNG to JPEG converter error: Conversion failed", error)
    throw new Error(`Failed to convert PNG to JPEG: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * Creates an HTMLImageElement from a File
 */
function createImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(file)
    img.crossOrigin = "anonymous" // Avoid CORS issues with canvas
  })
}

/**
 * Converts a canvas to a Blob
 */
function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error("Canvas to Blob conversion failed"))
        }
      },
      type,
      quality,
    )
  })
}
