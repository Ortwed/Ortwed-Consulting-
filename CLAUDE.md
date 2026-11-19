# CO Consulting dashboard v2

Personligt CRM og dashboard for Christian Ortwed. Bygget til ét menneske,
ikke til et team. Enkelhed slår fleksibilitet hver gang.

Christian er CRO og partner i Concept X og driver CO Consulting ved siden
af. Dashboardet samler kunder, leads, personer, møder, opgaver, mail,
kalender, nyheder og performance-data for to websites han driver
(ortwed.dk og rosendal-tomrer.dk).

Appen bor i `Ortwed/co-consulting-crm` og deployer til det Cloudflare
Pages-projekt der altid har kørt den. I november 2026 blev den bygget om
fra et HUD-tema til det nuværende design (bygget i `Ortwed/Ortwed-Consulting-`
og flyttet hertil, så secrets og Apps Script kunne genbruges).
Det gamle HUD-design ligger urørt på branchen `hud-backup`.

## Hvad det er

Et statisk website med en Supabase-database bagved. Ingen build, ingen
framework, ingen npm. Hele frontenden er **én fil**: `index.html`, med CSS
og JavaScript indlejret. Serverdelen er Cloudflare Pages Functions, én fil
per endpoint.

Det er et bevidst valg. En enkelt fil Christian kan læse fra top til bund
er mere værd end en pæn arkitektur. **Foreslå ikke React, en bundler eller
en opsplitning af index.html** medmindre han selv beder om det.

## Stak

| Lag | Teknologi |
|---|---|
| Frontend | Én statisk `index.html`, vanilla JS, ingen build |
| Database | Supabase (Postgres) med Row Level Security |
| Auth | Supabase Auth, email + password, én bruger |
| Hosting | Cloudflare Pages, auto-deploy fra `main` |
| Serverkode | Cloudflare Pages Functions i `functions/api/` |
| Google | Google Apps Script i Christians egen konto: Gmail, Calendar, GA4, Search Console |

## Filer

```
index.html                    hele appen
functions/api/_middleware.js  vagt: afviser alt under /api/ uden gyldigt Supabase-login
functions/api/analytics.js    GA4 + Search Console, gennem Apps Script
functions/api/indbakke.js     Gmail + Google Calendar, gennem Apps Script
functions/api/nyheder.js      RSS (bureaubiz.dk, markedsforing.dk, bold.dk + Google News som reserve)
functions/api/todoist.js      Todoist REST, forfaldent + i dag
apps-script/                  reference-kopi af Apps Script-koden (deployes ikke herfra)
CLAUDE.md                     denne fil
README.md                     kort intro
```

Apps Script-koden kører på script.google.com i Christians konto, ikke
herfra. `apps-script/` er en kopi han paster ind i scripteditoren:

```
main.gs       NOEGLE, doGet(e) der dispatcher på e.parameter.v, hjælpere
indbakke.gs   ?v=indbakke  ulæste mails + kalenderuge
analytics.gs  ?v=ga4       besøg og events per GA4-property
              ?v=gsc       klik, visninger, position per Search Console-site
```

Uden `v` svarer scriptet som indbakke, fordi HUD-versionen kaldte uden.
Det er ufarligt at beholde.

Indtil `main.gs` og `analytics.gs` er pastet ind og deployet, svarer det
kørende script med indbakken uanset `v`. Grafkortene opdager det og skriver
at Apps Scriptet ikke kender `v=ga4/gsc` endnu. Resten af forsiden virker. `analytics.gs` kræver de to
Advanced Services `AnalyticsData` og `SearchConsole` i scripteditoren.

SQL-patches køres manuelt i Supabase SQL Editor og versioneres ikke.

## Datamodellen

Den vigtigste beslutning i hele projektet: **en person er ikke en kunde, og
en sag er ikke en kunde.** Datamodellen overlevede designskiftet urørt og
ændres ikke uden at Christian beder om det.

```
virksomheder     to rækker: "CO Consulting" (slug 'web') og
                 "Ortwed Anlægs Entreprise" (slug 'anlaeg')
kunder           virksomheder (B2B), hører til én virksomhed
personer         mennesket. Overlever jobskifte. Har foedselsdag + relation.
                 privat = true er familie og venner: med i fødselsdage,
                 ude af Kontakter (v_kontakter) og netværkstallet
ansaettelser     person × kunde × titel × fra/til × nuvaerende
leads            den enkelte sag på en kunde
tilbud           hænger på et lead
aktiviteter      hvad der ER sket
opgaver          hvad der SKAL ske
moeder           møder, hænger på person frem for kunde
```

