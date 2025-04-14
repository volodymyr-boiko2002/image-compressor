"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function Header({ className }: { className?: string }) {
  return (
    <header className={cn("py-4 px-4 sm:px-6 lg:px-8", className)} role="navigation" aria-label="Main Navigation">
      <div className="container mx-auto flex flex-wrap justify-between items-center">
        <Link href="/" className="text-lg font-bold sm:text-2xl transition-transform duration-200 hover:scale-105 inline-block" aria-label="Image Compressor Home">
          <span className="bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">
            Image Compressor
          </span>
        </Link>

        <div className="mt-2 sm:mt-0">
          <Link href="/how-to-use">
            <Button
              variant="outline"
              className="border-purple-200 hover:border-purple-300 hover:bg-purple-50"
              aria-label="View usage instructions"
            >
              Instructions
            </Button>
          </Link>
        </div>
      </div>
    </header>
  )
}
