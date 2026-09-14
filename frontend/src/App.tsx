import { Button } from "@/components/ui/button"

// Scaffold placeholder proving Vite + Tailwind v4 + shadcn/ui + the
// docs/04-FRONTEND-DESIGN.md #4.1 design tokens are wired together, incl.
// dark mode. Replaced by real routes once React Router lands (build-order
// step 5+) - this file is not a page.
function App() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-medium tracking-tight text-foreground">InvoiceReady</h1>
      <p className="mt-2 max-w-[68ch] leading-relaxed text-muted-foreground">
        Frontend scaffold - Vite, TypeScript, Tailwind v4, shadcn/ui, design tokens from{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
          docs/04-FRONTEND-DESIGN.md #4.1
        </code>
        .
      </p>

      <div className="mt-6 flex gap-3">
        <Button>Primary action</Button>
        <Button variant="outline">Secondary action</Button>
      </div>

      <div className="mt-8 flex gap-4 text-sm">
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-success" /> success
        </span>
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-warning" /> warning
        </span>
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-danger" /> danger
        </span>
      </div>

      <p className="mt-10 border-t border-border pt-4 text-sm text-muted-foreground">
        Informational guidance only, not tax or legal advice.
      </p>
    </main>
  )
}

export default App
