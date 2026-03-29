/**
 * AI Chat routes — Phase 11.1.1 + 11.1.3
 *
 * POST   /api/ai/chat                       — SSE streaming chat
 * GET    /api/ai/conversations               — list user conversations
 * GET    /api/ai/conversations/:id           — get full conversation
 * DELETE /api/ai/conversations/:id           — delete conversation
 * PATCH  /api/ai/conversations/:id/title     — rename conversation
 */

import { Router, Request, Response } from "express";
import { streamText, tool } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { z } from "zod";
import prisma from "../prismaClient";
import { authenticate } from "../middlewares/auth.middleware";
import { AIFeaturesService } from "../services/aiFeatures.service";

// ─── Error logger — writes to AiUsageLog ────────────────────────────────────

async function logAiError(feature: string, err: unknown): Promise<void> {
  console.error(`[ai-chat] ${feature} error:`, err);
  try {
    await prisma.aiUsageLog.create({
      data: {
        provider: "groq",
        feature,
        success: false,
        latencyMs: 0,
      },
    });
  } catch {
    // DB logging is best-effort; never throw from here
  }
}

const router = Router();

// ─── Rate limiter (in-memory, 30 messages per hour per user) ─────────────────

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateBucket>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  let bucket = rateBuckets.get(userId);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateBuckets.set(userId, bucket);
  }

  if (bucket.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  bucket.count += 1;
  return { allowed: true, remaining: RATE_LIMIT - bucket.count };
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an AI assistant for a Nigerian real estate platform. You help users find properties, analyze prices, and understand the market. You have deep knowledge of Nigerian property markets, especially Lagos, Abuja, Port Harcourt, and other major cities. You understand Nigerian English, local area names, and pricing conventions (Naira, "million", "k" = thousand). Always be helpful, concise, and specific. Never make up property data — use the tools to look up real information.`;

// ─── Content filter ───────────────────────────────────────────────────────────

const CONTENT_FILTER_PATTERN = /(advance fee|419|send money|western union)/i;

// ─── LLM Tools ───────────────────────────────────────────────────────────────

const searchPropertiesTool = tool({
  description: "Search for properties matching criteria",
  parameters: z.object({
    query: z.string().optional(),
    area: z.string().optional(),
    minPrice: z.number().optional(),
    maxPrice: z.number().optional(),
    bedrooms: z.number().optional(),
    category: z.enum(["RESIDENTIAL", "COMMERCIAL", "LAND", "INDUSTRIAL", "SHORTLET"]).optional(),
    listingType: z.enum(["SALE", "RENT", "LEASE", "SHORTLET"]).optional(),
    limit: z.number().default(5),
  }),
  execute: async (params) => {
    try {
      const where: Record<string, any> = {
        deletedAt: null,
        status: "AVAILABLE",
      };

      if (params.area) {
        where.area = { contains: params.area, mode: "insensitive" };
      }
      if (params.minPrice !== undefined || params.maxPrice !== undefined) {
        where.price = {};
        if (params.minPrice !== undefined) where.price.gte = params.minPrice;
        if (params.maxPrice !== undefined) where.price.lte = params.maxPrice;
      }
      if (params.bedrooms !== undefined) {
        where.bedrooms = params.bedrooms;
      }
      if (params.category) {
        where.category = params.category;
      }
      if (params.listingType) {
        where.listingType = params.listingType;
      }
      if (params.query) {
        where.OR = [
          { title: { contains: params.query, mode: "insensitive" } },
          { description: { contains: params.query, mode: "insensitive" } },
          { area: { contains: params.query, mode: "insensitive" } },
          { locationText: { contains: params.query, mode: "insensitive" } },
        ];
      }

      const properties = await prisma.property.findMany({
        where,
        select: {
          id: true,
          title: true,
          price: true,
          priceCurrency: true,
          area: true,
          state: true,
          bedrooms: true,
          bathrooms: true,
          category: true,
          listingType: true,
          qualityScore: true,
          listingUrl: true,
        },
        orderBy: [{ qualityScore: "desc" }, { createdAt: "desc" }],
        take: Math.min(params.limit, 10),
      });

      if (properties.length === 0) {
        return { results: [], message: "No properties found matching your criteria." };
      }

      return { results: properties, count: properties.length };
    } catch (err) {
      console.error("[ai-chat] search_properties tool error:", err);
      return { results: [], message: "No results found" };
    }
  },
});

const getPropertyDetailTool = tool({
  description: "Get full property details by ID including price history and agent info",
  parameters: z.object({
    propertyId: z.string().describe("The property ID to look up"),
  }),
  execute: async ({ propertyId }) => {
    try {
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
        include: {
          priceHistory: {
            orderBy: { recordedAt: "desc" },
            take: 10,
          },
          _count: {
            select: { versions: true },
          },
        },
      });

      if (!property) {
        return { error: true, message: "Property not found" };
      }

      const imagesCount = Array.isArray(property.images)
        ? property.images.length
        : property.images
        ? Object.keys(property.images as object).length
        : 0;

      return {
        id: property.id,
        title: property.title,
        price: property.price,
        priceCurrency: property.priceCurrency,
        priceNegotiable: property.priceNegotiable,
        area: property.area,
        state: property.state,
        fullAddress: property.fullAddress,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        toilets: property.toilets,
        category: property.category,
        listingType: property.listingType,
        propertyType: property.propertyType,
        furnishing: property.furnishing,
        condition: property.condition,
        landSizeSqm: property.landSizeSqm,
        buildingSizeSqm: property.buildingSizeSqm,
        features: property.features,
        agentName: property.agentName,
        agentPhone: property.agentPhone,
        agencyName: property.agencyName,
        qualityScore: property.qualityScore,
        imagesCount,
        priceHistory: property.priceHistory.map((p) => ({
          price: p.price,
          recordedAt: p.recordedAt,
        })),
        listingUrl: property.listingUrl,
        status: property.status,
      };
    } catch (err) {
      console.error("[ai-chat] get_property_detail tool error:", err);
      return { error: true, message: "No results found" };
    }
  },
});

const getMarketStatsTool = tool({
  description:
    "Get aggregate market statistics for a specific area including average price, min/max, count, price per sqm, and price trend",
  parameters: z.object({
    area: z.string().optional().describe("Area or neighbourhood name"),
    state: z.string().optional().describe("State name (e.g. Lagos, Abuja)"),
    listingType: z.enum(["SALE", "RENT", "LEASE", "SHORTLET"]).optional(),
    category: z.enum(["RESIDENTIAL", "COMMERCIAL", "LAND", "INDUSTRIAL", "SHORTLET"]).optional(),
  }),
  execute: async (params) => {
    try {
      const where: Record<string, any> = {
        deletedAt: null,
        status: "AVAILABLE",
        price: { not: null },
      };

      if (params.area) where.area = { contains: params.area, mode: "insensitive" };
      if (params.state) where.state = { contains: params.state, mode: "insensitive" };
      if (params.listingType) where.listingType = params.listingType;
      if (params.category) where.category = params.category;

      const [aggregate, count] = await Promise.all([
        prisma.property.aggregate({
          where,
          _avg: { price: true, pricePerSqm: true },
          _min: { price: true },
          _max: { price: true },
          _count: { id: true },
        }),
        prisma.property.count({ where }),
      ]);

      // Price trend: compare current month vs last month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      const [currentMonthAvg, lastMonthAvg] = await Promise.all([
        prisma.property.aggregate({
          where: { ...where, createdAt: { gte: startOfMonth } },
          _avg: { price: true },
          _count: { id: true },
        }),
        prisma.property.aggregate({
          where: { ...where, createdAt: { gte: startOfLastMonth, lt: startOfMonth } },
          _avg: { price: true },
          _count: { id: true },
        }),
      ]);

      let priceTrend: string | null = null;
      if (currentMonthAvg._avg.price && lastMonthAvg._avg.price) {
        const pct =
          ((currentMonthAvg._avg.price - lastMonthAvg._avg.price) /
            lastMonthAvg._avg.price) *
          100;
        priceTrend = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% vs last month`;
      }

      return {
        area: params.area || params.state || "All",
        listingCount: count,
        avgPrice: aggregate._avg.price,
        minPrice: aggregate._min.price,
        maxPrice: aggregate._max.price,
        avgPricePerSqm: aggregate._avg.pricePerSqm,
        priceTrend,
        thisMonthCount: currentMonthAvg._count.id,
        lastMonthCount: lastMonthAvg._count.id,
      };
    } catch (err) {
      console.error("[ai-chat] get_market_stats tool error:", err);
      return { results: [], message: "No results found" };
    }
  },
});

