// app/api/generate-head-soccer/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Replicate from "replicate";

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

/* model version hashes */
const AVATAR_VERSION =
  "50ac06bb9bcf30e7b5dc66d3fe6e67262059a11ade572a35afa0ef686f55db82"; // ip-adapter face
const REMBG_VERSION =
  "fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003"; // rembg
/* --------------------------------------------------- */

function firstUrl(val) {
  if (!val) return null;
  if (typeof val === "string") return val;
  if (Array.isArray(val)) return firstUrl(val[0]);
  if (typeof val === "object") return val.url || firstUrl(val.output);
  return null;
}

export async function POST(req) {
  if (!process.env.REPLICATE_API_TOKEN) {
    return NextResponse.json(
      { error: "REPLICATE_API_TOKEN is not set" },
      { status: 500 }
    );
  }

  try {
    /* 1️⃣ load uploaded image and convert to data URL */
    const form = await req.formData();
    const file = form.get("image");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No image uploaded" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${file.type || "image/png"};base64,${buf.toString(
      "base64"
    )}`;

    /* 2️⃣ Avatar prediction */
    const avatarPred = await replicate.predictions.create({
      version: AVATAR_VERSION,
      input: {
        eta: 0,
        seed: 931,
        prompt:
          "+++vector cartoon+++ head-soccer-style avatar, BIG oversized head, perfectly flat cel shading, thick black outlines, simple shapes, white eyeballs with round black pupils, face turned slightly left (left cheek more visible), ONLY THE HEAD, white background, no neck, no shoulders, vivid solid colours",
        negative_prompt:
          "photo, photographic texture, skin pores, realistic, neck, shoulders, body, clothing, background, shadow, glare, blur, detailed shading, hyper-realistic",
        max_width: 512,
        max_height: 512,
        num_outputs: 1,
        guidance_scale: 9,
        img2img_strength: 0.95,
        ip_adapter_ckpt: "ip-adapter-plus-face_sd15.bin",
        ip_adapter_image: dataUrl,
        ip_adapter_weight: 0.55,
        num_inference_steps: 40,
        scheduler: "K_EULER_ANCESTRAL",
        disable_safety_check: true,
        guess_mode: false,
        sorted_controlnets: "",
        int_kwargs: ""
      }
    });
    const avatarDone = await replicate.wait(avatarPred);
    const avatarUrl = firstUrl(avatarDone.output);
    if (!avatarUrl) throw new Error("Avatar generation failed");

    /* 3️⃣ rembg prediction */
    const rembgPred = await replicate.predictions.create({
      version: REMBG_VERSION,
      input: { image: avatarUrl }
    });
    const rembgDone = await replicate.wait(rembgPred);
    const pngUrl = firstUrl(rembgDone.output);
    if (!pngUrl) throw new Error("Background removal failed");

    /* 4️⃣ success */
    return NextResponse.json({ url: pngUrl });
  } catch (err) {
    console.error("Head-Soccer pipeline error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
