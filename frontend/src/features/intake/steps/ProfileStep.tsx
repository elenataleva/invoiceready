import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { profileStepSchema, type ProfileStepValues } from "@/features/intake/schema"
import {
  EMPLOYEE_BAND_HINTS,
  EMPLOYEE_BAND_LABELS,
  EMPLOYEE_BANDS,
  TURNOVER_BAND_LABELS,
  TURNOVER_BANDS,
} from "@/features/intake/types"
import { cn } from "@/lib/utils"

interface ProfileStepProps {
  defaultValues?: Partial<ProfileStepValues>
  onNext: (values: ProfileStepValues) => void
  onBack: () => void
}

const OPTION =
  "flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 font-normal transition-colors hover:border-border/80 has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary/8"

export function ProfileStep({ defaultValues, onNext, onBack }: ProfileStepProps) {
  const form = useForm<ProfileStepValues>({
    resolver: zodResolver(profileStepSchema),
    defaultValues,
  })

  return (
    <form onSubmit={form.handleSubmit(onNext)} className="space-y-7" noValidate>
      <div>
        <h2 className="text-3xl leading-tight font-semibold text-foreground">
          How big is your business?
        </h2>
        <p className="mt-2.5 max-w-[46ch] text-muted-foreground">
          Bands, not exact figures - the rules only care which side of a threshold you sit on.
        </p>
      </div>

      <fieldset className="grid gap-2.5">
        <legend className="mb-1 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          Registered for VAT?
        </legend>
        <RadioGroup
          value={form.watch("vatRegistered")}
          onValueChange={(value) =>
            form.setValue("vatRegistered", value as "yes" | "no", { shouldValidate: true })
          }
          className="flex gap-2.5"
        >
          {(["yes", "no"] as const).map((value) => (
            <Label key={value} htmlFor={`vat-${value}`} className={cn(OPTION, "flex-1")}>
              <RadioGroupItem id={`vat-${value}`} value={value} />
              <span className="font-medium text-foreground">{value === "yes" ? "Yes" : "No"}</span>
            </Label>
          ))}
        </RadioGroup>
        {form.formState.errors.vatRegistered && (
          <p role="alert" className="text-sm text-danger">
            {form.formState.errors.vatRegistered.message}
          </p>
        )}
      </fieldset>

      <fieldset className="grid gap-2.5">
        <legend className="mb-1 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          People working there
        </legend>
        <RadioGroup
          value={form.watch("employeeBand")}
          onValueChange={(value) =>
            form.setValue("employeeBand", value as ProfileStepValues["employeeBand"], {
              shouldValidate: true,
            })
          }
        >
          {EMPLOYEE_BANDS.map((band) => (
            <Label key={band} htmlFor={`emp-${band}`} className={OPTION}>
              <RadioGroupItem id={`emp-${band}`} value={band} />
              <span>
                <span className="block font-medium text-foreground">
                  {EMPLOYEE_BAND_LABELS[band]}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {EMPLOYEE_BAND_HINTS[band]}
                </span>
              </span>
            </Label>
          ))}
        </RadioGroup>
        {form.formState.errors.employeeBand && (
          <p role="alert" className="text-sm text-danger">
            {form.formState.errors.employeeBand.message}
          </p>
        )}
      </fieldset>

      <fieldset className="grid gap-2.5">
        <legend className="mb-1 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          Yearly turnover
        </legend>
        <RadioGroup
          value={form.watch("turnoverBand")}
          onValueChange={(value) =>
            form.setValue("turnoverBand", value as ProfileStepValues["turnoverBand"], {
              shouldValidate: true,
            })
          }
        >
          {TURNOVER_BANDS.map((band) => (
            <Label key={band} htmlFor={`turnover-${band}`} className={OPTION}>
              <RadioGroupItem id={`turnover-${band}`} value={band} />
              <span className="font-medium tabular-nums text-foreground">
                {TURNOVER_BAND_LABELS[band]}
              </span>
            </Label>
          ))}
        </RadioGroup>
        {form.formState.errors.turnoverBand && (
          <p role="alert" className="text-sm text-danger">
            {form.formState.errors.turnoverBand.message}
          </p>
        )}
      </fieldset>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="submit">Continue</Button>
      </div>
    </form>
  )
}
