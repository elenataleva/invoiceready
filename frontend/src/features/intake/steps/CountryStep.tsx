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
  onNext: (values: CountryStepValues) => void
}

export function CountryStep({ defaultValue, onNext }: CountryStepProps) {
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
        <h2 className="text-xl font-medium text-foreground">
          Where is your business registered?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Three questions. A plain-language answer, with the official source for every claim.
        </p>
      </div>

      {countries === null ? (
        <div className="space-y-2" aria-hidden="true">
          <Skeleton w="100%" h="3.25rem" className="block" />
          <Skeleton w="100%" h="3.25rem" className="block" />
          <Skeleton w="100%" h="3.25rem" className="block" />
        </div>
      ) : (
        <RadioGroup
          value={selected}
          onValueChange={(value) => form.setValue("country", value, { shouldValidate: true })}
        >
          {countries.map((country) => (
            <Label
              key={country.code}
              htmlFor={`country-${country.code}`}
              className="flex cursor-pointer items-center justify-between rounded-lg border border-border px-4 py-3 font-normal has-[[data-checked]]:border-primary has-[[data-checked]]:ring-1 has-[[data-checked]]:ring-primary"
            >
              <span className="flex items-center gap-2">
                <RadioGroupItem id={`country-${country.code}`} value={country.code} />
                {country.name}
                <span className="text-muted-foreground">{country.code}</span>
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
