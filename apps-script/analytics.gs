/**
 * analytics.gs: GA4 og Search Console
 *
 * Kræver én Advanced Service i scripteditoren (Services → Add service):
 *   Google Analytics Data API    identifier: AnalyticsData
 *
 * Search Console findes ikke som Advanced Service. Den kaldes direkte
 * med UrlFetchApp, og det kræver at rettigheden står i appsscript.json:
 *   "oauthScopes": [
 *     "https://mail.google.com/",
 *     "https://www.googleapis.com/auth/calendar",
 *     "https://www.googleapis.com/auth/analytics.readonly",
 *     "https://www.googleapis.com/auth/webmasters.readonly",
 *     "https://www.googleapis.com/auth/script.external_request"
 *   ],
 * Står der én rettighed i filen, skal de alle stå der, også Gmail og
 * Calendar, ellers holder indbakken op med at virke.
 *
 * Scriptet kører som dig, så det kan kun se de GA4-properties og
 * Search Console-sites din Google-konto har adgang til. Ligger et site
 * på et andet login, skal den konto give din konto læseadgang først.
 *
 * Hvilke sites der spørges på, kommer fra dashboardet (SITES i
 * index.html). Så skal et nyt site kun tilføjes ét sted.
 */


/* ============================================================
   GA4:  ?v=ga4&ider=551899083,123456789
   ============================================================ */

function ga4(p) {
  // Kun tal, så der ikke kan sendes andet ind som property.
  const ider = String(p.ider || "")
    .split(",")
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return /^\d+$/.test(s); });

  const sites = {};
  ider.forEach(function (id) {
    // Fejler ét site (fx manglende adgang), skal de andre stadig vises.
    try {
      sites[id] = ga4Site(id);
    } catch (err) {
      sites[id] = { fejl: String((err && err.message) || err) };
    }
  });
  return { sites: sites };
}

