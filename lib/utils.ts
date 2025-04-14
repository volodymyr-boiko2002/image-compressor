/**
 * Utility functions used throughout the application
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combines multiple class names using clsx and tailwind-merge
 * This utility helps with conditional class application while
 * properly handling Tailwind CSS class conflicts
 *
 * @param inputs - Class names to combine
 * @returns String of combined and de-duplicated class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely downloads a Blob as a file
 * Handles the browser-specific details of triggering a download
 * and cleaning up resources afterward
 *
 * @param blob - The Blob to download
 * @param fileName - The filename to use
 * @returns Promise<boolean> - Whether the download was successful
 */
export function downloadBlob(blob: Blob, fileName: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // Create a blob URL for the download
      const url = URL.createObjectURL(blob)

      // Create a temporary anchor element to trigger the download
      const a = document.createElement("a")
      a.style.display = "none"
      a.href = url
      a.download = fileName

      // Append to the document and trigger the download
      document.body.appendChild(a)
      a.click()

      // Clean up resources after download is triggered
      setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        resolve(true)
      }, 100)
    } catch (error) {
      console.error("File download error:", error)
      resolve(false)
    }
  })
}
