/**
 * /api/indbakke (Cloudflare Pages Function)
 *
 * Henter ulæste mails og kalenderaftaler gennem dit Apps Script. Grunden til at det går
 * gennem serveren og ikke direkte fra browseren er at nøglen ellers
 * ville stå i index.html, hvor enhver kunne læse den.
 *
 * Kræver to environment variables i Cloudflare:
 *   GMAIL_URL     din Apps Script-adresse, den der ender på /exec
 *   GMAIL_NOEGLE  samme streng som NOEGLE i scriptet
 *
 * Sættes under: Workers & Pages → dit projekt → Settings →
 * Variables and Secrets. Vælg type Secret, ikke Plaintext.
 */

export async function onRequestGet({ env }) {
  const svar = (o, status = 200) => new Response(JSON.stringify(o), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });

  if (!env.GMAIL_URL || !env.GMAIL_NOEGLE) {
    return svar({ fejl: "mangler opsætning", poster: [], aftaler: [] }, 200);
  }

  try {
    // v=indbakke er standard i scriptet, men står her så kaldet kan læses
    // ved siden af /api/analytics, der bruger samme script.
    const url = `${env.GMAIL_URL}?v=indbakke&n=${encodeURIComponent(env.GMAIL_NOEGLE)}`;

    // Apps Script svarer med et redirect til googleusercontent, så
    // redirects skal følges.
    const r = await fetch(url, {
      redirect: "follow",
      cf: { cacheTtl: 120, cacheEverything: false }
    });
    if (!r.ok) return svar({ fejl: "ingen kontakt til Gmail", poster: [], aftaler: [] });

    const data = await r.json();
    if (data.fejl) return svar({ fejl: "nøglen passer ikke", poster: [], aftaler: [] });

    // ulaeste er det samlede antal i indbakken. Ældre script-versioner
    // sender det ikke, og så tæller forsiden posterne i stedet.
    return svar({ poster: data.poster || [], aftaler: data.aftaler || [], ulaeste: data.ulaeste ?? null });
  } catch {
    return svar({ fejl: "kunne ikke hente", poster: [], aftaler: [] });
  }
}
