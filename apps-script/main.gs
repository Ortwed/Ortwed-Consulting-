/**
 * CO Consulting dashboard: Apps Script (main.gs)
 *
 * Reference-kopi. Det kørende script bor på script.google.com i
 * Christians konto. Ændringer her gør intet før de er pastet ind og
 * deployet som ny version.
 *
 * Scriptet har tre filer, som i scripteditoren skal hedde det samme:
 *   main.gs       nøgle, doGet og hjælpere (denne fil)
 *   indbakke.gs   ulæste mails og kalenderugen
 *   analytics.gs  GA4 og Search Console
 *
 * Adresser:
 *   ?v=indbakke&n=<NOEGLE>   mails + kalender
 *   ?v=ga4&n=<NOEGLE>        besøg og events
 *   ?v=gsc&n=<NOEGLE>        søgeord, klik og position
 *
 * Uden v svarer scriptet som indbakke. Det er med vilje: det gamle
 * dashboard (co-consulting-crm) kalder uden v, og det skal blive ved
 * med at virke.
 */

// BEHOLD den værdi du har i dit nuværende script. Den skal være den
// samme som GMAIL_NOEGLE i Cloudflare. Skriv den aldrig ind i repoet.
const NOEGLE = "SKRIV-DIN-NUVAERENDE-NOEGLE-HER";

function doGet(e) {
  const p = (e && e.parameter) || {};

  if (p.n !== NOEGLE) return json({ fejl: "forkert nøgle" });

  const v = p.v || "indbakke";
  try {
    if (v === "indbakke") return json(indbakke());
    if (v === "ga4") return json(ga4(p));
    if (v === "gsc") return json(gsc(p));
    return json({ fejl: "ukendt v: " + v });
  } catch (err) {
    // Fejlen sendes med tilbage, så dashboardet kan vise hvad der gik
    // galt i stedet for bare "kunne ikke hente".
    return json({ fejl: String((err && err.message) || err) });
  }
}

function json(o) {
  return ContentService
    .createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}

// Datoer regnes i dansk tid, ikke i scriptets egen tidszone, så "i dag"
// er det samme her som i dashboardet.
const TIDSZONE = "Europe/Copenhagen";

// "2026-11-19" for n dage siden.
function dagSiden(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return Utilities.formatDate(d, TIDSZONE, "yyyy-MM-dd");
}
