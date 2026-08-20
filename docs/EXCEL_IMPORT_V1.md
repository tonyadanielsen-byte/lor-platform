# Excel-import V1

## Kilder

- `Intern LOR August - 2026(1).xlsx`
- `Intern LOR August - Desember 2025.xlsx`

## Resultat

Excel-grunnlaget er konvertert til strukturerte seed-data for appen:

- `data/seed/themes-v1.json` – kanonisk temabank
- `data/seed/plan-2026.json` – årsplan uke 16–52
- `data/seed/history-2025.json` – registrert historikk fra 2025
- `data/seed/history-2026.json` – registrert historikk fra 2026

Appen bruker seed-dataene som fallback når Firebase ennå ikke inneholder LOR-plan/temabank. Det gjør at vi kan utvikle og demonstrere med reelt faglig innhold uten å skrive seed-data direkte til produksjonsdatabasen først.

## Temabank

De dedikerte temafanene brukes som kanonisk V1 for de syv planlagte hovedtemaene:

1. HMS-opplæring
2. Husorden
3. Rutinebeskrivelser
4. Kontrollrutiner
5. Hygiene
6. HMS-verneutstyr
7. Kvalitet og HMS-kultur

Avdelingsfanene for Ferdigmat, Renhold og Rekvisita/Lager inneholder i tillegg utvidede temaer. Disse er bevart i temabanken, blant annet:

- HMS – Brann og rømningsvei
- HMS-Truck
- HMS – Trivsel
- Tavlemøte
- Hygiene etter tekniske inngrep
- Avfall
- Sporing og merking
- Fremmedlegemer
- Temperaturkontroll
- Merkekontroll

Renhold har et eget tillegg under HMS-verneutstyr om kontroll av utstyr for arbeid i høyden.

## Versjonering

Spørsmålsbankene i 2025- og 2026-arbeidsbøkene er identiske. De registreres derfor som samme faglige **V1**. Fremtidige endringer i temabanken skal opprette ny versjon og må ikke omskrive historiske runder.

## Datakvalitet / må avklares

Importen korrigerer ikke faglige kildedata automatisk.

### 2026-plan

- Uke 16 har `Tony / Renhold / [mangler avdeling]`. `Renhold` står i tema-kolonnen og ser ut som en avdeling. Raden er markert `needsReview`.
- Uke 27–32 mangler ansvarlig leder.
- Uke 52 har avdeling `Ferdigmat`, men mangler både ansvarlig og tema.

### 2026-historikk

- Uke 16 er registrert som `Rutinebeskrivelser`, mens planraden viser `Renhold` i tema-kolonnen. Historikken er bevart uendret og markert som kildeavvik.
- Uke 16 mangler avdeling i oppfølgingsarket.

## Bevisste forbedringer i appmodellen

- `OK / Ikke OK` erstattes i ny registrering av `OK / Forbedringspunkt / Avvik / Ikke relevant`.
- Åpne «Eventuelle andre observasjoner»-punkter behandles som fritekst og krever ikke vurderingsstatus.
- Positiv feedback er eksplisitt første steg i en LOR.
- Kildetekster bevares, men tema-navn normaliseres slik at varianter som `HMS-Opplæring`, `HMS-opplæring` og ekstra mellomrom ikke blir forskjellige temaer.

## Neste datasteg

Når Firebase-regler og adminflyt er klar, seedes godkjent plan og temabank inn i `lor/...`. Før dette bør de markerte `needsReview`-radene avklares av faglig eier.
