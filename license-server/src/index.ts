/**
 * PaperStudio Pro License Server
 * Cloudflare Worker — handles Google OAuth + single-use license activation
 *
 * Secrets needed (set via `wrangler secret put <name>`):
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   LICENSE_HMAC_SECRET
 *
 * KV namespaces:
 *   LICENSES          — google_sub → { license_token, device_id, email, activated_at }
 *   ACTIVATION_CODES  — code → { google_sub, email }  (5 min TTL)
 */

export interface Env {
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  LICENSE_HMAC_SECRET: string
  APP_DEEP_LINK_SCHEME: string
  LICENSES: KVNamespace
  ACTIVATION_CODES: KVNamespace
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

async function hmacSign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  )
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const parts = jwt.split(".")
  if (parts.length !== 3) throw new Error("Invalid JWT")
  const payload = parts[1]!
  const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
  return JSON.parse(decoded)
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  })
}

function getBaseUrl(request: Request): string {
  const url = new URL(request.url)
  return `${url.protocol}//${url.host}`
}

// ── Route handlers ───────────────────────────────────────────────────────────

/** GET /auth/google — Initiates Google OAuth flow */
async function handleAuthGoogle(
  request: Request,
  env: Env,
): Promise<Response> {
  const state = randomHex(32)
  const baseUrl = getBaseUrl(request)
  const redirectUri = `${baseUrl}/auth/callback`

  // Store state for CSRF protection (10 min TTL)
  await env.ACTIVATION_CODES.put(`state:${state}`, "1", {
    expirationTtl: 600,
  })

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    state,
    prompt: "select_account",
  })

  return Response.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    302,
  )
}

/** GET /auth/callback — Google OAuth callback */
async function handleAuthCallback(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const error = url.searchParams.get("error")

  if (error) {
    return new Response(htmlPage("Authentication Failed", error), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    })
  }

  if (!code || !state) {
    return new Response(htmlPage("Error", "Missing code or state"), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    })
  }

  // Validate CSRF state
  const storedState = await env.ACTIVATION_CODES.get(`state:${state}`)
  if (!storedState) {
    return new Response(htmlPage("Error", "Invalid or expired state"), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    })
  }
  await env.ACTIVATION_CODES.delete(`state:${state}`)

  // Exchange code for tokens
  const baseUrl = getBaseUrl(request)
  const redirectUri = `${baseUrl}/auth/callback`

  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  })

  if (!tokenResp.ok) {
    const errText = await tokenResp.text()
    return new Response(
      htmlPage("Token Exchange Failed", `Google error: ${errText}`),
      { status: 400, headers: { "Content-Type": "text/html" } },
    )
  }

  const tokens = (await tokenResp.json()) as { id_token?: string }
  if (!tokens.id_token) {
    return new Response(htmlPage("Error", "No ID token received"), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    })
  }

  // Decode ID token to get user info
  const payload = decodeJwtPayload(tokens.id_token) as {
    sub: string
    email: string
    name?: string
  }

  // Check if this Google account is already used
  const existing = await env.LICENSES.get(`sub:${payload.sub}`)
  if (existing) {
    return new Response(
      htmlPage(
        "Account Already Used",
        `The Google account ${payload.email} has already been used to activate a license. Each account can only activate one installation.`,
      ),
      { status: 403, headers: { "Content-Type": "text/html" } },
    )
  }

  // Generate a short-lived activation code (5 min TTL)
  const activationCode = randomHex(32)
  await env.ACTIVATION_CODES.put(
    `activation:${activationCode}`,
    JSON.stringify({
      google_sub: payload.sub,
      email: payload.email,
      name: payload.name || "",
    }),
    { expirationTtl: 300 },
  )

  // Redirect back to the desktop app via deep link
  const deepLink = `${env.APP_DEEP_LINK_SCHEME}://auth/callback?activation_code=${activationCode}`

  return new Response(
    htmlPage(
      "Activation Ready",
      `<p>Redirecting to PaperStudio Pro...</p>
       <p style="margin-top:12px"><a href="${deepLink}" style="color:#2563eb;text-decoration:underline">Click here</a> if not redirected automatically.</p>
       <script>setTimeout(function(){window.location.href="${deepLink}"},1000)</script>`,
    ),
    { status: 200, headers: { "Content-Type": "text/html" } },
  )
}

