import type {
  AskRequest,
  AskResponse,
  AssessRequest,
  AssessResponse,
  Country,
  DataSource,
  Rule,
} from "@/api/client"
import countriesFixture from "@/demo/fixtures/countries.json"

interface AssessFixture {
  request: AssessRequest
  response: AssessResponse
}

interface AskFixture {
  request: AskRequest
  response: AskResponse
}

// Eager glob, not dynamic import per file: every fixture ships in the
// production bundle regardless of which one a visitor happens to hit, so
// the demo never has a loading state of its own to design for.
const assessFixtures = Object.values(
  import.meta.glob<{ default: AssessFixture }>("../demo/fixtures/assess/*.json", { eager: true })
).map((module) => module.default)

const askFixtures = Object.values(
  import.meta.glob<{ default: AskFixture }>("../demo/fixtures/ask/*.json", { eager: true })
).map((module) => module.default)

// Keyed by country code, taken from the filename (rules/BE.json), since
// rules are looked up by country rather than matched against a request.
const ruleFixtures: Record<string, Rule[]> = Object.fromEntries(
  Object.entries(
    import.meta.glob<{ default: Rule[] }>("../demo/fixtures/rules/*.json", { eager: true })
  ).map(([path, module]) => [path.split("/").pop()!.replace(".json", ""), module.default])
)

const DEMO_DELAY_MS: [number, number] = [400, 700]

function delay(): Promise<void> {
  const [min, max] = DEMO_DELAY_MS
  return new Promise((resolve) => setTimeout(resolve, min + Math.random() * (max - min)))
}

function sameProfile(a: AssessRequest, b: AssessRequest): boolean {
  return (
    a.country === b.country &&
    a.vat_registered === b.vat_registered &&
    a.employee_count === b.employee_count &&
    a.annual_turnover_eur === b.annual_turnover_eur &&
    JSON.stringify([...a.invoices_to].sort()) === JSON.stringify([...b.invoices_to].sort())
  )
}

/**
 * Resolves from the fixtures snapshotted by scripts/snapshot_fixtures.py -
 * never hand-written, so demo output can't silently drift from what the
 * real API actually returns (docs/04-FRONTEND-DESIGN.md #6).
 *
 * assess()/ask() only have a handful of exact profiles snapshotted, since
 * every seeded rule currently applies to a whole country regardless of
 * size (scripts/seed_rules.py has no real threshold to demonstrate yet).
 * An unmatched profile therefore falls back to that country's real
 * response rather than a fabricated one - "closest real answer", never
 * "invented answer". Revisit once the wizard's band selectors (#3.1) fix
 * the set of profiles a visitor can actually construct.
 */
export class DemoDataSource implements DataSource {
  async countries(): Promise<Country[]> {
    await delay()
    return countriesFixture
  }

  async rules(country: string): Promise<Rule[]> {
    await delay()
    // An unknown country has no rules rather than an error - the live API
    // 404s, but in demo mode "nothing on file for that country" is the
    // honest equivalent and the preview renders it as such.
    return ruleFixtures[country.toUpperCase()] ?? []
  }

  async assess(input: AssessRequest): Promise<AssessResponse> {
    await delay()

    const exact = assessFixtures.find((fixture) => sameProfile(fixture.request, input))
    if (exact) return exact.response

    const sameCountry = assessFixtures.find((fixture) => fixture.request.country === input.country)
    if (sameCountry) return sameCountry.response

    return {
      in_scope: false,
      obligations: [],
      next_steps: [],
      disclaimer:
        assessFixtures[0]?.response.disclaimer ??
        "Informational guidance only, not tax or legal advice.",
    }
  }

  async ask(input: AskRequest): Promise<AskResponse> {
    await delay()

    const grounded = askFixtures.find(
      (fixture) => fixture.request.country === input.country && !fixture.response.refused
    )
    if (grounded) return grounded.response

    const refused = askFixtures.find((fixture) => fixture.response.refused)
    if (refused) return refused.response

    return {
      answer:
        "I don't have grounded information to answer this question. Please check the official source for your country's e-invoicing rules.",
      citations: [],
      refused: true,
    }
  }
}
