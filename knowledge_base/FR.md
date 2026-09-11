# France — E-Invoicing Compliance

- **Country code:** FR
- **Status:** live
- **Last reviewed:** 2026-09-11

This file is the curated, sourced knowledge base for France, used by
InvoiceReady's retrieval layer. Every factual claim below carries a source
URL and a reviewed-on date, per the project's non-negotiable grounding rule.
Do not add a claim here without a source.

## Who is in scope

The French reform applies to **all businesses established in France that
are liable for VAT**, regardless of size, turnover, legal form or tax
regime — including micro-entrepreneurs under the VAT franchise scheme.

Two distinct obligations must be separated, because they start on
different dates:

1. **Receiving** electronic invoices — applies to **every** French
   VAT-taxable business from the first date, with no phase-in by size.
2. **Issuing** electronic invoices — phased by company size (see "Dates
   and phases").

The reform covers **domestic B2B** transactions between two French
VAT-taxable businesses. Transactions that fall outside e-invoicing (B2C and
cross-border) are instead covered by **e-reporting**, a separate obligation
to transmit transaction and payment data to the tax administration.

Every business must **designate an approved platform** ("plateforme
agréée", PA — formerly called PDP, plateforme de dématérialisation
partenaire) to issue and receive its invoices. There is no option to
exchange structured invoices directly with a customer outside an approved
platform.

**Sources:**
- https://entreprendre.service-public.gouv.fr/actualites/A15683?lang=en (reviewed 2026-09-11)
- https://www.impots.gouv.fr/facturation-electronique-et-plateformes-agreees (reviewed 2026-09-11)

## Dates and phases

- **1 September 2026** — two obligations begin:
  - **All** French VAT-taxable businesses must be able to **receive**
    electronic invoices. There is no size phase-in for reception: a
    one-person micro-enterprise must be able to receive from this date.
  - **Large enterprises (grandes entreprises) and mid-sized enterprises
    (ETI)** must **issue** electronic invoices.
- **1 September 2027** — **SMEs (PME) and micro-enterprises** must
  **issue** electronic invoices.

The official French size categories used for the phase-in are:

| Category | Employees | Turnover / balance sheet |
|---|---|---|
| Grande entreprise (GE) | 5,000 or more | over €1.5bn turnover or over €2bn balance sheet |
| ETI (mid-sized) | 250 to 4,999 | under €1.5bn turnover |
| PME (SME) | fewer than 250 | up to €50m turnover or up to €43m balance sheet |
| Microentreprise | fewer than 10 | up to €2m turnover or balance sheet |

A practical consequence worth stating plainly: a small French business has
**already** been required to receive e-invoices since 1 September 2026,
even though it does not have to issue them until 1 September 2027. Being in
the later issuing cohort is not a reason to have done nothing.

Electronic invoices must be **retained for 6 years** from the date of
issue.

**Sources:**
- https://entreprendre.service-public.gouv.fr/vosdroits/F23208 (dates and size definitions; reviewed 2026-09-11)
- https://entreprendre.service-public.gouv.fr/actualites/A15683?lang=en (calendar and 6-year retention; reviewed 2026-09-11)

## Required format and network

Invoices must be structured and conform to the European standard
**EN 16931**. France accepts three core formats ("formats socle"):

- **Factur-X** — a hybrid format: a human-readable PDF/A-3 with the
  structured XML data embedded inside it. This is usually the easiest
  starting point for a small business, because the invoice still looks like
  a normal PDF to a human reader.
- **UBL 2.1** — a structured XML format.
- **CII** — a structured XML format (Cross Industry Invoice).

Every approved platform (PA) authorised by the DGFiP must be able to issue,
receive and convert all three formats. An approved platform may also carry
other formats such as EDIFACT, but only where both the supplier's and the
customer's platforms support it.

**The public portal no longer sends invoices.** The Portail Public de
Facturation (PPF) was originally intended to offer a free invoicing
service; that was dropped, and the PPF now acts as the central **directory
(annuaire)** and **data concentrator** for the tax administration. It is
not a way to avoid using an approved platform.

**Sources:**
- https://www.impots.gouv.fr/facturation-electronique-et-plateformes-agreees (role of the approved platform; reviewed 2026-09-11)
- https://tenorsolutions.com/formats-facture-electronique/ (Factur-X, UBL, CII core formats; reviewed 2026-09-11)
- https://www.quadient.com/fr/blog/formats-facturation-electronique-france (format detail and PPF role change; reviewed 2026-09-11)

## Penalties

The 2026 finance law (loi de finances 2026) **increased** the penalties
that had originally been legislated for this reform:

- **Failure to issue an electronic invoice: €50 per invoice** (raised from
  €15), capped at **€15,000 per calendar year**.
- **Failure to meet e-reporting obligations** (transmitting transaction and
  payment data): **€500 per breach** (raised from €250), capped at
  **€15,000 per calendar year**.

These caps are per obligation and per calendar year, so the two ceilings
are counted separately.

Separately from the e-invoicing reform, France's pre-existing general
invoicing penalties continue to apply — including a fine of €15 per missing
or incorrect mandatory mention on an invoice, limited to 25% of the invoice
amount.

**Sources:**
- https://entreprendre.service-public.gouv.fr/vosdroits/F23208 (€50 per invoice, €15,000 annual cap; reviewed 2026-09-11)
- https://www.indy.fr/guide/facturation/electronique/augmentation-penalites-non-conformite/ (increase from €15/€250 to €50/€500 under loi de finances 2026; reviewed 2026-09-11)

## Common exemptions

The following are **outside** the e-invoicing obligation (though several of
them fall under **e-reporting** instead, which is not the same as being
free of any obligation):

- **B2C sales** — invoices to private individuals. These are covered by
  e-reporting of transaction data, not by e-invoicing.
- **Transactions with businesses not established in France**, including
  intra-EU and export/import transactions. Also e-reporting rather than
  e-invoicing.
- **Operations exempt from VAT** under Articles 261 to 261 E of the French
  General Tax Code (Code général des impôts) — this covers, among others,
  certain medical and health services, education and training, financial
  and insurance services, and some real-estate and non-profit activities.

**Common misconception to correct explicitly:** being a micro-entrepreneur,
or benefiting from the VAT franchise (franchise en base de TVA), does
**not** exempt you from the reform. Businesses in the franchise scheme are
explicitly in scope, and the universal **reception** obligation applied to
them from 1 September 2026 — the later 2027 date only defers their
obligation to *issue*.

**Sources:**
- https://entreprendre.service-public.gouv.fr/vosdroits/F23208 (scope, exclusions and franchise micro-entrepreneurs; reviewed 2026-09-11)
- https://www.economie.gouv.fr/tout-savoir-sur-la-facturation-electronique-pour-les-entreprises (scope of the reform; reviewed 2026-09-11)
