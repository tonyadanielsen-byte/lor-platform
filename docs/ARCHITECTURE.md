# LOR Platform – Technical Architecture V1

## Mål

LOR Platform skal gjenbruke det som fungerer fra OpEx-master, men bygges med renere struktur og tydeligere modulgrenser fra første versjon.

## Referanse fra OpEx-master

Kartleggingen viser at OpEx-master allerede har nyttige mønstre for:

- Firebase Authentication
- Firebase Realtime Database
- Firebase Cloud Functions (Node.js 20)
- PWA/manifest/service worker
- Firebase Cloud Messaging / push
- kommentarer med bruker og timestamp
- aktivitets-/endringsvarsler
- responsiv mobilstøtte

Disse mønstrene skal gjenbrukes konseptuelt, men ikke ved å kopiere hele den store `index.html`-filen eller koble nye funksjoner inn gjennom globale patcher.

## Arkitekturprinsipp

LOR bygges som en modulær, statisk webapp/PWA med separate lag:

```text
UI
  ↓
Application services
  ↓
Domain models / validation
  ↓
Firebase adapters
  ↓
Firebase Auth / Realtime Database / Storage / Functions / Messaging
```

## Foreslått repository-struktur

```text
/
├─ index.html
├─ manifest.webmanifest
├─ sw.js
├─ firebase.json
├─ src/
│  ├─ app.js
│  ├─ config/
│  │  └─ firebase-config.example.js
│  ├─ styles/
│  │  ├─ tokens.css
│  │  ├─ base.css
│  │  └─ components.css
│  ├─ core/
│  │  ├─ auth.js
│  │  ├─ router.js
│  │  ├─ notifications.js
│  │  ├─ comments.js
│  │  └─ attachments.js
│  ├─ data/
│  │  ├─ firebase.js
│  │  ├─ rounds-repository.js
│  │  ├─ plans-repository.js
│  │  └─ themes-repository.js
│  ├─ domain/
│  │  ├─ lor-round.js
│  │  ├─ observation.js
│  │  └─ statuses.js
│  ├─ views/
│  │  ├─ dashboard.js
│  │  ├─ my-lor.js
│  │  ├─ round.js
│  │  ├─ themes.js
│  │  └─ analytics.js
│  └─ components/
│     ├─ app-shell.js
│     ├─ kpi-card.js
│     ├─ status-chip.js
│     └─ toast.js
├─ functions/
│  ├─ index.js
│  └─ package.json
└─ docs/
```

## Firebase

### Authentication

Samme prinsipp som OpEx-master: kun godkjente innloggede brukere skal få tilgang.

Brukerprofil lagres separat fra Auth-identiteten og inneholder minimum:

- uid
- navn
- e-post
- rolle
- aktiv/inaktiv
- avdeling(er)

### Realtime Database

Foreløpig logisk struktur:

```text
/users/{uid}
/lorPlans/{planId}
/lorRounds/{roundId}
/lorResponses/{roundId}/{responseId}
/employeeInterviews/{roundId}/{interviewId}
/observations/{roundId}/{observationId}
/actions/{actionId}
/comments/{entityType}/{entityId}/{commentId}
/themes/{themeId}
/themeVersions/{themeId}/{versionId}
/attachments/{entityType}/{entityId}/{attachmentId}
/notifications/{uid}/{notificationId}
/pushTokens/{uid}/{tokenKey}
/auditLog/{eventId}
```

## Kommentarer

OpEx-master har et godt grunnprinsipp vi beholder:

- innlogget bruker
- forfatternavn
- timestamp
- nyeste/eldste sortering
- begrenset sletting etter tilgang

For LOR skal kommentarsystemet være generisk og kunne kobles til flere objekttyper, ikke bare tiltak.

## Push og varsling

OpEx-master bruker Firebase Cloud Messaging og lagrer push-token per bruker/enhet. Dette mønsteret gjenbrukes.

I LOR skiller vi eksplisitt mellom:

1. `notification` – et varselobjekt i appen
2. `delivery` – hvordan det leveres (in-app, push, senere eventuelt e-post)
3. `rule` – hva som utløser varselet

Dette gjør det mulig å endre varslingsreglene senere uten å bygge om UI eller datamodell.

## Filer

Vedlegg må håndteres som egen modul og kobles til kontekst via `entityType` + `entityId`.

Foreslått lagring av binærfiler: Firebase Storage. Metadata lagres i Realtime Database.

## PWA

Vi gjenbruker OpEx-prinsippene:

- installérbar webapp
- standalone display
- service worker
- mobil og PC
- sikker kontekst/HTTPS

Service worker skal holdes liten og ha tydelig cache-strategi. Push-håndtering skal ligge separat fra UI-logikk.

## Det vi bevisst ikke kopierer fra OpEx

- én svært stor `index.html`
- funksjoner som monkey-patcher globale funksjoner
- CSS injisert dynamisk fra funksjonsmoduler
- hardkodede bruker-ID-er i klientkode
- modulnavn med stadig økende versjonssuffiks som permanent arkitektur
- mobilfikser som legges inn inne i push-modulen

Dette fungerte som raske forbedringer i OpEx, men LOR skal bygges ryddigere fra start.

## Integrasjon mot OpEx-master

V1 skal ikke kreve direkte integrasjon for å fungere.

Datamodellen skal likevel støtte felt som:

- `sourceSystem`
- `sourceEntityId`
- `linkedOpexTaskId`

slik at et LOR-funn senere kan opprette/koble til et OpEx-tiltak uten ombygging av historiske data.

## Sikkerhetsprinsipp

- klienten skal aldri stole på skjulte knapper som tilgangskontroll
- skrive-/lesetilgang må håndheves i Firebase-regler og/eller Cloud Functions
- administratorstatus skal komme fra brukerprofil/claims, ikke hardkodet UID i klienten
- sensitive mutasjoner og push-utsending skal skje server-side

## Første tekniske milepæl

Foundation V1 er nå:

1. Modulær app-shell
2. Responsiv dashboard-placeholder
3. PWA manifest + service worker
4. Firebase adapter med konfigurasjon som kan fylles inn senere
5. Domenekonstanter/statuser
6. Første views for Dashboard, Mine LOR og Gjennomfør LOR

Deretter kobles reelle data og Auth inn.