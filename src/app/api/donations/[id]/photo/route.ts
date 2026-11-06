import { GetObjectCommand } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { db } from "@/db";
import { donations } from "@/db/schema";
import { hasRole } from "@/lib/rbac";
import { r2, R2_BUCKET } from "@/lib/r2";

const notFound = () => new NextResponse("Not found", { status: 404 });

/**
 * A donor's photo, for drawing on their card.
 *
 * Streams from this origin rather than redirecting like `/api/photos`: a
 * cross-origin image marks a canvas as tainted, and the card could then not be
 * exported as an image. Only the card uses this, so the transfer stays small;
 * lists use `/api/photos`.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role, "admin")) return notFound();

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return notFound();

  const [row] = await db
    .select({ photoKey: donations.photoKey })
    .from(donations)
    .where(eq(donations.id, id));
  if (!row) return notFound();

  try {
    const object = await r2.send(
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: row.photoKey }),
    );
    if (!object.Body) return notFound();
    const bytes = await object.Body.transformToByteArray();
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "image/webp",
        // The key is reused when a photo is replaced.
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return notFound();
  }
}