/** POST /api/activate — Exchange activation code for license token */
async function handleActivate(
  request: Request,
  env: Env,
): Promise<Response> {
  const body = (await request.json()) as {
    activation_code?: string
    device_id?: string
  }

  if (!body.activation_code || !body.device_id) {
    return jsonResponse(
      { error: "Missing activation_code or device_id" },
      400,
    )
  }

  // Look up the activation code
  const codeData = await env.ACTIVATION_CODES.get(
    `activation:${body.activation_code}`,
  )
  if (!codeData) {
    return jsonResponse(
      { error: "Invalid or expired activation code" },
      400,
    )
  }

  const { google_sub, email } = JSON.parse(codeData) as {
    google_sub: string
    email: string
  }

  // Double-check: has this Google account already been used?
  const existing = await env.LICENSES.get(`sub:${google_sub}`)
  if (existing) {
    // Delete the activation code since we're rejecting
    await env.ACTIVATION_CODES.delete(`activation:${body.activation_code}`)
    return jsonResponse({
      error: "This Google account has already been used for activation",
    })
  }

  // Generate license token
  const licenseToken = await hmacSign(
    `${google_sub}:${body.device_id}`,
    env.LICENSE_HMAC_SECRET,
  )

  const record = {
    license_token: licenseToken,
    device_id: body.device_id,
    email,
    google_sub,
    activated_at: new Date().toISOString(),
  }

  // Store: google_sub → record  (prevents re-use of this Google account)
  await env.LICENSES.put(`sub:${google_sub}`, JSON.stringify(record))

  // Store: license_token → record  (for verification lookups)
  await env.LICENSES.put(`token:${licenseToken}`, JSON.stringify(record))

  // Consume the activation code
  await env.ACTIVATION_CODES.delete(`activation:${body.activation_code}`)

  return jsonResponse({ license_token: licenseToken, email })
}

/** POST /api/verify — Verify a license token */
async function handleVerify(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as {
    license_token?: string
    device_id?: string
  }

  if (!body.license_token || !body.device_id) {
    return jsonResponse({ valid: false, error: "Missing parameters" }, 400)
  }

  const data = await env.LICENSES.get(`token:${body.license_token}`)
  if (!data) {
    return jsonResponse({ valid: false, error: "Invalid license" })
  }

  const record = JSON.parse(data) as {
    device_id: string
    email: string
  }

  if (record.device_id !== body.device_id) {
    return jsonResponse({
      valid: false,
      error: "Device mismatch — this license is bound to another device",
    })
  }

  return jsonResponse({ valid: true, email: record.email })
}

// ── HTML template ────────────────────────────────────────────────────────────

function htmlPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>PaperStudio Pro — ${title}</title>
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    display:flex;justify-content:center;align-items:center;min-height:100vh;
    margin:0;background:#fafafa;color:#333}
    .card{max-width:420px;padding:40px;background:#fff;border-radius:12px;
    box-shadow:0 2px 12px rgba(0,0,0,.08);text-align:center}
    h1{font-size:20px;margin:0 0 16px}
    p{font-size:14px;color:#666;line-height:1.6;margin:0}
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <div>${body}</div>
  </div>
</body>
</html>`
}

// ── Router ───────────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const { pathname } = url
    const method = request.method

    // CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      })
    }

    try {
      if (method === "GET" && pathname === "/auth/google") {
        return handleAuthGoogle(request, env)
      }
      if (method === "GET" && pathname === "/auth/callback") {
        return handleAuthCallback(request, env)
      }
      if (method === "POST" && pathname === "/api/activate") {
        return handleActivate(request, env)
      }
      if (method === "POST" && pathname === "/api/verify") {
        return handleVerify(request, env)
      }

      // Health check
      if (pathname === "/" || pathname === "/health") {
        return jsonResponse({ status: "ok", service: "paperstudio-license" })
      }

      return jsonResponse({ error: "Not found" }, 404)
    } catch (err) {
      console.error("Unhandled error:", err)
      return jsonResponse(
        { error: "Internal server error" },
        500,
      )
    }
  },
} satisfies ExportedHandler<Env>
