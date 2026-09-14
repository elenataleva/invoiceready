import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { profileStepSchema, type ProfileStepValues } from "@/features/intake/schema"
import {
  EMPLOYEE_BAND_LABELS,
  EMPLOYEE_BANDS,
  TURNOVER_BAND_LABELS,
  TURNOVER_BANDS,
} from "@/features/intake/types"

interface ProfileStepProps {
  defaultValues?: Partial<ProfileStepValues>
  onNext: (values: ProfileStepValues) => void
  onBack: () => void
}

export function ProfileStep({ defaultValues, onNext, onBack }: ProfileStepProps) {
  const form = useForm<ProfileStepValues>({
    resolver: zodResolver(profileStepSchema),
    defaultValues,
  })

  return (
    <form onSubmit={form.handleSubmit(onNext)} className="space-y-6" noValidate>
      <div>
        <h2 className="text-xl font-medium text-foreground">Are you VAT-registered, and how big is your business?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Bands, not exact figures - the rules only care which side of a threshold you're on.
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">VAT-registered?</legend>
        <RadioGroup
          value={form.watch("vatRegistered")}
          onValueChange={(value) =>
            form.setValue("vatRegistered", value as "yes" | "no", { shouldValidate: true })
          }
          className="flex gap-4"
        >
          {(["yes", "no"] as const).map((value) => (
            <Label
              key={value}
              htmlFor={`vat-${value}`}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-4 py-2 font-normal has-[[data-checked]]:border-primary has-[[data-checked]]:ring-1 has-[[data-checked]]:ring-primary"
            >
              <RadioGroupItem id={`vat-${value}`} value={value} />
              {value === "yes" ? "Yes" : "No"}
            </Label>
          ))}
        </RadioGroup>
        {form.formState.errors.vatRegistered && (
          <p role="alert" className="text-sm text-danger">
            {form.formState.errors.vatRegistered.message}
          </p>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">Employees</legend>
        <RadioGroup
          value={form.watch("employeeBand")}
          onValueChange={(value) =>
            form.setValue("employeeBand", value as ProfileStepValues["employeeBand"], {
              shouldValidate: true,
            })
          }
        >
          {EMPLOYEE_BANDS.map((band) => (
            <Label
              key={band}
              htmlFor={`emp-${band}`}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-4 py-2 font-normal has-[[data-checked]]:border-primary has-[[data-checked]]:ring-1 has-[[data-checked]]:ring-primary"
            >
              <RadioGroupItem id={`emp-${band}`} value={band} />
              {EMPLOYEE_BAND_LABELS[band]}
            </Label>
          ))}
        </RadioGroup>
        {form.formState.errors.employeeBand && (
          <p role="alert" className="text-sm text-danger">
            {form.formState.errors.employeeBand.message}
          </p>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">Annual turnover</legend>
        <RadioGroup
          value={form.watch("turnoverBand")}
          onValueChange={(value) =>
            form.setValue("turnoverBand", value as ProfileStepValues["turnoverBand"], {
              shouldValidate: true,
            })
          }
        >
          {TURNOVER_BANDS.map((band) => (
            <Label
              key={band}
              htmlFor={`turnover-${band}`}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-4 py-2 font-normal has-[[data-checked]]:border-primary has-[[data-checked]]:ring-1 has-[[data-checked]]:ring-primary"
            >
              <RadioGroupItem id={`turnover-${band}`} value={band} />
              {TURNOVER_BAND_LABELS[band]}
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
