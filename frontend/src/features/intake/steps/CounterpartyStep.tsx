import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { counterpartyStepSchema, type CounterpartyStepValues } from "@/features/intake/schema"
import { COUNTERPARTIES, COUNTERPARTY_LABELS } from "@/features/intake/types"

interface CounterpartyStepProps {
  defaultValues?: Partial<CounterpartyStepValues>
  onNext: (values: CounterpartyStepValues) => void
  onBack: () => void
}

export function CounterpartyStep({ defaultValues, onNext, onBack }: CounterpartyStepProps) {
  const form = useForm<CounterpartyStepValues>({
    resolver: zodResolver(counterpartyStepSchema),
    defaultValues: { invoicesTo: defaultValues?.invoicesTo ?? [] },
  })

  const selected = form.watch("invoicesTo")

  function toggle(value: (typeof COUNTERPARTIES)[number], checked: boolean) {
    const next = checked ? [...selected, value] : selected.filter((item) => item !== value)
    form.setValue("invoicesTo", next, { shouldValidate: true })
  }

  return (
    <form onSubmit={form.handleSubmit(onNext)} className="space-y-6" noValidate>
      <div>
        <h2 className="text-xl font-medium text-foreground">Who do you invoice?</h2>
        <p className="mt-1 text-sm text-muted-foreground">Select every kind of customer that applies.</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="sr-only">Who do you invoice?</legend>
        {COUNTERPARTIES.map((counterparty) => (
          <Label
            key={counterparty}
            htmlFor={`to-${counterparty}`}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-4 py-3 font-normal has-[[data-checked]]:border-primary has-[[data-checked]]:ring-1 has-[[data-checked]]:ring-primary"
          >
            <Checkbox
              id={`to-${counterparty}`}
              checked={selected.includes(counterparty)}
              onCheckedChange={(checked) => toggle(counterparty, checked === true)}
            />
            {COUNTERPARTY_LABELS[counterparty]}
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
        <Button type="submit">Continue</Button>
      </div>
    </form>
  )
}
