# Belgium — E-Invoicing Compliance

- **Country code:** BE
- **Status:** live
- **Last reviewed:** 2026-09-04

This file is the curated, sourced knowledge base for Belgium, used by
InvoiceReady's retrieval layer. Every factual claim below carries a source
URL and a reviewed-on date, per the project's non-negotiable grounding rule.
Do not add a claim here without a source.

## Who is in scope

As of 1 January 2026, structured electronic invoicing is mandatory for
domestic B2B transactions between two Belgian VAT-taxable enterprises. The
obligation applies based on three factors, all of which must hold:

1. **Supplier** — a VAT-taxable person established in Belgium (including
   members of a Belgian VAT group).
2. **Customer** — also a Belgian VAT-taxable person (has a Belgian VAT
   number and is not exclusively performing VAT-exempt activities).
3. **Transaction** — a supply of goods or services located in Belgium for
   VAT purposes.

Importantly, the obligation applies **regardless of business size or
turnover** — there is no phase-in by company size, unlike some other
countries' mandates. This includes small enterprises using the small-business
VAT exemption scheme (turnover under €25,000) and farmers under the special
agricultural VAT scheme — being a "small" business does **not** exempt you.

B2C transactions (invoicing private consumers) are explicitly out of scope
and remain voluntary. B2G (business-to-government) e-invoicing was already
mandatory before this reform under separate, earlier rules.

**Sources:**
- https://finance.belgium.be/en/enterprises/vat/e-invoicing/mandatory-use-structured-electronic-invoices-2026 (reviewed 2026-09-04)
- https://einvoice.belgium.be/en/FAQ/general-questions-b2b (reviewed 2026-09-04)

## Dates and phases

- **1 January 2026** — mandatory structured e-invoicing begins for
  in-scope domestic B2B transactions.
- **1 January 2026 – 31 March 2026** — a tolerance (grace) period: FPS
  Finance will not impose sanctions for infringements specific to the new
  e-invoicing obligation during this window, provided the business can
  demonstrate it took reasonable, timely steps toward compliance. This was
  confirmed in an FPS Finance announcement dated 19 December 2025.
- **Legal basis** — the obligation was introduced by the Federal Law of
  6 February 2024 amending the Belgian VAT Code. Technical implementation
  is detailed in the Royal Decree of 8 July 2025 ("Arrêté royal modifiant
  les arrêtés royaux nos 1, 8 et 44 en matière de taxe sur la valeur
  ajoutée en ce qui concerne les factures électroniques structurées" /
  Koninklijk Besluit van 8 juli 2025), published in the Belgian Official
  Gazette (Moniteur belge / Belgisch Staatsblad) on 14 July 2025, page
  59264, official reference 2025005169. It entered into force on
  1 January 2026.

Beyond the 2026 domestic B2B mandate, further changes (intra-EU B2B
e-invoicing under the EU's ViDA package, and possible real-time reporting)
are expected later this decade but are not yet in force and are outside
this file's scope — do not state a specific future date for these to a
user without checking the official source first, since reported dates vary
across secondary sources.

**Sources:**
- https://einvoice.belgium.be/en (news item dated 18 December 2025; reviewed 2026-09-04)
- https://finance.belgium.be/en/enterprises/vat/e-invoicing/mandatory-use-structured-electronic-invoices-2026 (reviewed 2026-09-04)

## Required format and network

Invoices must be **structured electronic invoices** compliant with the
European standard **EN 16931**, transmitted over the **Peppol** network
(4-corner model).

- The default, recommended message format is **Peppol BIS Billing 3.0**
  (based on UBL 2.1).
- An alternative EN 16931-compliant format (for example CII/Factur-X) is
  permitted **only** if both parties mutually agree in advance and the
  receiving party can convert it to EN 16931 if needed.
- Sending a PDF or paper invoice alongside the structured invoice is
  allowed for convenience, but only the structured electronic invoice sent
  via Peppol is the legally compliant invoice.
- Attachments must travel through the same Peppol channel as the invoice,
  not sent separately by email.

**Sources:**
- https://einvoice.belgium.be/en/FAQ/general-questions-b2b (reviewed 2026-09-04)
- https://finance.belgium.be/en/enterprises/vat/e-invoicing (reviewed 2026-09-04)

## Penalties

The Royal Decree of 8 July 2025 (see "Dates and phases" above) introduced
a specific graduated fine for failing to have the technical means in place
to send and receive structured e-invoices:

- **€1,500** for a first infringement
- **€3,000** for a second infringement
- **€5,000** for a third and any subsequent infringement

A new infringement only escalates to the next tier if it occurs within
three months of the previous one — infringements spaced further apart than
that reset back to the first-tier amount. Tax authorities are not required
to issue a warning before imposing a fine.

This is a *new*, e-invoicing-specific penalty. It sits alongside — and
does not replace — Belgium's pre-existing general invoicing fines for
missing or late invoices (proportional fines under Table C of the annex to
Royal Decree No. 41, and non-proportional fines under Royal Decree No. 44),
which continue to apply to structured invoices as they did before.

No penalties specific to the e-invoicing obligation apply during the
1 January – 31 March 2026 tolerance period, provided reasonable compliance
effort can be shown (see "Dates and phases" above).

**Sources:**
- https://www.rsm.global/belgium/nl/insights/belgische-b2b-e-facturatie-koninklijk-besluit-bevestigt-praktische-modaliteiten-en-sancties (RSM Belgium, reviewed 2026-09-04)
- https://www.wolterskluwer.com/fr-be/expert-insights/e-invoicing-2026-fines-up-to-5000 (Wolters Kluwer, reviewed 2026-09-04)
- https://einvoice.belgium.be/en (tolerance period; reviewed 2026-09-04)

## Common exemptions

The following are **not** subject to the mandatory structured e-invoicing
obligation:

- A taxable person who **exclusively** carries out transactions exempt
  under Article 44 of the Belgian VAT Code (e.g. certain medical, financial,
  or educational services).
- A taxable person applying the flat-rate scheme under Article 56 of the
  Belgian VAT Code (note: this scheme is itself being phased out by 2028).
- Entities in a state of bankruptcy.
- Taxable persons not established in Belgium — i.e. a foreign business that
  is only VAT-registered in Belgium (no Belgian seat of economic activity
  or fixed establishment) is excluded, even if it holds a Belgian VAT
  number.
- All B2C transactions (invoicing a private individual) — voluntary, not
  mandatory.

**Common misconception to correct explicitly:** being a small business or
using the small-enterprise VAT exemption scheme (turnover under €25,000)
does **not** exempt you from this obligation — see "Who is in scope" above.

**Sources:**
- https://einvoice.belgium.be/en/FAQ/general-questions-b2b (reviewed 2026-09-04)
- https://finance.belgium.be/en/enterprises/vat/e-invoicing/mandatory-use-structured-electronic-invoices-2026 (reviewed 2026-09-04)