const getAnalyticsSummaryTool = tool({
  description: "Get overall platform analytics: total properties, new listings this week, top areas, and average quality score",
  parameters: z.object({}),
  execute: async () => {
    try {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const [total, newThisWeek, avgQuality] = await Promise.all([
        prisma.property.count({ where: { deletedAt: null } }),
        prisma.property.count({ where: { deletedAt: null, createdAt: { gte: oneWeekAgo } } }),
        prisma.property.aggregate({
          where: { deletedAt: null, qualityScore: { not: null } },
          _avg: { qualityScore: true },
          _count: { id: true },
        }),
      ]);

      // Top areas by listing count
      const topAreasRaw = await prisma.property.groupBy({
        by: ["area", "state"],
        where: { deletedAt: null, area: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      });

      const topAreas = topAreasRaw.map((a) => ({
        area: a.area,
        state: a.state,
        count: a._count.id,
      }));

      return {
        totalProperties: total,
        newThisWeek,
        avgQualityScore: avgQuality._avg.qualityScore,
        topAreas,
      };
    } catch (err) {
      console.error("[ai-chat] get_analytics_summary tool error:", err);
      return { results: [], message: "No results found" };
    }
  },
});

// ─── POST /api/ai/chat ────────────────────────────────────────────────────────

router.post("/chat", authenticate, async (req: Request, res: Response) => {
  const userId = req.user!.id;

  try {
    // 1. Feature flags
    const [masterEnabled, chatEnabled] = await Promise.all([
      AIFeaturesService.isEnabled("ai_master"),
      AIFeaturesService.isEnabled("ai_chat"),
    ]);

    if (!masterEnabled || !chatEnabled) {
      return res.status(503).json({
        success: false,
        error: "AI chat is currently disabled",
      });
    }

    // 2. Rate limit check
    const { allowed, remaining } = checkRateLimit(userId);
    if (!allowed) {
      return res.status(429).json({
        success: false,
        error: "Rate limit reached. You can send up to 30 messages per hour.",
      });
    }

    // 3. Parse and validate body
    let { message, conversationId, context, propertyId } = req.body as {
      message: string;
      conversationId?: string;
      context?: string;
      propertyId?: string;
    };

    if (!message || typeof message !== "string") {
      return res.status(400).json({ success: false, error: "message is required" });
    }

    // Edge case: trim message > 2000 chars (no error)
    if (message.length > 2000) {
      message = message.slice(0, 2000);
    }

    // Edge case: content filter
    if (CONTENT_FILTER_PATTERN.test(message)) {
      return res.json({
        success: true,
        warning: true,
        message:
          "Your message contains patterns associated with fraudulent activity. I'm not able to assist with advance fee schemes or money transfer requests. If you have a legitimate real estate question, please rephrase.",
      });
    }

    // 4. Load conversation history
    let conversationMessages: Array<{ role: string; content: string }> = [];
    if (conversationId) {
      const conversation = await prisma.aiConversation.findFirst({
        where: { id: conversationId, userId },
      });
      if (conversation && Array.isArray(conversation.messages)) {
        conversationMessages = conversation.messages as Array<{ role: string; content: string }>;
      }
    }

    // 5. Build system prompt + optional property context
    let systemContent = SYSTEM_PROMPT;

    if (propertyId) {
      try {
        const property = await prisma.property.findUnique({
          where: { id: propertyId },
          select: {
            id: true,
            title: true,
            price: true,
            priceCurrency: true,
            area: true,
            state: true,
            bedrooms: true,
            bathrooms: true,
            category: true,
            listingType: true,
            description: true,
            features: true,
            agentName: true,
            agentPhone: true,
          },
        });
        if (property) {
          systemContent += `\n\nCurrent property context:\n${JSON.stringify(property, null, 2)}`;
        }
      } catch (propErr) {
        console.error("[ai-chat] Failed to load property context:", propErr);
      }
    }

    if (context) {
      systemContent += `\n\nAdditional context:\n${context}`;
    }

    // 6. Assemble messages for AI SDK
    const aiMessages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...conversationMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      { role: "user", content: message },
    ];

    // 7. Stream via Groq
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY || "" });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Rate-Limit-Remaining", String(remaining));
    res.flushHeaders();

    let fullAssistantText = "";

    try {
      const result = streamText({
        model: groq("llama-3.3-70b-versatile"),
        system: systemContent,
        messages: aiMessages,
        tools: {
          search_properties: searchPropertiesTool,
          get_property_detail: getPropertyDetailTool,
          get_market_stats: getMarketStatsTool,
          get_analytics_summary: getAnalyticsSummaryTool,
        },
        maxSteps: 5,
        onFinish: async ({ text }) => {
          fullAssistantText = text;
        },
      });

      // Pipe the AI SDK data stream to Express response
      const dataStream = result.toDataStreamResponse();
      const body = dataStream.body;

      if (body) {
        const reader = body.getReader();
        const pump = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(value);
            }
          } catch (pumpErr) {
            // Client disconnected
          } finally {
            // 8. Save conversation to DB after streaming completes
            try {
              const updatedMessages = [
                ...conversationMessages,
                { role: "user", content: message },
                ...(fullAssistantText
                  ? [{ role: "assistant", content: fullAssistantText }]
                  : []),
              ];

              // Auto-generate title from first message if new conversation
              const title =
                !conversationId && message.length > 0
                  ? message.slice(0, 60) + (message.length > 60 ? "…" : "")
                  : undefined;

              if (conversationId) {
                await prisma.aiConversation.updateMany({
                  where: { id: conversationId, userId },
                  data: { messages: updatedMessages },
                });
              } else {
                await prisma.aiConversation.create({
                  data: {
                    userId,
                    title: title || "New conversation",
                    messages: updatedMessages,
                  },
                });
              }
            } catch (dbErr) {
              console.error("[ai-chat] Failed to save conversation:", dbErr);
            }

            res.end();
          }
        };

        await pump();
      } else {
        // Edge case: empty/null stream
        res.write(`data: ${JSON.stringify({ type: "text", text: "I couldn't process that. Try rephrasing?" })}\n\n`);
        res.end();
      }
    } catch (streamErr: any) {
      await logAiError("ai_chat_stream", streamErr);

      // Edge case: empty/null LLM response — never expose raw errors
      if (!res.headersSent) {
        res.setHeader("Content-Type", "application/json");
        return res.status(200).json({
          error: false,
          message: "I couldn't process that. Try rephrasing?",
        });
      }

      res.write(
        `data: ${JSON.stringify({ type: "error", message: "I couldn't process that. Try rephrasing?" })}\n\n`
      );
      res.end();
    }
  } catch (err: any) {
    await logAiError("ai_chat", err);

    if (!res.headersSent) {
      return res.status(500).json({
        error: false,
        message: "I couldn't process that. Try rephrasing?",
      });
    }
  }
});

