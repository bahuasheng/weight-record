interface AppEnv {
  AUTH_SESSION_SECRET: string
  ASSETS: { fetch(request: Request): Promise<Response> }
}

const cookieName = '__Secure-shlingang_session'
const encoder = new TextEncoder()

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function getCookie(request: Request, name: string): string | null {
  const match = request.headers.get('Cookie')?.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? match[1] : null
}

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return base64url(await crypto.subtle.sign('HMAC', key, encoder.encode(value)))
}

async function safeEqual(left: string, right: string): Promise<boolean> {
  const [a, b] = await Promise.all([crypto.subtle.digest('SHA-256', encoder.encode(left)), crypto.subtle.digest('SHA-256', encoder.encode(right))])
  const leftBytes = new Uint8Array(a); const rightBytes = new Uint8Array(b); let difference = 0
  for (let index = 0; index < leftBytes.length; index++) difference |= leftBytes[index] ^ rightBytes[index]
  return difference === 0
}

async function isAuthenticated(request: Request, env: AppEnv): Promise<boolean> {
  const value = getCookie(request, cookieName)
  if (!value) return false
  const [version, expiresAt, nonce, signature] = value.split('.')
  if (version !== 'v1' || !expiresAt || !nonce || !signature || !/^\d+$/u.test(expiresAt) || Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false
  return safeEqual(signature, await hmac(`${version}.${expiresAt}.${nonce}`, env.AUTH_SESSION_SECRET))
}

function signInRedirect(request: Request) {
  const currentUrl = new URL(request.url)
  const destination = `${currentUrl.origin}${currentUrl.pathname}${currentUrl.search}`
  return Response.redirect(`https://tools.shlingang.tech/?returnTo=${encodeURIComponent(destination)}`, 302)
}

export default {
  async fetch(request: Request, env: AppEnv): Promise<Response> {
    if (!(await isAuthenticated(request, env))) return signInRedirect(request)
    return env.ASSETS.fetch(request)
  },
}