Views: `v_pipeline`, `v_skal_foelges_op`, `v_hitrate`, `v_kontakter`,
`v_foedselsdage`. Alle med `security_invoker = on`, ellers omgår de RLS.

Et jobskifte lukker den gamle ansættelse med en `til_dato` og opretter en ny.
Historikken slettes aldrig. Christians netværk af marketingfolk skifter job
konstant, og det er hele pointen med modellen.

## Design

Lyst, rent dashboard i Linear/Notion-stil, efter Christians mock (november
2026). **Ikke** HUD-temaet fra det gamle repo. Skriver du scanlinjer,
hjørnebeslag eller cyan glød, er du i det forkerte repo.

```css
--bg: #FAFAFA;          --card: #FFFFFF;        --card-alt: #F4F4F5;
--text: #0A0A0A;        --text-muted: #52525B;  --text-dim: #71717A;
--text-faint: #A1A1AA;  --line: #ECECEC;        --line-soft: #F4F4F5;
--accent: #4F46E5;      /* indigo */
--accent-soft: #EEF2FF; --accent-ink: #4338CA;  --accent-ring: #C7D2FE;
--success: #16A34A;     --live: #22C55E;
--danger: #DC2626;      /* forsinket, fejl */
--warn: #F59E0B;        /* en kilde fejler */
--radius-sm: 6px;  --radius-md: 8px;  --radius-lg: 12px;
--font: 'Inter', system-ui, -apple-system, sans-serif;
```

- Inter fra Google Fonts, 400/500/600/700. Ingen anden skrift.
- Sidebar til venstre (220px), indhold til højre.
- Stats-række med fire tal, derunder grid 1.5fr / 1fr.
- Kort med tynd grå streg og afrundede hjørner. Ingen skygger.
- Linjegrafer med gradient og en lille prik i enden. Farven sættes per
  kort med `--chart-color`, SVG'et bruger `currentColor`.
- Pills til etiketter. Rød pill betyder forsinket.
- Responsiv ved 1100px og 720px.
- Dark mode er ikke bygget. Når den kommer: duplikér `:root` som
  `[data-theme="dark"]` med samme variabelnavne.

## Forsiden

Fra toppen:

- Topbar: dato, hilsen efter tidspunkt, status-chip, "+ Ny opgave".
  Status-chippen samler hvordan hver kilde har det (Supabase, Todoist,
  Gmail, Nyheder, Analytics). Hold musen over den for at se hvad der fejler.
- Stats: Møder i ugen (CRM + Google), Forfaldne opgaver (CRM + Todoist),
  Kontakter i netværket, Ulæst post.
- Venstre: et grafkort per site i `SITES`, Uge NN, Kræver handling.
- Højre: Fødselsdage (30 dage), Ulæst post, Nyheder (Branchen / AI / Fodbold).

Alt der kræver et netværkskald tegnes efter den første rendering, så siden
ikke venter. Mønstret er: tegn skelet → hent → tegn kortet igen. Hver kilde
fylder sit eget kort, og en kilde der fejler tager ikke de andre med.

## Websites

`const SITES = [...]` øverst i scriptet i `index.html` er den eneste
konfiguration. Grafkortene, `/api/analytics` og Apps Scriptet læser alle
herfra: property-ID'er og sporede søgeord sendes med i kaldet.

- `ga4PropertyId: null` → kortet viser kun Search Console og skriver
  "GA4 ikke konfigureret". Udfyldes ID'et, kommer tallene af sig selv.
- `keyEvents` → de GA4-events der tæller som Kontakter. Scriptet sender
  alle events, så et nyt key event kun kræver en linje i `SITES`.
- `trackedQueries` → søgeordene der vises med klik og position.

Apps Scriptet kører som Christian. Det ser kun de properties og sites hans
Google-konto har adgang til. Ligger et site på et andet login, skal den
konto give hans konto læseadgang.

Search Console er to-tre dage bagud, så perioden er de 28 dage der slutter
for tre dage siden.

## Konventioner

- **Alt på dansk**: UI-tekst, variabelnavne, tabelnavne, kommentarer.
  Ingen æøå i SQL-identifikatorer (`belob`, `foedselsdag`, `ansaettelser`).
