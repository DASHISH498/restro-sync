import { NextRequest, NextResponse } from "next/server";

interface ExtractedMenuItem {
  name: string;
  category: string;
  price: number;
  is_veg: boolean;
  description?: string | null;
}

const GEMINI_MODEL = "models/gemini-3.8-flash";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function extractTextFromResponse(data: Record<string, unknown>): string {
  const candidates = data?.candidates as
    | { content?: { parts?: { text?: string }[] } }[]
    | undefined;
  const candidateText = candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (candidateText) return candidateText;

  const outputs = data?.outputs as
    | { type?: string; text?: string }[]
    | undefined;
  if (Array.isArray(outputs)) {
    const textOutput = outputs.find((o) => typeof o.text === "string")?.text;
    if (textOutput?.trim()) return textOutput.trim();
  }

  return "[]";
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { imageBase64, mimeType } = body as {
      imageBase64?: string;
      mimeType?: string;
    };

    if (!imageBase64 || !mimeType) {
      return NextResponse.json(
        { error: "Image data and mimeType are required." },
        { status: 400 }
      );
    }

    const prompt = `
You are a menu digitization assistant for restaurants and cafes.
Analyze this menu image and extract every dish/item with:
- "name": clean dish name (string)
- "category": logical category such as "Starters", "Fast Food", "Main Course", "Breads & Rice", "Beverages", "Desserts", "Bakery", or "General" (string)
- "price": numeric price in INR without currency symbol (number > 0; if missing or unclear, estimate 0)
- "is_veg": boolean (true if veg or unspecified in pure-veg/general menu; false if clearly non-veg like chicken, mutton, fish, egg, prawn)
- "description": short optional note if visible, else null

Return ONLY a valid JSON array of objects. Do not include markdown fences or extra text.
`.trim();

    const generateContentPayload = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    };

    let lastData: Record<string, unknown> | null = null;
    let lastStatus = 502;
    let rawText = "";

    for (let attempt = 1; attempt <= 2; attempt++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(
          apiKey
        )}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(generateContentPayload),
        }
      );

      const data = (await res.json()) as Record<string, unknown>;
      lastData = data;
      lastStatus = res.status;

      if (res.ok) {
        rawText = extractTextFromResponse(data);
        break;
      }

      const errObj = data?.error as { message?: string } | undefined;
      const errMsg = (errObj?.message || "").toLowerCase();

      // If Interactions API is requested for this model, try /v1beta/interactions
      if (errMsg.includes("interactions api")) {
        const interRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/interactions?key=${encodeURIComponent(
            apiKey
          )}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: GEMINI_MODEL,
              input: [
                { type: "text", text: prompt },
                {
                  type: "image",
                  inline_data: {
                    mime_type: mimeType,
                    data: imageBase64,
                  },
                },
              ],
            }),
          }
        );

        const interData = (await interRes.json()) as Record<string, unknown>;
        if (interRes.ok) {
          rawText = extractTextFromResponse(interData);
          lastStatus = 200;
          break;
        }
        lastData = interData;
        lastStatus = interRes.status;
      }

      const shouldRetry =
        res.status === 429 ||
        res.status === 503 ||
        errMsg.includes("high demand") ||
        errMsg.includes("overloaded") ||
        errMsg.includes("try again later");

      if (shouldRetry && attempt < 2) {
        await sleep(1000 * attempt);
        continue;
      }
      break;
    }

    if (!rawText) {
      const errObj = lastData?.error as { message?: string } | undefined;
      return NextResponse.json(
        {
          error:
            errObj?.message ||
            "Failed to analyze menu photo with models/gemini-3.8-flash.",
        },
        { status: lastStatus >= 400 ? lastStatus : 502 }
      );
    }

    const cleanedJson = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleanedJson);
    const items: ExtractedMenuItem[] = (Array.isArray(parsed) ? parsed : [])
      .map((row) => ({
        name: String(row?.name || "").trim(),
        category: String(row?.category || "General").trim() || "General",
        price: Number(row?.price) > 0 ? Number(row.price) : 0,
        is_veg:
          typeof row?.is_veg === "boolean"
            ? row.is_veg
            : !/\b(chicken|mutton|fish|prawn|egg|non-veg|non veg)\b/i.test(
                String(row?.name || "")
              ),
        description: row?.description ? String(row.description).trim() : null,
      }))
      .filter((row) => row.name.length > 0);

    return NextResponse.json({ items });
  } catch (err) {
    console.error("Menu image extract error:", err);
    return NextResponse.json(
      { error: "Could not parse menu items from the uploaded photo." },
      { status: 500 }
    );
  }
}