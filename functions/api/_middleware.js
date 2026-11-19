/**
 * Vagt foran alt under /api/ (Cloudflare Pages middleware)
 *
 * Uden den kunne enhver der kender adressen læse Christians ulæste
 * mails og Todoist-opgaver. index.html sender det login Supabase gav
 * ved login med i hvert kald, og her spørger vi Supabase om det er
 * gyldigt. Svarer Supabase nej, kommer kaldet aldrig videre.
 *
 * Adressen og nøglen er de samme som står åbent i index.html. Den
 * publishable key giver ingen adgang i sig selv, så den er ikke en secret.
 */

const SUPABASE_URL  = "https://fjbrfkkcsszolbgrjdbj.supabase.co";
const SUPABASE_ANON = "sb_publishable_FO-vUOhZtGJYJd4e4Xy_hg_j2AJtvkI";

const nej = () => new Response(JSON.stringify({ fejl: "ikke logget ind" }), {
  status: 401,
  headers: { "content-type": "application/json; charset=utf-8" }
});

export async function onRequest({ request, next }){
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ") || auth.length < 40) return nej();

  try {
    // Supabase afgør selv om tokenet er ægte og ikke udløbet.
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON, authorization: auth }
    });
    if (!r.ok) return nej();
  } catch {
    // Kan vi ikke spørge Supabase, lukker vi hellere end at åbne.
    return nej();
  }

  const svar = await next();
  // Svarene er personlige, så ingen mellemled må gemme dem.
  const ny = new Response(svar.body, svar);
  ny.headers.set("cache-control", "private, no-store");
  return ny;
}