function ga4Site(id) {
  const property = "properties/" + id;
  const sidste30 = [{ startDate: "29daysAgo", endDate: "today" }];
  const forrige30 = [{ startDate: "59daysAgo", endDate: "30daysAgo" }];

  // 1. Sessions og besøgende per dag, til grafen.
  const dagRaekker = rapport(property, {
    dateRanges: sidste30,
    dimensions: [{ name: "date" }],
    metrics: [{ name: "sessions" }, { name: "totalUsers" }]
  });
  // GA4 udelader dage uden besøg. Grafen skal have alle 30 dage, så
  // tomme dage fyldes ud med 0 her.
  const perDag = {};
  dagRaekker.forEach(function (r) {
    perDag[r.dimensionValues[0].value] = {
      sessions: Number(r.metricValues[0].value),
      besoegende: Number(r.metricValues[1].value)
    };
  });
  const dage = [];
  for (let n = 29; n >= 0; n--) {
    const dato = dagSiden(n);
    const fundet = perDag[dato.replace(/-/g, "")] || { sessions: 0, besoegende: 0 };
    dage.push({ dato: dato, sessions: fundet.sessions, besoegende: fundet.besoegende });
  }

  // 2. Totaler for de to perioder. Besøgende kan ikke lægges sammen
  // dag for dag (samme person kommer igen), så de hentes for sig.
  const nu = total(property, sidste30);
  const foer = total(property, forrige30);

  // 3. Alle events de sidste 30 dage. Dashboardet vælger selv hvilke
  // der tæller som kontakter, så et nyt key event ikke kræver ny kode her.
  const events = {};
  rapport(property, {
    dateRanges: sidste30,
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }],
    limit: 100
  }).forEach(function (r) {
    events[r.dimensionValues[0].value] = Number(r.metricValues[0].value);
  });

  // 4. Mest sete side og største trafikkilde.
  const topside = foersteVaerdi(rapport(property, {
    dateRanges: sidste30,
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "screenPageViews" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: 1
  }));
  const topkilde = foersteVaerdi(rapport(property, {
    dateRanges: sidste30,
    dimensions: [{ name: "sessionSourceMedium" }],
    metrics: [{ name: "sessions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 1
  }));

  return {
    dage: dage,
    besoegende: nu.besoegende,
    sessions: nu.sessions,
    forrigeBesoegende: foer.besoegende,
    forrigeSessions: foer.sessions,
    events: events,
    topside: topside,
    topkilde: topkilde
  };
}

function rapport(property, foresp) {
  const svar = AnalyticsData.Properties.runReport(foresp, property);
  // Ingen data giver ingen rows, ikke en tom liste.
  return svar.rows || [];
}

function total(property, periode) {
  const r = rapport(property, {
    dateRanges: periode,
    metrics: [{ name: "totalUsers" }, { name: "sessions" }]
  })[0];
  return {
    besoegende: r ? Number(r.metricValues[0].value) : 0,
    sessions: r ? Number(r.metricValues[1].value) : 0
  };
}

function foersteVaerdi(raekker) {
  return raekker.length ? raekker[0].dimensionValues[0].value : "";
}


/* ============================================================
   SEARCH CONSOLE:  ?v=gsc&soeg={"sc-domain:ortwed.dk":["brolægger hundested"]}
   ============================================================ */

function gsc(p) {
  let soeg = {};
  try {
    soeg = JSON.parse(p.soeg || "{}");
  } catch (err) {
    return { fejl: "soeg er ikke gyldig JSON", sites: {} };
  }

  const sites = {};
  Object.keys(soeg).forEach(function (site) {
    // Kun rigtige Search Console-adresser.
    if (!/^(sc-domain:|https?:\/\/)/.test(site)) return;
    const sporede = Array.isArray(soeg[site]) ? soeg[site].slice(0, 10) : [];
    try {
      sites[site] = gscSite(site, sporede);
    } catch (err) {
      sites[site] = { fejl: String((err && err.message) || err) };
    }
  });
  return { sites: sites };
}

function gscSite(site, sporede) {
  // Search Console er to til tre dage bagud. Perioden slutter derfor for
  // tre dage siden og er 28 dage lang, som i Search Consoles egen visning.
  const periode = { startDate: dagSiden(30), endDate: dagSiden(3) };

  const i_alt = gscForesp(site, periode)[0] || {};

  const top = gscForesp(site, {
    startDate: periode.startDate,
    endDate: periode.endDate,
    dimensions: ["query"],
    rowLimit: 5
  }).map(soegeordRaekke);

  // Ét kald per søgeord. Et filter er den eneste måde at få et søgeord
  // med, når det ligger for langt nede til at komme med i en topliste.
  const spor = sporede.map(function (q) {
    const r = gscForesp(site, {
      startDate: periode.startDate,
      endDate: periode.endDate,
      dimensions: ["query"],
      dimensionFilterGroups: [{
        filters: [{ dimension: "query", operator: "equals", expression: String(q) }]
      }]
    })[0];
    return r ? soegeordRaekke(r) : { soegeord: String(q), klik: 0, visninger: 0, position: null };
  });

  return {
    fra: periode.startDate,
    til: periode.endDate,
    klik: i_alt.clicks || 0,
    visninger: i_alt.impressions || 0,
    position: i_alt.position || null,
    top: top,
    sporede: spor
  };
}

function gscForesp(site, foresp) {
  const url = "https://searchconsole.googleapis.com/webmasters/v3/sites/"
    + encodeURIComponent(site) + "/searchAnalytics/query";
  const r = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
    payload: JSON.stringify(foresp),
    // Uden den kaster UrlFetchApp en fejl uden Googles forklaring.
    muteHttpExceptions: true
  });
  const data = JSON.parse(r.getContentText() || "{}");
  if (r.getResponseCode() !== 200) {
    throw new Error((data.error && data.error.message) || ("Search Console svarede " + r.getResponseCode()));
  }
  return data.rows || [];
}

function soegeordRaekke(r) {
  return {
    soegeord: r.keys ? r.keys[0] : "",
    klik: r.clicks || 0,
    visninger: r.impressions || 0,
    position: r.position || null
  };
}


/* ============================================================
   AFPRØVNING
   Kør afproev() én gang fra editoren (vælg den i menuen øverst og
   tryk Kør). Første gang beder Google om lov til at læse GA4 og
   Search Console. Uden den godkendelse fejler dashboardet, fordi
   web-appen ikke selv kan spørge om lov. Resultatet står i
   Udførelseslog nederst.
   ============================================================ */
function afproev() {
  Logger.log(JSON.stringify(ga4({ ider: "551899083" })).slice(0, 1500));
  Logger.log(JSON.stringify(gsc({ soeg: JSON.stringify({
    "sc-domain:ortwed.dk": ["brolægger hundested"],
    "sc-domain:rosendal-tomrer.dk": ["tømrer hundested"]
  }) })).slice(0, 1500));
}
