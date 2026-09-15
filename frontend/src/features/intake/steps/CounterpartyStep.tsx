import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { counterpartyStepSchema, type CounterpartyStepValues } from "@/features/intake/schema"
import { COUNTERPARTIES, COUNTERPARTY_HINTS, COUNTERPARTY_LABELS } from "@/features/intake/types"

interface CounterpartyStepProps {
  defaultValues?: Partial<CounterpartyStepValues>
  /** Fires per answer, not on submit - see CountryStep's note. */
  onSelect: (values: Partial<CounterpartyStepValues>) => void
  onNext: (values: CounterpartyStepValues) => void
  onBack: () => void
}

export function CounterpartyStep({
  defaultValues,
  onSelect,
  onNext,
  onBack,
}: CounterpartyStepProps) {
  const form = useForm<CounterpartyStepValues>({
    resolver: zodResolver(counterpartyStepSchema),
    defaultValues: { invoicesTo: defaultValues?.invoicesTo ?? [] },
  })

  const selected = form.watch("invoicesTo")

  function toggle(value: (typeof COUNTERPARTIES)[number], checked: boolean) {
    const next = checked ? [...selected, value] : selected.filter((item) => item !== value)
    form.setValue("invoicesTo", next, { shouldValidate: true })
    onSelect({ invoicesTo: next })
  }

  return (
    <form onSubmit={form.handleSubmit(onNext)} className="space-y-6" noValidate>
      <div>
        <h2 className="text-3xl leading-tight font-semibold text-foreground">
          Who do you send invoices to?
        </h2>
        <p className="mt-2.5 max-w-[46ch] text-muted-foreground">
          Choose everyone you bill. Most mandates apply to business customers first.
        </p>
      </div>

      <fieldset className="grid gap-2.5">
        <legend className="sr-only">Who do you send invoices to?</legend>
        {COUNTERPARTIES.map((counterparty) => (
          <Label
            key={counterparty}
            htmlFor={`to-${counterparty}`}
            className="flex cursor-pointer items-center gap-3.5 rounded-xl border border-border bg-card px-4 py-3.5 font-normal transition-colors hover:border-border/80 has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary/8"
          >
            <Checkbox
              id={`to-${counterparty}`}
              checked={selected.includes(counterparty)}
              onCheckedChange={(value) => toggle(counterparty, value === true)}
            />
            <span>
              <span className="block font-medium text-foreground">
                {COUNTERPARTY_LABELS[counterparty]}
              </span>
              <span className="block text-sm text-muted-foreground">
                {COUNTERPARTY_HINTS[counterparty]}
              </span>
            </span>
          </Label>
        ))}
      </fieldset>
      {form.formState.errors.invoicesTo && (
        <p role="alert" className="text-sm text-danger">
          {form.formState.errors.invoicesTo.message}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="submit">See my obligations</Button>
      </div>
    </form>
  )
}
