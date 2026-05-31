import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export const SESSION_COOKIE = "flashcard_session";

type SessionPayload = {
  userId: string;
  email?: string | null;
  exp: number;
};

function getAppSecret() {
  const secret = process.env.APP_SECRET;
  if (!secret) {
    throw new Error("APP_SECRET is required.");
  }
  return secret;
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function signPayload(encodedPayload: string) {
  return crypto.createHmac("sha256", getAppSecret()).update(encodedPayload).digest("base64url");
}

function timingSafeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function shouldUseSecureCookie(request: Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (forwardedProto) return forwardedProto === "https";

  return new URL(request.url).protocol === "https:";
}

export function createSessionToken(payload: Omit<SessionPayload, "exp">) {
  const session: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
  };
  const encodedPayload = base64Url(JSON.stringify(session));
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token?: string | null): SessionPayload | null {
  if (!token) return null;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expected = signPayload(encodedPayload);
  if (!timingSafeEqual(signature, expected)) return null;

  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as SessionPayload;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const payload = verifySessionToken(token);
  if (!payload) return null;

  const prisma = getPrisma();
  return prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true },
  });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { user, response: null };
}

export async function ensureAdminUser() {
  const prisma = getPrisma();
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) return null;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;

  const userCount = await prisma.user.count();
  if (userCount > 0) return null;

  return prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 12),
    },
  });
}

export async function validateLogin(email: string, password: string) {
  await ensureAdminUser();

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  return valid ? user : null;
}
