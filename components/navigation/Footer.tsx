"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"

export function Footer({ className }: { className?: string }) {
  return (
    <footer
      className={cn("bg-[#0a0a0a] w-full border-t border-gray-500 py-4", className)}
      role="contentinfo"
      aria-label="Site Footer"
    >
      <div className="container mx-auto flex flex-col items-center sm:flex-row sm:justify-between px-6 space-y-4 sm:space-y-0">
          {/* Left Side - Brand Name */}
          <Link href="/">
            <span className="text-md font-semibold text-white transition-transform duration-200 hover:scale-105 inline-block">Image Compressor</span>
          </Link>
          <span className=" text-gray-500">© {new Date().getFullYear()} All rights reserved.</span>

          {/* Right Side - Privacy Policy CTA */}
          <Link href="/privacy-policy" className="text-gray-500 hover:text-white transition">
            Privacy Policy
          </Link>
        </div>
    </footer>
  )
}
