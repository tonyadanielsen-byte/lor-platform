# LOR Platform

Digital plattform for **Lederoppfølgingsrunder (LOR)** ved Nortura Sarpsborg.

LOR Platform bygges som en søsterløsning til OpEx-master. Plattformen skal gjøre lederoppfølgingsrunder enkle å planlegge, gjennomføre og dokumentere på mobil og PC, samtidig som historikken brukes aktivt til læring, oppfølging og forbedring.

## Produktmål

Løsningen skal gi svar på:

- Blir planlagte LOR gjennomført?
- Hva observerer lederne ute i organisasjonen?
- Hva fungerer godt?
- Hvilke forbedringspunkter og avvik går igjen?
- Hva sier medarbeiderne som involveres i rundene?
- Blir funn fulgt opp og lukket?
- Hvordan utvikler den enkelte leder, avdeling og tema seg over tid?
- Hvilke temaer bør prioriteres, revideres eller få lavere frekvens fremover?

## V1 – hovedområder

1. Dashboard – hittil i år, utvikling, åpne saker og gjentagende funn
2. Mine LOR – personlig plan, gjennomføring og lederstatus
3. Gjennomfør LOR – mobilførst arbeidsflyt med kontrollpunkter
4. Medarbeiderdialog – strukturerte tilbakemeldinger, med navn eller anonymt
5. Oppfølging og tiltak – ansvar, frist, status og lukking
6. Temabank – felles og avdelingsspesifikke temaer/spørsmål med versjonskontroll
7. Analyse – historikk, trender, gjentagelser og beslutningsstøtte
8. Varslinger og påminnelser – detaljert regelverk fastsettes senere
9. Dokumentasjon – bilder og filer koblet til riktig runde/observasjon
10. Audit log – sporbarhet på viktige endringer

## Grunnprinsipper

- Webapp/PWA, optimalisert for både mobil og PC
- LOR-runden er hovedobjektet i datamodellen
- Positiv feedback er en eksplisitt del av arbeidsflyten
- Kontrollpunkt kan registreres som `OK`, `Forbedringspunkt`, `Avvik` eller `Ikke relevant`
- Observasjon og tiltak er separate objekter
- Kommentarer lagrer bruker, dato og klokkeslett
- Historiske runder skal ikke endres når spørsmålsbanker revideres
- Temaer skal kunne endre frekvens, pauses og versjoneres
- Systemet kan foreslå fokusområder, men skal ikke automatisk fjerne HMS-/kvalitetstemaer
- Lederstatus skal måle gjennomføring og oppfølging, ikke belønne høyest mulig OK-andel
- Eksisterende Excel-skjema `Intern LOR August - 2026.xlsx` er faglig utgangspunkt for plan, temaer og kontrollspørsmål

## Forholdet til OpEx-master

Vi skal gjenbruke etablerte mønstre og erfaringer fra OpEx-master for blant annet:

- design og brukeropplevelse
- autentisering og brukerhåndtering
- roller og tilgang
- kommentarer
- varslinger
- filhåndtering
- PWA/mobiltilpasning
- eksport
- audit-logg

LOR skal likevel ha egen domenemodell og arbeidsflyt. En LOR-observasjon skal senere kunne opprettes som eller kobles til et tiltak i OpEx-master.

## Foreløpig domenemodell

- `users`
- `lor_plans`
- `lor_rounds`
- `lor_responses`
- `employee_interviews`
- `observations`
- `actions`
- `comments`
- `attachments`
- `themes`
- `notifications`
- `reminders`
- `audit_log`

## Status

**Foundation / V1 specification.** Produktretningen er låst. Neste fase er å dokumentere V1-krav og arkitektur, hente relevante tekniske mønstre fra OpEx-master og deretter etablere første kjørbare applikasjon.