# Poland — E-Invoicing Compliance

- **Country code:** PL
- **Status:** live
- **Last reviewed:** 2026-09-11

This file is the curated, sourced knowledge base for Poland, used by
InvoiceReady's retrieval layer. Every factual claim below carries a source
URL and a reviewed-on date, per the project's non-negotiable grounding rule.
Do not add a claim here without a source.

## Who is in scope

Poland's mandatory e-invoicing runs through **KSeF** (Krajowy System
e-Faktur — the National e-Invoice System), a central platform operated by
the Ministry of Finance. Unlike Belgium, which switched on for everyone at
once, Poland phases the *issuing* obligation by taxpayer size — but the
*receiving* obligation applies to everyone from the first date.

The obligation covers a taxable person who:

1. Has a registered office or a **fixed establishment in Poland** that
   participates in the transaction, and
2. Issues invoices for **B2B** supplies (business to business). B2G is also
   handled electronically, but through the separate, pre-existing PEF
   platform rather than KSeF.

The system covers taxpayers who charge VAT **and** those using a VAT
exemption — being exempt from VAT does not put you outside KSeF.

A foreign business that is only VAT-registered in Poland, with **no fixed
establishment** taking part in the supply, is **not** obliged to issue
invoices through KSeF.

**Sources:**
- https://ksef.podatki.gov.pl/ (reviewed 2026-09-11)
- https://eztax.pl/czy-podmioty-zagraniczne-bez-stalego-miejsca-prowadzenia-dzialalnosci-w-polsce-musza-uzywac-ksef/ (foreign entities without a fixed establishment; reviewed 2026-09-11)

## Dates and phases

- **1 February 2026** — two things start on this date:
  - **All** taxpayers must be able to **receive** structured invoices
    through KSeF, regardless of when their own issuing obligation begins.
  - **Large taxpayers** — those whose 2024 turnover exceeded
    **PLN 200 million** (roughly €46 million) — must **issue** all sales
    invoices exclusively through KSeF.
- **1 April 2026** — the issuing obligation extends to **all other VAT
  taxpayers**, including sole traders and the SME sector. This is the date
  that matters for a typical small business.
- **1 January 2027** — the final phase brings in the smallest taxpayers,
  i.e. those covered by the low-value transition below.

**Transition during 2026:** between **1 April and 31 December 2026**, a
taxpayer who is otherwise obliged to issue structured invoices may still
issue paper or ordinary electronic invoices in a given month if the total
value of sales documented by those invoices in that month is **PLN 10,000
or less**. Once that monthly threshold is exceeded, KSeF must be used.

**Sources:**
- https://ksef.podatki.gov.pl/ (reviewed 2026-09-11)
- https://www.ey.com/en_gl/technical/tax-alerts/poland-announces-new-timeline-for-mandatory-e-invoicing (EY, phased timeline; reviewed 2026-09-11)
- https://ksiegowosc.infor.pl/podatki/vat/faktura/7505444,zwolnienie-z-ksef-w-2026-r-przy-miesiecznej-sprzedazy-do-10-tys-zl-jak-liczyc-sprzedaz-od-kiedy-stosowac-ksef-po-przekroczeniu-limitu.html (PLN 10,000 monthly transition; reviewed 2026-09-11)

## Required format and network

Invoices must be **structured XML invoices** conforming to the **FA(3)**
logical structure, sent to and retrieved from **KSeF**.

- **FA(3) replaced the earlier FA(2) structure on 1 February 2026.** An
  invoice built to the old FA(2) schema is no longer the current standard.
- The FA(3) XSD schema is published by the Ministry of Finance in the
  Central Repository of Document Models (CRWD) and downloadable from the
  official KSeF site.
- FA(3) added, among other things, support for **attachments** to a
  structured invoice, VAT groups, local government units (JST), an
  employee contractor type, the KSeF payment identifier (IPKSeF), and bank
  account numbers up to 34 characters (full IBAN length).
- KSeF is a **central clearance platform**: the invoice is sent to the
  Ministry of Finance's system, which assigns it a KSeF number and a
  timestamp. The date the invoice is sent to KSeF is what counts as the
  date of issue.

**Important correction — Poland does not use Peppol for B2B.** Some
secondary summaries (including, at time of review, the European
Commission's own eInvoicing country page for Poland) describe the Polish
B2B mandate as Peppol BIS Billing 3.0. That conflates the separate **PEF**
platform used for **B2G** procurement, which does use Peppol, with the
**KSeF** B2B mandate, which uses the national FA(3) XML structure. For
domestic B2B in Poland, FA(3) via KSeF is the correct answer.

**Sources:**
- https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/struktura-logiczna-fa-3/ (FA(3) logical structure; reviewed 2026-09-11)
- https://ksef.podatki.gov.pl/pliki-do-pobrania-ksef-20 (official FA(3) XSD downloads; reviewed 2026-09-11)
- https://ec.europa.eu/digital-building-blocks/sites/spaces/DIGITAL/pages/467108896/eInvoicing+in+Poland (the page containing the Peppol/KSeF conflation described above; reviewed 2026-09-11)

## Penalties

Financial penalties for KSeF breaches **do not apply during 2026**. The
whole of 2026 is treated as a transition period for adapting invoicing and
ERP systems, and the tax authority does not impose monetary sanctions in
that window.

**From 1 January 2027**, the head of the tax office may impose:

- a penalty of up to **100% of the amount of VAT** shown on an invoice
  issued outside KSeF, and
- for an invoice showing no VAT, a penalty of up to **18.7%** of the total
  gross amount shown on that invoice.

Penalties can be imposed in particular for failing to issue a structured
invoice when obliged to, issuing an invoice that does not conform to the
required format, or failing to send the document to KSeF within the
required time.

**Sources:**
- https://ksiegowosc.infor.pl/ksef/7603120,od-1-stycznia-2027-r-poczatek-stosowania-kar-w-ksef-nie-bedzie-zlagodzenia-bo-przepisy-sa-juz-lagodne-wskaznik-100-i-187.html (Infor.pl, penalty rates and start date; reviewed 2026-09-11)
- https://www.saldeosmart.pl/blog/wszystko-o-ksef/kary-za-brak-ksef/ (SaldeoSMART, penalty scope; reviewed 2026-09-11)

## Common exemptions

The following are **not** sent through KSeF:

- **B2C invoices** — invoices issued to private individuals not conducting
  business activity are excluded by law (Article 106ga(2) of the Polish VAT
  Act), regardless of the consumer's country.
- **Foreign entities with no Polish fixed establishment** participating in
  the transaction (see "Who is in scope" above).
- Documents treated as invoices under separate rules, such as **rail and
  air tickets** and **motorway toll receipts**.
- Invoices issued under the **OSS and IOSS** special schemes.

**Common misconception to correct explicitly:** using a VAT exemption does
**not** put you outside KSeF. The system was designed to cover all
taxpayers, both those charging VAT and those exempt. What can defer your
obligation during 2026 is the **PLN 10,000 monthly sales threshold**
described under "Dates and phases" — that is a low-turnover transition, not
a permanent exemption, and it ends on 31 December 2026.

**Sources:**
- https://symfonia.pl/blog/firmy/male-firmy/jakich-faktur-nie-mozna-wystawic-przez-ksef/ (Symfonia, list of exclusions; reviewed 2026-09-11)
- https://akademialtca.pl/blog/czy-podatnicy-zagraniczni-bez-stalego-miejsca-dzialalnosci-sa-wylaczeni-z-ksef (foreign taxpayers; reviewed 2026-09-11)
- https://ksef.podatki.gov.pl/ (reviewed 2026-09-11)
