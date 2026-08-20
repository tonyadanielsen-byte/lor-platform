# LOR Platform – Product Bible V1

## 1. Formål

LOR Platform skal gjøre Lederoppfølgingsrunder til et kontinuerlig leder- og forbedringssystem, ikke bare et kontrollskjema.

En gjennomført LOR skal produsere strukturert kunnskap om positive observasjoner, forbedringspunkter, avvik, medarbeiderinnspill og nødvendig oppfølging. Dataene skal kunne analyseres over tid på leder, avdeling, tema og kontrollpunkt.

## 2. Primære brukere

V1 tar utgangspunkt i samme godkjente brukergruppe som OpEx-master. Rolle- og tilgangsmodell detaljeres før implementering.

## 3. Kjerneobjekt: LOR-runden

Hver LOR-runde skal minimum kunne knyttes til:

- unik ID
- planlagt uke/dato
- faktisk start- og sluttid
- ansvarlig leder
- avdeling
- tema og temaversjon
- kontrollpunkter og svar
- positive observasjoner
- forbedringspunkter/avvik
- medarbeiderdialog
- bilder/dokumenter
- oppfølging/tiltak
- kommentarer med bruker og timestamp
- status

## 4. Foreløpige statuser

- Ikke fordelt
- Planlagt
- Pågår
- Gjennomført
- Oppfølging pågår
- Lukket

`Forsinket` behandles som en systemberegnet status/indikator slik at historikken ikke avhenger av manuell registrering.

## 5. Svar på kontrollpunkt

- OK
- Forbedringspunkt
- Avvik
- Ikke relevant

Positive observasjoner skal kunne registreres eksplisitt og være synlige i oppsummering og historikk.

## 6. V1 arbeidsflyt

### Planlegging
LOR tildeles leder, avdeling, tema og tidsperiode.

### Gjennomføring
Leder starter runden fra mobil eller PC. Kontrollpunkter vises strukturert. Kommentar, bilde og dokumentasjon kan registreres på relevant kontrollpunkt.

### Medarbeiderdialog
Leder kan registrere en eller flere medarbeiderdialoger. Medarbeider kan registreres med navn eller anonymt. Innspill og behov for oppfølging lagres strukturert.

### Oppsummering
Før innsending vises positive observasjoner, forbedringspunkter, avvik, medarbeiderinnspill og foreslåtte oppfølginger.

### Oppfølging
Observasjoner som krever handling kan opprette oppfølging/tiltak med ansvarlig, frist og status.

### Lukking
Runden kan lukkes når nødvendige oppfølginger er ferdigbehandlet etter definerte regler.

## 7. Dashboard

Dashboard skal som minimum vise hittil i år:

- planlagte LOR
- gjennomførte LOR
- gjennomføringsgrad
- gjennomført innen frist
- positive observasjoner
- forbedringspunkter
- avvik
- åpne oppfølginger
- gjentagende funn
- utvikling gjennom året
- temaer med størst oppfølgingsbehov
- lederstatus

Dashboard skal støtte drill-down til underliggende runder/data.

## 8. Lederstatus

Lederstatus skal ikke premiere lavt antall funn eller høy OK-andel isolert. Modellen skal primært vurdere:

- gjennomføringsgrad
- regelmessighet / gjennomføring innen frist
- kvalitet/kompletthet i dokumentasjon
- oppfølging av funn
- lukking innen frist
- medarbeiderinvolvering

Eksakt beregningsmodell låses senere.

## 9. Temabank

Temaer og spørsmål skal være administrerbare data, ikke hardkodet innhold.

Et tema skal kunne ha:

- navn og beskrivelse
- aktiv/inaktiv/pause
- frekvens
- versjon
- gyldighetsperiode
- felles spørsmål
- avdelingsspesifikke spørsmål
- historisk statistikk

Endring av tema/spørsmål skal aldri omskrive historiske LOR-runder.

## 10. Innsikt og utvikling

Systemet skal kunne identifisere blant annet:

- gjentagende funn
- temaer med negativ/positiv trend
- kontrollpunkter som sjelden gir funn
- kontrollpunkter med hyppige avvik
- avdelingsforskjeller
- oppfølginger som ofte blir forsinket

Systemet kan foreslå endret fokus eller frekvens. Kritiske HMS-/kvalitetstemaer skal ikke fjernes automatisk.

## 11. Varslinger

Varslingssystem er V1-krav, men detaljert varslingsmatrise er bevisst ikke låst ennå. Den utformes separat.

Kategorier som må støttes teknisk:

- planlagt LOR
- påminnelser
- forsinket LOR
- frister/forfalte oppfølginger
- kommentarer
- endringer
- relevante systeminnsikter

## 12. Dokumentasjon

Vedlegg skal kunne knyttes til riktig kontekst, eksempelvis:

- LOR-runde
- kontrollpunkt
- observasjon
- oppfølging

Metadata skal inkludere opplaster og timestamp.

## 13. OpEx-integrasjon

Arkitekturen skal forberedes for at et LOR-funn senere kan opprette eller kobles til et tiltak i OpEx-master uten dobbeltregistrering.

## 14. Ikke låst ennå

Følgende bestemmes senere uten å blokkere foundation:

- detaljert varslingsmatrise
- eksakt leder-score
- endelig rolle-/tilgangsmatrise
- endelig AI/innsiktsnivå
- endelig teknisk integrasjon mellom LOR og OpEx-master