- **Ingen em-dashes med mellemrum omkring.** Gælder også UI-tekst.
- Tone i UI-tekst: tør og konkret. "Indbakken er tom. Nyd det."
  Ikke udråbstegn, ikke emoji, ikke opmuntring.
- Funktionsnavne på dansk: `visForside`, `aabnKunde`, `gemLead`, `tegnUge`.
- `sikker()` om ALT brugerinput der sættes i HTML. Ingen undtagelser.
  Det gælder også data fra Gmail, RSS, Todoist og GA4.
- Datoer: brug `lokalDato()`, ikke `toISOString().slice(0,10)`. Den sidste
  giver UTC, og så er "i dag" forkert mellem midnat og klokken to.
- Commit-beskeder på dansk, i bydeform: "Tilføj forside-skelet".

## Hemmeligheder

Environment variables i Cloudflare, alle som type **Secret**:

```
GMAIL_URL       Apps Script /exec-adresse
GMAIL_NOEGLE    delt nøgle, skal matche NOEGLE i Apps Script
TODOIST_TOKEN   Todoist API token fra den PRIVATE konto, ikke arbejdskontoen
```

`/api/analytics` bruger samme `GMAIL_URL` og `GMAIL_NOEGLE`: ét script,
én nøgle.

Supabase publishable key står i klartekst i `index.html` og i
`_middleware.js`. Det er med vilje, den er designet til det, og RLS er
det der beskytter data.

Alt under `/api/` kræver login. index.html sender Supabase-tokenet med
via `apiHent()`, og `_middleware.js` tjekker det hos Supabase. Nye kald
til `/api/` skal gå gennem `apiHent()`, ellers får de 401.

**Læg aldrig en secret i repoet.** Hverken i kode, kommentarer eller
commit-beskeder. `NOEGLE` i `apps-script/main.gs` er en pladsholder og
skal blive ved med at være det. Hvis du har brug for en værdi, så bed
Christian sætte den i Cloudflare og referér til den ved navn.

## Deploy

Push til `main` udløser deploy automatisk. Tager cirka tredive sekunder.
Commits til `main` skal derfor være hele, fungerende tilstande.

Variabler sat **efter** et deploy er ikke med i det kørende build. Sætter
Christian en ny secret, skal der et nyt deploy til, enten en commit eller
Retry deployment i Cloudflare.

Pages Functions bygges kun hvis `functions/` ligger i roden af repoet.
Projektet skal være et Pages-projekt, ikke et Worker (det gamle projekt
lærte det på den hårde måde).

Omdøber man en secret i Cloudflare, forsvinder værdien. Slet den og
opret den igen.

## Faner

Forside, Pipeline, Kunder, Kontakter, Fødselsdage, Kalender, Opfølgning
(med prik for forfaldne opgaver) og Websites. Alt der oprettes eller
rettes, sker i panelet der glider ind fra højre. Fødselsdage: private
åbner deres eget panel, forretningskontakter åbner kontaktkortet.

Hilsen ved login: browserens egen stemme, britisk mand, én gang om dagen.
"Lyd til" i sidebaren siger den med det samme, uden dagsgrænse.

## Hvad der mangler

- **Websites 90 dage og år.** Knapperne står uden funktion. Kræver at
  `analytics.gs` kan tage en periode med.
- **Dark mode.** Duplikér `:root` som `[data-theme="dark"]`.
- **Ordentlig mobil.** Under 720px er sidebaren en vandret række øverst.
- **Alarm-tærskler for websites**, fx 0 kontakter i tre dage.
- **Fødselsdagsmail** dagen før. Kræver en tidsstyret trigger i Apps
  Script, der læser `v_foedselsdage` forbi RLS. Mindst dårlige vej:
  scriptet logger ind med Christians email og password fra Script
  Properties frem for en service role key. Tag beslutningen med ham først.

## Når du arbejder her

- Lav små, læsbare ændringer. Christian læser koden.
- Kommentér **hvorfor**, ikke hvad. Han kan godt læse at en linje er et
  filter, men ikke hvorfor filteret findes.
- Test at JavaScript parser inden du pusher: `node --check` på det
  udtrukne script, eller læs det igennem.
- Spørg ikke om lov til små ting. Lav dem, og sig hvad du lavede.
- Sig fra hvis han beder om noget der er en dårlig idé. Han foretrækker
  et modargument frem for en ja-hat.