// ─── GET /api/ai/conversations ────────────────────────────────────────────────

router.get("/conversations", authenticate, async (req: Request, res: Response) => {
  const userId = req.user!.id;

  try {
    const conversations = await prisma.aiConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        messages: true,
      },
    });

    const result = conversations.map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: Array.isArray(c.messages) ? c.messages.length : 0,
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    console.error("[ai-chat] GET /conversations error:", err);
    res.status(500).json({ success: false, error: "Failed to load conversations" });
  }
});

// ─── GET /api/ai/conversations/:id ───────────────────────────────────────────

router.get("/conversations/:id", authenticate, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    const conversation = await prisma.aiConversation.findFirst({
      where: { id, userId },
    });

    if (!conversation) {
      return res.status(404).json({ success: false, error: "Conversation not found" });
    }

    res.json({ success: true, data: conversation });
  } catch (err) {
    console.error("[ai-chat] GET /conversations/:id error:", err);
    res.status(500).json({ success: false, error: "Failed to load conversation" });
  }
});

// ─── DELETE /api/ai/conversations/:id ────────────────────────────────────────

router.delete("/conversations/:id", authenticate, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    const existing = await prisma.aiConversation.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "Conversation not found" });
    }

    await prisma.aiConversation.delete({ where: { id } });

    res.json({ success: true, message: "Conversation deleted" });
  } catch (err) {
    console.error("[ai-chat] DELETE /conversations/:id error:", err);
    res.status(500).json({ success: false, error: "Failed to delete conversation" });
  }
});

// ─── PATCH /api/ai/conversations/:id/title ───────────────────────────────────

router.patch("/conversations/:id/title", authenticate, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const { title } = req.body as { title?: string };

  if (!title || typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ success: false, error: "title is required" });
  }

  try {
    const existing = await prisma.aiConversation.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "Conversation not found" });
    }

    const updated = await prisma.aiConversation.update({
      where: { id },
      data: { title: title.trim().slice(0, 200) },
    });

    res.json({ success: true, data: { id: updated.id, title: updated.title } });
  } catch (err) {
    console.error("[ai-chat] PATCH /conversations/:id/title error:", err);
    res.status(500).json({ success: false, error: "Failed to update conversation title" });
  }
});

export default router;
