import { NextRequest, NextResponse } from "next/server";
import { generateImage, geminiModels } from "@/lib/gemini";
import { hashText, imageApprovalMessage, issueImageToken, verifyEvaluationToken } from "@/lib/attestation";
import { storeBytes } from "@/lib/github-storage";
import type { GeneratedAssetImage, UnderwritingReport } from "@/lib/types";
import { verifyMessage, type Address } from "viem";
import { serializeReport } from "@/lib/metadata";
import { processAssetImage, providerFallbackReason, selectAssetImageSource } from "@/lib/asset-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROMPT_VERSION = "asset-twin-v2";
const MAX_SOURCE_BYTES = 4 * 1024 * 1024;

export async function POST(req: NextRequest) {
  let form: FormData;
  try { form = await req.formData(); }
  catch { return fail("INVALID_REQUEST", "Send a multipart asset-twin request", 400); }

  try {
    const report = JSON.parse(String(form.get("report") ?? "null")) as UnderwritingReport | null;
    const evaluationToken = String(form.get("evaluationToken") ?? "");
    const attempt = Math.max(1, Math.floor(Number(form.get("attempt") ?? 1)));
    const walletValue = String(form.get("wallet") ?? "");
    const signatureValue = String(form.get("signature") ?? "");
    const wallet = /^0x[a-fA-F0-9]{40}$/.test(walletValue) ? walletValue as Address : undefined;
    const signature = /^0x[a-fA-F0-9]+$/.test(signatureValue) ? signatureValue as `0x${string}` : undefined;
    const sourceFileValue = form.get("sourceFile");
    const sourceFile = sourceFileValue instanceof File && sourceFileValue.size ? sourceFileValue : null;

    if (!report || !evaluationToken) return fail("MISSING_INPUT", "Approved report and evaluation token are required", 400);
    if (sourceFile && (!sourceFile.type.startsWith("image/") || sourceFile.size > MAX_SOURCE_BYTES)) return fail("INVALID_SOURCE_IMAGE", "Fallback photos must be JPEG, PNG, or WebP and no larger than 4 MB", 415);

    const reportJson = serializeReport(report);
    const claims = verifyEvaluationToken(hashText(reportJson), evaluationToken);
    if (attempt > claims.maxImageAttempts) return fail("IMAGE_ATTEMPTS_EXHAUSTED", "Only one regeneration is available for each evaluation", 429);
    if (wallet && signature) {
      const valid = await verifyMessage({ address: wallet, message: imageApprovalMessage({ wallet, claims, attempt }), signature });
      if (!valid) return fail("INVALID_IMAGE_APPROVAL", "Wallet approval for this image generation is invalid", 401);
    }

    const prompt = `Create a premium editorial product portrait for a tokenized physical asset. Depict only the described object, never a person, document, logo, watermark, readable text, serial number, or unrelated object. Use a dark architectural gallery, matte black plinth, cyan and warm amber edge lighting, realistic materials, centered composition, and a clean 4:3 crop. Asset report: ${reportJson.slice(0, 4000)}`;
    let generated: Awaited<ReturnType<typeof generateImage>> = null;
    let providerFailure = "";
    try { generated = await generateImage(prompt); }
    catch (error) { providerFailure = providerFallbackReason(error); console.warn("Gemini twin fallback", providerFailure); }

    const selected = selectAssetImageSource({
      report,
      generated,
      sourcePhoto: sourceFile ? Buffer.from(await sourceFile.arrayBuffer()) : null,
      providerFailure,
    });

    const durableStorage = Boolean(process.env.GITHUB_MEDIA_TOKEN);
    const webp = await processAssetImage(selected.bytes, durableStorage);
    const contentHash = hashText(webp.toString("base64"));
    const stored = await storeBytes(`assets/${contentHash.slice(2)}.webp`, webp, "image/webp");
    const image: GeneratedAssetImage = {
      uri: stored.uri,
      contentHash,
      status: selected.status,
      model: selected.model,
      promptVersion: PROMPT_VERSION,
      attempt,
      originalSourcePublished: false,
      sourcePhotoUsed: selected.sourcePhotoUsed,
      storage: stored.storage,
      fallbackReason: selected.fallbackReason,
      storageWarning: stored.warning,
    };
    return NextResponse.json({ image, imageToken: issueImageToken(claims, image), evaluationId: claims.evaluationId, models: geminiModels() });
  } catch (error) {
    console.error("image generation error", error);
    return fail("IMAGE_GENERATION_FAILED", error instanceof Error ? error.message : "Asset image generation failed", 502, true);
  }
}

function fail(code: string, message: string, status: number, retryable = false) {
  return NextResponse.json({ error: { code, message, retryable } }, { status });
}
