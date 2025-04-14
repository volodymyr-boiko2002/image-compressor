"use client"

import { useState, useRef, type DragEvent, type ChangeEvent } from "react"
import { Upload } from "lucide-react"

interface ImageUploaderProps {
  onImageUpload: (file: File) => void
}

/**
 * ImageUploader Component
 *
 * A reusable component that handles image file uploads through both drag-and-drop
 * and traditional file selection. Includes built-in validation for file type and size.
 *
 * Features:
 * - Drag and drop interface with visual feedback
 * - File type validation (JPEG/JPG and PNG)
 * - File size validation (up to 20MB)
 * - Error messaging for invalid files
 */
export default function ImageUploader({ onImageUpload }: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * Validates the uploaded file against type and size constraints.
   * @param file - The file to validate
   * @returns boolean - Whether the file is valid
   */
  const validateFile = (file: File): boolean => {
    // Check file type
    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
      setError("Only JPEG/JPG and PNG files are supported")
      return false
    }

    // Check file size (20MB max)
    const MAX_SIZE = 20 * 1024 * 1024 // 20MB in bytes
    if (file.size > MAX_SIZE) {
      setError("File size exceeds 20MB limit")
      return false
    }

    setError(null)
    return true
  }

  /**
   * Event handlers for drag and drop functionality
   * These manage the visual state and file processing when users
   * drag files over, leave the drop zone, or drop files
   */
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      if (validateFile(file)) {
        onImageUpload(file)
      }
    }
  }

  /**
   * Processes file selection from the file input element
   * Validates the file and passes it to the parent component if valid
   */
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      if (validateFile(file)) {
        onImageUpload(file)
      }
    }
  }

  const handleClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
        isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      role="button"
      aria-label="Upload image area. Click or drag and drop an image file here."
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          handleClick()
        }
      }}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".jpg,.jpeg,.png"
        className="hidden"
        aria-hidden="true"
      />
      <Upload className="mx-auto h-12 w-12 text-gray-400" aria-hidden="true" />
      <div className="mt-4 flex text-sm flex-col items-center">
        <label className="relative cursor-pointer rounded-md font-medium text-blue-600 hover:text-blue-500">
          <span>Upload a JPEG or PNG image</span>
        </label>
        <p className="text-gray-600 mt-1">or drag and drop</p>
        <p className="text-gray-500 mt-1">JPEG/JPG or PNG up to 20MB</p>
      </div>

      {error && (
        <div className="mt-4 text-sm text-red-600 bg-red-50 p-2 rounded" role="alert" aria-live="assertive">
          {error}
        </div>
      )}
    </div>
  )
}
