"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

/**
 * BeforeAfterSlider Component
 *
 * A responsive and accessible image comparison slider that allows users to compare
 * two images (before/after) by dragging a slider to reveal portions of each image.
 * Specifically designed for comparing original and compressed images while maintaining
 * proper alignment regardless of image dimensions.
 *
 * Features:
 * - Accurate image boundary detection for proper slider positioning
 * - Responsive to window resizing and different image dimensions
 * - Touch and mouse interaction support
 * - Keyboard accessibility with arrow key navigation
 * - Screen reader support with ARIA attributes
 * - Prevents slider from extending beyond actual image boundaries
 *
 * The component calculates the actual dimensions and position of the images within
 * their container to ensure the slider stays perfectly aligned with image edges,
 * even when images are centered or scaled with object-fit: contain.
 */

// Keep the import statements

interface BeforeAfterSliderProps {
  beforeImage: string // URL of the "before" (original) image
  afterImage: string // URL of the "after" (compressed) image
  className?: string // Optional CSS class for styling the container
}

export default function BeforeAfterSlider({ beforeImage, afterImage, className = "" }: BeforeAfterSliderProps) {
  // Track the slider position as a percentage (0-100%) of the image width
  const [sliderPosition, setSliderPosition] = useState(0)

  // Loading state to show a placeholder while images are loading
  const [isLoading, setIsLoading] = useState(true)

  // State to control tooltip visibility
  const [showTooltip, setShowTooltip] = useState(false)

  // State to track if user has ever moved the slider
  const [hasInteracted, setHasInteracted] = useState(false)

  // Store the actual dimensions and position of the image within its container
  // This is crucial for proper slider alignment with the image boundaries
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0, left: 0, top: 0 })

  // Refs to access DOM elements for measurements
  const containerRef = useRef<HTMLDivElement>(null)
  const beforeImageRef = useRef<HTMLImageElement>(null)
  const afterImageRef = useRef<HTMLImageElement>(null)

  /**
   * Reset state and preload images when image sources change
   * This ensures proper initialization when switching between different images
   */
  useEffect(() => {
    setIsLoading(true)
    setSliderPosition(0)

    // Preload both images to ensure we can calculate dimensions correctly
    const beforeImg = new Image()
    const afterImg = new Image()

    let beforeLoaded = false
    let afterLoaded = false

    const checkLoaded = () => {
      if (beforeLoaded && afterLoaded) {
        setIsLoading(false)
        // Small delay to ensure images are fully rendered before measuring
        setTimeout(calculateImageDimensions, 50)
      }
    }

    beforeImg.onload = () => {
      beforeLoaded = true
      checkLoaded()
    }

    afterImg.onload = () => {
      afterLoaded = true
      checkLoaded()
    }

    beforeImg.src = beforeImage
    afterImg.src = afterImage

    return () => {
      // Clean up event listeners to prevent memory leaks
      beforeImg.onload = null
      afterImg.onload = null
    }
  }, [beforeImage, afterImage])

  /**
   * Calculate the actual dimensions and position of the displayed image within the container
   * This is essential for proper slider alignment, especially when images use object-fit: contain
   * and don't fill the entire container (creating space on sides or top/bottom)
   */
  const calculateImageDimensions = useCallback(() => {
    if (!containerRef.current || !afterImageRef.current) return

    const containerRect = containerRef.current.getBoundingClientRect()
    const imageRect = afterImageRef.current.getBoundingClientRect()

    // Calculate the actual image dimensions and position relative to the container
    // This accounts for any spacing created by object-fit: contain
    const dimensions = {
      width: imageRect.width,
      height: imageRect.height,
      left: imageRect.left - containerRect.left,
      top: imageRect.top - containerRect.top,
    }

    setImageDimensions(dimensions)
  }, [])

  /**
   * Recalculate image dimensions when window resizes to maintain proper alignment
   * This ensures the slider stays correctly positioned even after viewport changes
   */
  useEffect(() => {
    if (isLoading) return

    calculateImageDimensions()

    const handleResize = () => {
      calculateImageDimensions()
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [isLoading, calculateImageDimensions])

  /**
   * Handle mouse/touch interaction to update slider position
   * Calculates the position relative to the actual image (not the container)
   * and constrains it to the image boundaries
   *
   * @param clientX - The x-coordinate of the pointer event
   */
  const handleInteraction = (clientX: number) => {
    if (!containerRef.current) return

    const containerRect = containerRef.current.getBoundingClientRect()

    // Calculate x position relative to the image (not the container)
    // This accounts for any spacing between container edge and actual image
    const relativeX = clientX - containerRect.left - imageDimensions.left

    // Convert to percentage of image width (not container width)
    const percentage = (relativeX / imageDimensions.width) * 100

    // Constrain to image boundaries (0-100%)
    const constrainedPercentage = Math.max(0, Math.min(100, percentage))

    setSliderPosition(constrainedPercentage)
  }

  /**
   * Handle mouse down event to start dragging the slider
   * Sets up event listeners for mouse move and mouse up events
   */
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    setShowTooltip(false) // Hide tooltip when user starts dragging
    setHasInteracted(true) // Mark that user has interacted with the slider
    handleInteraction(e.clientX)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      handleInteraction(moveEvent.clientX)
    }

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
  }

  /**
   * Handle touch start event for mobile devices
   * Sets up event listeners for touch move and touch end events
   */
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault()
    setShowTooltip(false) // Hide tooltip when user starts touching
    setHasInteracted(true) // Mark that user has interacted with the slider
    handleInteraction(e.touches[0].clientX)

    const handleTouchMove = (moveEvent: TouchEvent) => {
      handleInteraction(moveEvent.touches[0].clientX)
    }

    const handleTouchEnd = () => {
      document.removeEventListener("touchmove", handleTouchMove)
      document.removeEventListener("touchend", handleTouchEnd)
    }

    document.addEventListener("touchmove", handleTouchMove)
    document.addEventListener("touchend", handleTouchEnd)
  }

  /**
   * Handle keyboard navigation for accessibility
   * Allows users to control the slider with left/right arrow keys
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    setHasInteracted(true) // Mark that user has interacted with the slider
    if (e.key === "ArrowLeft") {
      setSliderPosition((prev) => Math.max(0, prev - 5))
    } else if (e.key === "ArrowRight") {
      setSliderPosition((prev) => Math.min(100, prev + 5))
    }
  }

  // Show loading state while images are being loaded
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <div className="text-sm text-gray-500">Loading comparison...</div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`relative select-none ${className}`}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={sliderPosition}
      aria-label="Image comparison slider"
    >
      {/* Container with relative positioning */}
      <div className="relative w-full h-full flex items-center justify-center">
        {/* After image (compressed) - shown as base layer */}
        <div className="relative w-full h-full flex items-center justify-center">
          <img
            ref={afterImageRef}
            src={afterImage || "/placeholder.svg"}
            alt="Compressed version of the image"
            className="max-w-full max-h-full object-contain"
            draggable="false"
          />
        </div>

        {/* 
          Before image (original) - revealed when sliding
          The width is dynamically calculated based on slider position and actual image width
          This ensures the reveal effect is properly aligned with the slider
        */}
        <div
          className="absolute top-0 left-0 h-full overflow-hidden"
          style={{
            // widsth: `${sliderPosition}%`,
            left: `${imageDimensions.left}px`,
            width: `${(sliderPosition / 100) * imageDimensions.width}px`,
          }}
        >
          <div
            style={{
              width: `${imageDimensions.width}px`,
              height: `${imageDimensions.height}px`,
              position: "relative",
              top: `${imageDimensions.top}px`,
            }}
          >
            <img
              ref={beforeImageRef}
              src={beforeImage || "/placeholder.svg"}
              alt="Original version of the image"
              className="max-w-full max-h-full object-contain"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
              }}
              draggable="false"
            />
          </div>
        </div>

        {/* 
          Slider line - positioned relative to the actual image
          The position is calculated based on slider position and actual image position
          This ensures the slider stays aligned with the image boundaries
        */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white cursor-ew-resize"
          style={{
            left: `${imageDimensions.left + (sliderPosition / 100) * imageDimensions.width}px`,
            height: `${imageDimensions.height}px`,
            top: `${imageDimensions.top}px`,
          }}
        >
          {/* Slider handle with directional chevrons */}
          <TooltipProvider>
            <Tooltip open={showTooltip}>
              <TooltipTrigger asChild>
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center cursor-grab"
                  onMouseEnter={() => !hasInteracted && setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  aria-label="Slider handle. Drag left or right to compare images."
                  role="slider"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(sliderPosition)}
                  tabIndex={0}
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" aria-hidden="true" />
                  <ChevronRight className="w-4 h-4 text-gray-600" aria-hidden="true" />
                </div>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="bg-[#0a0a0a] text-white rounded-lg p-2 shadow-lg border border-gray-800"
              >
                <p>Drag slider to compare original and compressed images</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Screen reader text for accessibility */}
      <span className="sr-only" aria-live="polite">
        Use arrow keys to move the slider left and right to compare the original and compressed images. Current
        position: {Math.round(sliderPosition)}%.
        {sliderPosition < 10
          ? "Showing mostly compressed image."
          : sliderPosition > 90
            ? "Showing mostly original image."
            : "Showing both images for comparison."}
      </span>
    </div>
  )
}
