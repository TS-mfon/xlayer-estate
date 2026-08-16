import sharp from "sharp";
import type { GeneratedAssetImage, UnderwritingReport } from "./types";

interface GeneratedImageSource {
  bytes: Buffer;
  model: string;
}

interface AssetImageSource {
  bytes: Buffer;
  status: GeneratedAssetImage["status"];
  model: string;
  sourcePhotoUsed: boolean;
  fallbackReason?: string;
}

export function providerFallbackReason(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/429|quota|resource_exhausted/i.test(message)) return "Gemini image quota is currently unavailable.";
  if (/timeout|timed out|503|502|500/i.test(message)) return "Gemini image generation is temporarily unavailable.";
  return "Gemini could not generate the asset portrait.";
}

export function selectAssetImageSource({
  report,
  generated,
  sourcePhoto,
  providerFailure,
}: {
  report: UnderwritingReport;
  generated: GeneratedImageSource | null;
  sourcePhoto: Buffer | null;
  providerFailure?: string;
}): AssetImageSource {
  if (generated) {
    return {
      bytes: generated.bytes,
      status: "generated",
      model: generated.model,
      sourcePhotoUsed: false,
    };
  }

  if (sourcePhoto) {
    return {
      bytes: sourcePhoto,
      status: "fallback_photo",
      model: "sanitized-source-photo",
      sourcePhotoUsed: true,
      fallbackReason: `${providerFailure || "Gemini returned no image."} A sanitized source-photo derivative was used instead.`,
    };
  }

  return {
    bytes: Buffer.from(fallbackTwinSvg(report)),
    status: "fallback_svg",
    model: "protocol-twin-svg",
    sourcePhotoUsed: false,
    fallbackReason: `${providerFailure || "Gemini returned no image."} The upload was not a photo, so a deterministic protocol illustration was used instead.`,
  };
}

export function fallbackTwinSvg(report: UnderwritingReport) {
  const escape = (value: string) => value.replace(/[<>&'\"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[character] ?? character));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1050" viewBox="0 0 1400 1050"><defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#05090f"/><stop offset=".48" stop-color="#102431"/><stop offset="1" stop-color="#2b1d13"/></linearGradient><radialGradient id="orb"><stop stop-color="#65eaff" stop-opacity=".58"/><stop offset="1" stop-color="#65eaff" stop-opacity="0"/></radialGradient></defs><rect width="1400" height="1050" fill="url(#bg)"/><circle cx="1110" cy="190" r="390" fill="url(#orb)" opacity=".34"/><path d="M210 760h980" stroke="#c6fbff" stroke-opacity=".14"/><rect x="250" y="720" width="900" height="46" rx="23" fill="#03070c" stroke="#68eaff" stroke-opacity=".42"/><path d="M420 720c42-190 118-338 280-402 162 64 238 212 280 402H420Z" fill="#0a141e" stroke="#78ecff" stroke-opacity=".5"/><circle cx="700" cy="520" r="172" fill="none" stroke="#f3b96b" stroke-opacity=".16" stroke-width="3"/><text x="70" y="110" fill="#8ef4ff" font-family="monospace" font-size="25" letter-spacing="7">XLAYER ESTATE / PROTOCOL TWIN</text><text x="70" y="900" fill="white" font-family="sans-serif" font-size="54" font-weight="700">${escape(report.asset.name)}</text><text x="70" y="955" fill="#a9c8d5" font-family="sans-serif" font-size="27">${escape(report.asset.category)} · ${escape(report.asset.condition)}</text></svg>`;
}

export async function processAssetImage(bytes: Buffer, durableStorage: boolean) {
  return sharp(bytes)
    .rotate()
    .resize({
      width: durableStorage ? 1400 : 560,
      height: durableStorage ? 1050 : 420,
      fit: "contain",
      background: { r: 5, g: 10, b: 16, alpha: 1 },
      withoutEnlargement: true,
    })
    .webp({ quality: durableStorage ? 86 : 58 })
    .toBuffer();
}
