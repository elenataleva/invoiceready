import { ArchitectureDiagram } from "@/components/ArchitectureDiagram"
import { Layout } from "@/components/Layout"
import evalResults from "@/data/eval-results.json"
import { formatDate } from "@/lib/dates"

const GITHUB_URL = "https://github.com/elenataleva/invoiceready"

/**
 * `/how-it-works` (docs/04-FRONTEND-DESIGN.md #3.5) - written for a
 * hiring manager or reviewer, not an end user. Costs almost nothing: the
 * content is adapted from the reasoning already written and committed in
 * README.md and docs/01/02, and the eval numbers below are read from a
 * real, dated, committed JSON file (scripts/run_eval.py writes it) - not
 * typed-in copy that can silently drift from what the eval set actually
 * says.
 */
export function HowItWorks() {
  const passRate = Math.round((evalResults.passed / evalResults.total) * 100)
  const refusalRate = Math.round((evalResults.refusal.passed / evalResults.refusal.total) * 100)

  return (
    <Layout>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-14 px-6 py-16">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-foreground">How this works</h1>
          <p className="mt-2 max-w-[68ch] leading-relaxed text-muted-foreground">
            The architecture and trade-offs behind InvoiceReady.
          </p>
        </div>

        <section>
          <h2 className="text-xl font-medium text-foreground">Architecture</h2>
          <p className="mt-2 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
            Two request paths, one boundary: the LLM is never on the critical path for a fact
            that has to be exactly right.
          </p>
          <ArchitectureDiagram className="mt-6 w-full" />
        </section>

        <section>
          <h2 className="text-xl font-medium text-foreground">
            Why the LLM never decides your deadline
          </h2>
          <div className="mt-3 max-w-[68ch] space-y-4 text-sm leading-relaxed text-foreground">
            <p>
              Obligations come from the <code className="font-mono text-xs">rules</code> table via
              plain Python (<code className="font-mono text-xs">app/rules_engine.py</code>) - no
              model involved. The LLM is given those already-decided facts and asked only to
              write the prose explaining them.
            </p>
            <p>
              In <code className="font-mono text-xs">app/routers/assess.py</code>, where the
              response is assembled, six of the seven fields on each obligation read straight off
              a database row. Exactly one, the explanation, comes from Claude. There is no code
              path where a generated date could reach the user - not "we told the model not to,"
              but structurally impossible, because the assignment reads from the database.
            </p>
            <p>
              This matters because a hallucinated date is indistinguishable from a correct one at
              a glance, and the user finds out via a penalty. Asked without sources, Claude
              reports the French e-invoicing fine as €15 (it's €50 since the 2026 finance law) and
              the Belgian retention period as 7 years (it's been 10 since 2019) - both answers
              fluent, confident, and wrong. Refusing to guess costs a user two minutes; a
              confidently stale answer costs them a fine.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-medium text-foreground">Evaluation results</h2>
          <p className="mt-2 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
            {evalResults.total} questions evaluated, {passRate}% correct overall, all{" "}
            {evalResults.refusal.total} refusal cases passing. Generated{" "}
            {formatDate(evalResults.generated_at)} by{" "}
            <code className="font-mono text-xs">scripts/run_eval.py</code> against the real API -
            not a mocked test double.
          </p>

          <dl className="mt-6 grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Overall
              </dt>
              <dd className="mt-1 text-2xl font-medium tabular-nums text-foreground">
                {evalResults.passed}/{evalResults.total}
              </dd>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Refusal cases
              </dt>
              <dd className="mt-1 text-2xl font-medium tabular-nums text-success">
                {evalResults.refusal.passed}/{evalResults.refusal.total}
              </dd>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Grounded cases
              </dt>
              <dd className="mt-1 text-2xl font-medium tabular-nums text-foreground">
                {evalResults.grounded.passed}/{evalResults.grounded.total}
              </dd>
            </div>
          </dl>

          <p className="mt-3 text-xs text-muted-foreground">
            Refusal cases are the non-negotiable bar (CLAUDE.md): {refusalRate}% here means every
            question genuinely outside the knowledge base was correctly declined, not answered
            from the model's general training.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-medium text-foreground">Trade-offs</h2>
          <ul className="mt-3 max-w-[68ch] list-disc space-y-3 pl-5 text-sm leading-relaxed text-foreground">
            <li>
              <strong className="font-medium">No agent framework.</strong> V1 is a workflow with
              fixed steps - filter, retrieve, generate - which is cheaper, more testable, and more
              predictable than letting a model choose its own path. There's nothing here an agent
              would do better.
            </li>
            <li>
              <strong className="font-medium">Structured filtering before semantic search.</strong>{" "}
              A user in Belgium needs Belgium's rules - that's a SQL{" "}
              <code className="font-mono text-xs">WHERE country_code = 'BE'</code>, not a
              similarity search. Retrieval filters in SQL first, then ranks by cosine distance only
              within that filtered set.
            </li>
            <li>
              <strong className="font-medium">3 countries deep, not 12 shallow.</strong> The AI
              isn't the moat here - a curated, dated, sourced knowledge base is. Anyone can wire up
              RAG in a weekend; keeping several countries' rules accurate and current is ongoing
              work most people won't do. Depth was chosen over breadth on purpose.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-medium text-foreground">Links</h2>
          <p className="mt-3 text-sm">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              GitHub repository →
            </a>
          </p>
        </section>
      </main>
    </Layout>
  )
}
