/**
 * /api/analytics (Cloudflare Pages Function)
 *
 * Henter GA4- og Search Console-tal gennem det samme Apps Script som
 * /api/indbakke. Det går gennem serveren af samme grund: nøglen til
 * scriptet må ikke stå i index.html.
 *
 * Bruger de samme to environment variables som /api/indbakke:
 *   GMAIL_URL     Apps Script-adressen, den der ender på /exec
 *   GMAIL_NOEGLE  samme streng som NOEGLE i scriptet
 *
 * GET ?v=ga4&ider=551899083,123456789
 *   → { sites: { "551899083": { dage, besoegende, events, ... } } }
 * GET ?v=gsc&soeg={"sc-domain:ortwed.dk":["brolægger hundested"]}
 *   → { sites: { "sc-domain:ortwed.dk": { klik, top, sporede, ... } } }
 *
 * Hvilke sites og søgeord der spørges på, bestemmer SITES i index.html.
 * Så kan et nyt site eller søgeord tilføjes ét sted.
 */

export async function onRequestGet({ request, env }) {
  const svar = (o, status = 200) => new Response(JSON.stringify(o), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });

  const ind = new URL(request.url).searchParams;
  const v = ind.get("v");
  if (v !== "ga4" && v !== "gsc") return svar({ fejl: "v skal være ga4 eller gsc", sites: {} }, 400);

  if (!env.GMAIL_URL || !env.GMAIL_NOEGLE) {
    return svar({ fejl: "mangler opsætning", sites: {} });
  }

  // Kun de parametre scriptet kender, sendes videre. Så kan adressen
  // ikke bruges til at sende andet ind i scriptet end det vi har tænkt.
  const ud = new URLSearchParams({ v, n: env.GMAIL_NOEGLE });
  if (v === "ga4" && ind.get("ider")) ud.set("ider", ind.get("ider"));
  if (v === "gsc" && ind.get("soeg")) ud.set("soeg", ind.get("soeg"));

  try {
    // Apps Script svarer med et redirect til googleusercontent, så
    // redirects skal følges. Tallene ændrer sig langsomt, så et kvarters
    // cache sparer GA4-kvote uden at man mærker det.
    const r = await fetch(`${env.GMAIL_URL}?${ud}`, {
      redirect: "follow",
      cf: { cacheTtl: 900, cacheEverything: false }
    });
    if (!r.ok) return svar({ fejl: `Apps Script svarede ${r.status}`, sites: {} });

    // Svaret sendes videre uændret. Fejl fra scriptet står i data.fejl
    // eller i det enkelte site, og forsiden viser dem.
    return svar(await r.json());
  } catch {
    // Typisk en HTML-fejlside fra Google i stedet for JSON, fx hvis
    // en Advanced Service mangler i scriptet.
    return svar({ fejl: "kunne ikke læse svaret fra Apps Script", sites: {} });
  }
}
