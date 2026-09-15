import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { AskResponse } from "@/api/client"

import refusedFixture from "@/demo/fixtures/ask/refused.json"
import groundedFixture from "@/demo/fixtures/ask/grounded.json"

/**
 * docs/04-FRONTEND-DESIGN.md #10 requires the refusal state to be covered
 * by a test, and #1.2 says why: a refusal is the product working
 * correctly, so it must never be presented as an error. These assert both
 * halves of that - that a refusal is shown calmly, and that an answer
 * without a citation is never shown at all.
 */
function stubAsk(response: AskResponse) {
  return vi.fn(async () => response)
}

async function renderWithAsk(response: AskResponse) {
  const ask = stubAsk(response)
  vi.doMock("@/api", () => ({ useDataSource: () => ({ ask }) }))
  vi.resetModules()
  const { AskPanel: Panel } = await import("@/features/ask/AskPanel")
  render(<Panel country="BE" />)
  return { ask }
}

describe("AskPanel - refusal", () => {
  it("shows a real refusal calmly, with no error styling and no citations", async () => {
    const user = userEvent.setup()
    await renderWithAsk(refusedFixture.response as AskResponse)

    await user.type(screen.getByLabelText(/ask a question/i), "what format do I need")
    await user.click(screen.getByRole("button", { name: /^ask$/i }))

    const message = await screen.findByText(/don't have grounded information/i)
    expect(message).toBeInTheDocument()

    // The refusal card is muted and informational - never the danger
    // colour, which this product reserves for penalty amounts.
    const card = message.closest("div[class]")
    expect(card?.className ?? "").not.toMatch(/danger|destructive/)
    expect(screen.queryByRole("link", { name: /source/i })).not.toBeInTheDocument()
  })
})

describe("AskPanel - grounded answer", () => {
  it("renders the answer with every citation the API returned", async () => {
    const user = userEvent.setup()
    const response = groundedFixture.response as AskResponse
    await renderWithAsk(response)

    await user.click(screen.getByRole("button", { name: /what invoice format/i }))

    await waitFor(() => expect(screen.getAllByRole("link").length).toBeGreaterThan(0))
    const links = screen.getAllByRole("link").map((link) => link.getAttribute("href"))
    for (const citation of response.citations) {
      expect(links).toContain(citation)
    }
  })

  it("refuses to display an answer the API sent without any citation", async () => {
    // Shouldn't happen given app/routers/ask.py, but nothing in the type
    // system enforces it - and "every claim shows its receipt" (#1.1) has
    // to hold at the point of display too.
    const user = userEvent.setup()
    await renderWithAsk({
      answer: "Belgium requires Peppol BIS Billing 3.0.",
      citations: [],
      refused: false,
    })

    await user.type(screen.getByLabelText(/ask a question/i), "what format")
    await user.click(screen.getByRole("button", { name: /^ask$/i }))

    expect(await screen.findByText(/arrived without a source/i)).toBeInTheDocument()
    expect(screen.queryByText(/Peppol BIS Billing 3\.0\./)).not.toBeInTheDocument()
  })
})

describe("AskPanel - starter questions", () => {
  it("offers real starter questions so the box is never empty", async () => {
    await renderWithAsk(groundedFixture.response as AskResponse)

    expect(screen.getByRole("button", { name: /what invoice format do I need/i })).toBeVisible()
  })
})
