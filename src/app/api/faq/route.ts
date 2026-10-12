// =============================================================================
// GET /api/faq
// Published FAQ items grouped by category.
// Supports ?category=X to filter a single category.
// =============================================================================

import type { NextRequest} from "next/server";
import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { successResponse, errorResponse } from "@/lib/utils"

export const revalidate = 600 // 10 minutes — FAQ changes rarely

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl
  const category = searchParams.get("category") ?? undefined

  const where = {
    isPublished: true,
    ...(category ? { category } : {}),
  }

  try {
    const faqs = await prisma.fAQ.findMany({
      where,
      orderBy: [{ category: "asc" }, { displayOrder: "asc" }],
      select: {
        id:          true,
        question:    true,
        answer:      true,
        category:    true,
        displayOrder: true,
      },
    })

    // Group by category
    const grouped = faqs.reduce(
      (acc, faq) => {
        if (!acc[faq.category]) {acc[faq.category] = []}
        acc[faq.category]!.push(faq)
        return acc
      },
      {} as Record<string, typeof faqs>,
    )

    return NextResponse.json(successResponse({ faqs, grouped, total: faqs.length }))
  } catch (err) {
    console.error("[GET /api/faq]", err)
    return NextResponse.json(
      errorResponse("Failed to fetch FAQ.", "INTERNAL"),
      { status: 500 },
    )
  }
}
