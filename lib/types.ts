/**
 * Core type definitions for the image compression system
 * These types provide a consistent interface for different compressor implementations
 */

/**
 * Represents the result of a compression operation
 */
export interface CompressedImageResult {
  blob: Blob // The compressed image as a Blob
  dataUrl: string // Data URL for preview/display
  quality: number // The quality setting used (0.1-1.0)
}

/**
 * Interface for image compressor implementations
 * This allows for different compression strategies (simple, advanced, different formats)
 * while maintaining a consistent API
 */
export interface ImageCompressor {
  compress(file: File): Promise<CompressedImageResult> // Main compression method
  supportedTypes: string[] // MIME types supported by this compressor
}
