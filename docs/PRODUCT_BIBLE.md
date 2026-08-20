# LOR Platform – Product Bible V1

## 1. Formål

LOR Platform skal gjøre Lederoppfølgingsrunder til et kontinuerlig leder- og forbedringssystem, ikke bare et kontrollskjema.

En gjennomført LOR skal produsere strukturert kunnskap om positive observasjoner, forbedringspunkter, avvik, medarbeiderinnspill og nødvendig oppfølging. Dataene skal kunne analyseres over tid på leder, avdeling, tema og kontrollpunkt.

## 2. Produktidentitet

LOR Platform og OpEx-master er **to separate apper** med ulike behov, ulike arbeidsflyter og egen produktidentitet.

De kan dele:

- tekniske mønstre og erfaringer
- Firebase Authentication der det er hensiktsmessig
- overordnede kvalitetsprinsipper
- enkelte designprinsipper og komponentmønstre
- læring fra mobil/PWA, varsling, kommentarer, historikk og eksport

De skal ikke behandles som moduler i samme produkt eller utvikles slik at LOR blir en kopi av OpEx. LOR skal optimaliseres for lederoppfølgingsrunder, observasjon, medarbeiderdialog, læring og utvikling.

LOR skal ha sin egen visuelle identitet innenfor en profesjonell Nortura-kontekst.

## 3. Presentasjonskrav

LOR skal kunne presenteres for Nortura Sarpsborgs ledergruppe og må derfor oppleves som et troverdig, gjennomarbeidet og presentasjonsklart produkt.

Dette innebærer:

- tydelig og moderne visuell identitet
- høy informasjonskvalitet uten unødvendig kompleksitet
- dashboard som kommuniserer verdi på få sekunder
- naturlig og rask mobilflyt ute i fabrikken
- profesjonell PC-opplevelse for analyse og ledelsesoppfølging
- konsekvent språk, spacing, typografi og komponentbruk
- relevante tomtilstander, hjelpetekster og mikrointeraksjoner
- ingen synlige prototype-elementer, tekniske plassholdere eller uferdige visninger i demonstrasjonsmodus
- demonstrasjonsdata må fortelle en troverdig historie om hvordan LOR skaper verdi

Design skal kontinuerlig forbedres og optimaliseres gjennom utviklingen, ikke behandles som et avsluttende pyntelag.

## 4. Primære brukere

V1 tar utgangspunkt i samme godkjente brukergruppe som OpEx-master. Rolle- og tilgangsmodell detaljeres før implementering.

## 5. Kjerneobjekt: LOR-runden

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

## 6. Foreløpige statuser

- Ikke fordelt
- Planlagt
- Pågår
- Gjennomført
- Oppfølging pågår
- Lukket

`Forsinket` behandles som en systemberegnet status/indikator slik at historikken ikke avhenger av manuell registrering.

## 7. Svar på kontrollpunkt

- OK
- Forbedringspunkt
- Avvik
- Ikke relevant

Positive observasjoner skal kunne registreres eksplisitt og være synlige i oppsummering og historikk.

## 8. V1 arbeidsflyt

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

## 9. Dashboard

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

Dashboardet skal også fungere som den primære ledelsesvisningen i presentasjoner. Det skal raskt kunne forklare status, utvikling, risiko og anbefalt fokus uten at brukeren må navigere gjennom flere sider.

## 10. Lederstatus

Lederstatus skal ikke premiere lavt antall funn eller høy OK-andel isolert. Modellen skal primært vurdere:

- gjennomføringsgrad
- regelmessighet / gjennomføring innen frist
- kvalitet/kompletthet i dokumentasjon
- oppfølging av funn
- lukking innen frist
- medarbeiderinvolvering

Eksakt beregningsmodell låses senere.

## 11. Temabank

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

## 12. Innsikt og utvikling

Systemet skal kunne identifisere blant annet:

- gjentagende funn
- temaer med negativ/positiv trend
- kontrollpunkter som sjelden gir funn
- kontrollpunkter med hyppige avvik
- avdelingsforskjeller
- oppfølginger som ofte blir forsinket

Systemet kan foreslå endret fokus eller frekvens. Kritiske HMS-/kvalitetstemaer skal ikke fjernes automatisk.

## 13. Varslinger

Varslingssystem er V1-krav, men detaljert varslingsmatrise er bevisst ikke låst ennå. Den utformes separat.

Kategorier som må støttes teknisk:

- planlagt LOR
- påminnelser
- forsinket LOR
- frister/forfalte oppfølginger
- kommentarer
- endringer
- relevante systeminnsikter

## 14. Dokumentasjon

Vedlegg skal kunne knyttes til riktig kontekst, eksempelvis:

- LOR-runde
- kontrollpunkt
- observasjon
- oppfølging

Metadata skal inkludere opplaster og timestamp.

## 15. Forholdet til OpEx-master

OpEx-master er referanse for læring og mønstre, men ikke produktstruktur.

Eventuell fremtidig integrasjon skal være eksplisitt og løs koblet. Et LOR-funn kan senere kunne opprette eller kobles til et tiltak i OpEx-master uten dobbeltregistrering, men appene skal fortsatt fungere selvstendig.

## 16. Produktfilosofi

LOR skal kontinuerlig forbedres og optimaliseres. Nye funksjoner skal vurderes etter om de:

1. gjør rundene enklere å gjennomføre
2. forbedrer kvaliteten på observasjoner og medarbeiderdialog
3. styrker oppfølging og læring
4. gir ledelsen bedre beslutningsgrunnlag
5. reduserer administrasjon eller dobbeltarbeid
6. gjør produktet mer intuitivt og attraktivt å bruke

Funksjoner som bare tilfører visuell eller prosessmessig kompleksitet uten tydelig bruker- eller ledelsesverdi skal normalt ikke prioriteres.

## 17. Ikke låst ennå

Følgende bestemmes senere uten å blokkere foundation:

- detaljert varslingsmatrise
- eksakt leder-score
- endelig rolle-/tilgangsmatrise
- endelig AI/innsiktsnivå
- eventuell teknisk integrasjon mellom LOR og OpEx-master
