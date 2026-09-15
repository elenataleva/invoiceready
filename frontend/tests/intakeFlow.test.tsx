import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"
import { describe, expect, it } from "vitest"

import { Landing } from "@/pages/Landing"

/**
 * The happy path end to end: three questions, then a navigation to /result
 * carrying the profile in the URL. docs/04-FRONTEND-DESIGN.md #2 earmarks
 * Playwright for this, but the whole path is client-side and deterministic
 * against demo fixtures, so it runs here without a browser download. What
 * Playwright would still add is real layout and real focus behaviour.
 */
// Each answer now writes to shared intake state, which re-renders the
// preview panel and re-fetches its rules from DemoDataSource (400-700ms of
// deliberate fake latency). Waits need headroom for that, not RTL's 1s default.
const SETTLED = { timeout: 5000 }

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}

function renderIntake() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/result" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  )
}

describe("intake flow", () => {
  it("walks all three steps and hands the profile to /result in the URL", async () => {
    const user = userEvent.setup()
    renderIntake()

    // Step 1 - country. Options come from the real countries fixture.
    await user.click(await screen.findByRole("radio", { name: /belgium/i }, { timeout: 3000 }))
    await user.click(screen.getByRole("button", { name: /continue/i }))

    // Step 2 - VAT status and size bands.
    expect(
      await screen.findByRole("heading", { name: /how big is your business/i }, SETTLED)
    ).toBeVisible()
    await user.click(screen.getByRole("radio", { name: /^yes$/i }))
    await user.click(screen.getByRole("radio", { name: /10 to 49 people/i }))
    await user.click(screen.getByRole("radio", { name: /EUR 100,000 to 500,000/i }))
    await user.click(screen.getByRole("button", { name: /continue/i }))

    // Step 3 - who they invoice.
    // Queried as a heading: the sr-only <legend> carries the same words,
    // which is correct for screen readers but ambiguous for getByText.
    expect(
      await screen.findByRole("heading", { name: /who do you send invoices to/i }, SETTLED)
    ).toBeVisible()
    await user.click(screen.getByRole("checkbox", { name: /other businesses/i }))
    await user.click(screen.getByRole("button", { name: /see my obligations/i }))

    const location = await screen.findByTestId("location", undefined, SETTLED)
    expect(location.textContent).toContain("/result")
    expect(location.textContent).toContain("country=BE")
    expect(location.textContent).toContain("vat=1")
    expect(location.textContent).toContain("emp=10-49")
    expect(location.textContent).toContain("turnover=100k_500k")
    expect(location.textContent).toContain("to=B2B")
    // Generous: the full path stacks several of DemoDataSource's
    // deliberate 400-700ms delays, which exist to make demo mode feel like
    // a real request and shouldn't be tuned down just to speed up a test.
  }, 20_000)

  it("will not advance past an unanswered question", async () => {
    const user = userEvent.setup()
    renderIntake()

    await screen.findByRole("radio", { name: /belgium/i }, { timeout: 3000 })
    await user.click(screen.getByRole("button", { name: /continue/i }))

    // zod blocks the step rather than sending an empty country onward.
    expect(await screen.findByRole("alert", undefined, SETTLED)).toBeVisible()
    expect(screen.getByRole("heading", { name: /where is your business registered/i })).toBeVisible()
  })

  it("fills the side panel with real rules as soon as a country is picked", async () => {
    const user = userEvent.setup()
    renderIntake()

    expect(await screen.findByText(/what you'll get/i)).toBeVisible()

    await user.click(await screen.findByRole("radio", { name: /belgium/i }, { timeout: 3000 }))

    expect(
      await screen.findByText(/accepting invoices from your suppliers/i, undefined, {
        timeout: 3000,
      })
    ).toBeVisible()
  }, 20_000)
})
