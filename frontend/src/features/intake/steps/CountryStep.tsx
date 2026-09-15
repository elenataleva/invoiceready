import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"

import { useDataSource } from "@/api"
import type { Country } from "@/api/client"
import { CoverageIndicator, Skeleton } from "@/components/trust"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { countryStepSchema, type CountryStepValues } from "@/features/intake/schema"

interface CountryStepProps {
  defaultValue?: string
  /** Fires on selection, not on submit - the preview panel reads shared intake state and must react to the click (#3.2/#5.1). */
  onSelect: (values: Partial<CountryStepValues>) => void
  onNext: (values: CountryStepValues) => void
}

export function CountryStep({ defaultValue, onSelect, onNext }: CountryStepProps) {
  const ds = useDataSource()
  const [countries, setCountries] = useState<Country[] | null>(null)

  useEffect(() => {
    // ds's identity changes when the live/demo toggle flips (@/api's
    // useDataSource), so resetting to null here re-shows the skeleton
    // for the moment it takes to refetch under the new mode - correct
    // behaviour, not a bug the reset-in-effect pattern usually warns about.
    let cancelled = false
    setCountries(null)
    ds.countries().then((result) => {
      if (!cancelled) setCountries(result)
    })
    return () => {
      cancelled = true
    }
  }, [ds])

  const form = useForm<CountryStepValues>({
    resolver: zodResolver(countryStepSchema),
    defaultValues: { country: defaultValue ?? "" },
  })

  const selected = form.watch("country")

  return (
    <form onSubmit={form.handleSubmit(onNext)} className="space-y-6" noValidate>
      <div>
        <h2 className="text-3xl leading-tight font-semibold text-foreground">
          Where is your business registered?
        </h2>
        <p className="mt-2.5 max-w-[46ch] text-muted-foreground">
          Three questions, then a plain-language answer with the official source behind every
          claim.
        </p>
      </div>

      {countries === null ? (
        <div className="grid gap-2.5" aria-hidden="true">
          <Skeleton w="100%" h="4rem" className="block" />
          <Skeleton w="100%" h="4rem" className="block" />
          <Skeleton w="100%" h="4rem" className="block" />
        </div>
      ) : (
        <RadioGroup
          value={selected}
          onValueChange={(value) => {
            form.setValue("country", value, { shouldValidate: true })
            onSelect({ country: value })
          }}
          className="gap-2.5"
        >
          {countries.map((country) => (
            <Label
              key={country.code}
              htmlFor={`country-${country.code}`}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3.5 font-normal transition-colors hover:border-border/80 has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary/8"
            >
              <span className="flex items-center gap-3">
                <RadioGroupItem id={`country-${country.code}`} value={country.code} />
                <span>
                  <span className="font-medium text-foreground">{country.name}</span>{" "}
                  <span className="font-mono text-xs text-muted-foreground">{country.code}</span>
                </span>
              </span>
              <CoverageIndicator status={country.status} />
            </Label>
          ))}
        </RadioGroup>
      )}

      {form.formState.errors.country && (
        <p role="alert" className="text-sm text-danger">
          {form.formState.errors.country.message}
        </p>
      )}

      <Button type="submit" disabled={countries === null}>
        Continue
      </Button>
    </form>
  )
}
