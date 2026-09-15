import "@testing-library/jest-dom/vitest"

import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

// jsdom implements neither of these, and Radix's primitives (the radio
// group and checkbox behind every wizard option) call them on mount. Not
// app behaviour under test - just the parts of a browser jsdom omits.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
)
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

// Nothing in the suite may reach the network. DemoDataSource reads
// committed fixtures and needs no fetch at all, so a call getting this far
// means a test wired itself to HttpDataSource by mistake - which would
// make the suite depend on a running backend and, for /api/ask, spend
// real money. Fail loudly rather than hang.
vi.stubGlobal("fetch", () => {
  throw new Error("Network access is not allowed in tests - use DemoDataSource or a stub")
})
