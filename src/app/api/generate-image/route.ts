import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { generateImage, geminiModels } from "@/lib/gemini";
import { hashText, imageApprovalMessage, issueImageToken, verifyEvaluationToken } from "@/lib/attestation";
import { storeBytes } from "@/lib/github-storage";
import type { UnderwritingReport } from "@/lib/types";
import { verifyMessage, type Address } from "viem";
import { serializeReport } from "@/lib/metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROMPT_VERSION = "asset-twin-v1";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { report?: UnderwritingReport; evaluationToken?: string; attempt?: number; wallet?: Address; signature?: `0x${string}` };
    if (!body.report || !body.evaluationToken) return fail("MISSING_INPUT", "Approved report and evaluation token are required", 400);
    const reportJson = serializeReport(body.report);
    const claims = verifyEvaluationToken(hashText(reportJson), body.evaluationToken);
    const attempt = Math.max(1, Math.floor(body.attempt ?? 1));
    if (attempt > claims.maxImageAttempts) return fail("IMAGE_ATTEMPTS_EXHAUSTED", "Only one regeneration is available for each evaluation", 429);
    if (body.wallet && body.signature) {
      const message = imageApprovalMessage({ wallet: body.wallet, claims, attempt });
      const valid = await verifyMessage({ address: body.wallet, message, signature: body.signature });
      if (!valid) return fail("INVALID_IMAGE_APPROVAL", "Wallet approval for this image generation is invalid", 401);
    }
    const prompt = `Create a premium editorial product portrait for a tokenized physical asset. It must depict only the described object, not a person, document, logo, watermark, readable text, serial number, or extra objects. Use a dark architectural gallery setting, a matte black plinth, cyan and warm amber edge lighting, realistic materials, centered composition, and a clean 4:3 crop. Asset name: ${reportJson.slice(0, 4000)}`;
    const generated = await generateImage(prompt);
    const source = generated ?? { bytes: Buffer.from(fallbackSvg(body.report)), mimeType: "image/svg+xml", model: "fallback-svg" };
    const durableStorage = Boolean(process.env.GITHUB_MEDIA_TOKEN);
    const webp = await sharp(source.bytes)
      .resize({ width: durableStorage ? 1400 : 560, withoutEnlargement: true })
      .webp({ quality: durableStorage ? 86 : 58 })
      .toBuffer();
    const contentHash = hashText(webp.toString("base64"));
    const stored = await storeBytes(`assets/${contentHash.slice(2)}.webp`, webp, "image/webp");
    const image = { uri: stored.uri, contentHash, status: generated ? "generated" : "fallback_svg", model: source.model, promptVersion: PROMPT_VERSION, attempt, originalSourcePublished: false, storage: stored.storage } as const;
    return NextResponse.json({ image, imageToken: issueImageToken(claims, image), evaluationId: claims.evaluationId, models: geminiModels() });
  } catch (error) {
    console.error("image generation error", error);
    return fail("IMAGE_GENERATION_FAILED", error instanceof Error ? error.message : "Asset image generation failed", 502, true);
  }
}

function fallbackSvg(report: UnderwritingReport) {
  const escape = (value: string) => value.replace(/[<>&'\"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[char] ?? char));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1050" viewBox="0 0 1400 1050"><defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#06111b"/><stop offset="1" stop-color="#172d38"/></linearGradient><radialGradient id="orb"><stop stop-color="#65eaff" stop-opacity=".55"/><stop offset="1" stop-color="#65eaff" stop-opacity="0"/></radialGradient></defs><rect width="1400" height="1050" fill="url(#bg)"/><circle cx="1120" cy="210" r="360" fill="url(#orb)" opacity=".34"/><rect x="260" y="720" width="880" height="44" rx="22" fill="#05080e" stroke="#68eaff" stroke-opacity=".35"/><path d="M430 720c40-180 110-320 270-380 160 60 230 200 270 380H430Z" fill="#0a141e" stroke="#78ecff" stroke-opacity=".45"/><text x="70" y="110" fill="#8ef4ff" font-family="monospace" font-size="25" letter-spacing="7">XLAYER ESTATE / DIGITAL TWIN</text><text x="70" y="900" fill="white" font-family="sans-serif" font-size="54" font-weight="700">${escape(report.asset.name)}</text><text x="70" y="955" fill="#a9c8d5" font-family="sans-serif" font-size="27">${escape(report.asset.category)} · ${escape(report.asset.condition)}</text></svg>`;
}
function fail(code: string, message: string, status: number, retryable = false) { return NextResponse.json({ error: { code, message, retryable } }, { status }); }
