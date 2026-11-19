/**
 * indbakke.gs: ulæste mails og denne uges kalender
 *
 * VIGTIGT før du paster: det gamle dashboard bruger også dette script.
 * Denne fil er skrevet ud fra det svarformat det gamle dashboard læser
 * (poster + aftaler), ikke ud fra din nuværende kode, som ikke ligger i
 * noget repo. Har din nuværende indbakke-kode særlige filtre (fx en
 * bestemt Gmail-søgning eller flere kalendere), så behold DIN kode og
 * omdøb blot dens funktion til indbakke(). Så virker begge dashboards.
 *
 * Svar:
 * {
 *   poster:  [{ navn, email, emne, dato, link, antal, uddrag }],
 *   aftaler: [{ titel, start, slut, sted, heldags }],
 *   ulaeste: 19
 * }
 */

// Flere end det her vises ikke på forsiden, og getPlainBody er langsom.
const MAKS_POSTER = 20;

function indbakke() {
  const traade = GmailApp.search("is:unread in:inbox", 0, MAKS_POSTER);

  const poster = traade.map(function (t) {
    const beskeder = t.getMessages();
    const sidste = beskeder[beskeder.length - 1];
    const fra = afsender(sidste.getFrom());
    return {
      navn: fra.navn,
      email: fra.email,
      emne: t.getFirstMessageSubject(),
      dato: t.getLastMessageDate().toISOString(),
      link: "https://mail.google.com/mail/u/0/#inbox/" + t.getId(),
      antal: t.getMessageCount(),
      uddrag: sidste.getPlainBody().replace(/\s+/g, " ").trim().slice(0, 140)
    };
  });

  return {
    poster: poster,
    aftaler: kalenderUge(),
    // Antal ulæste tråde i alt, også dem der ikke kom med i listen.
    ulaeste: GmailApp.getInboxUnreadCount()
  };
}

// "Mette Hansen <mette@firma.dk>" bliver til navn og email hver for sig.
function afsender(fra) {
  const m = String(fra).match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { navn: m[1].trim() || m[2], email: m[2].trim() };
  return { navn: String(fra).trim(), email: String(fra).trim() };
}

// Mandag til søndag i den uge vi er i nu.
function kalenderUge() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const slut = new Date(start);
  slut.setDate(slut.getDate() + 7);

  // Kun din egen kalender. Arbejdskalenderen hos Concept X er bevidst
  // ikke med (den hemmelige iCal-adresse er slået fra der).
  const begivenheder = CalendarApp.getDefaultCalendar().getEvents(start, slut);

  return begivenheder.map(function (b) {
    const heldags = b.isAllDayEvent();
    return {
      titel: b.getTitle(),
      start: (heldags ? b.getAllDayStartDate() : b.getStartTime()).toISOString(),
      slut: (heldags ? b.getAllDayEndDate() : b.getEndTime()).toISOString(),
      sted: b.getLocation() || "",
      heldags: heldags
    };
  });
}
