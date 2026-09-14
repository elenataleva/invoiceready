import { z } from "zod"

import { COUNTERPARTIES, EMPLOYEE_BANDS, TURNOVER_BANDS } from "@/features/intake/types"

// One schema per wizard step (docs/04-FRONTEND-DESIGN.md #5.1) - each
// validates only the fields that step collects, so a step can be marked
// valid/invalid independently of the others.

export const countryStepSchema = z.object({
  country: z.string().length(2, "Choose a country"),
})
export type CountryStepValues = z.infer<typeof countryStepSchema>

export const profileStepSchema = z.object({
  vatRegistered: z.enum(["yes", "no"], { message: "Choose one" }),
  employeeBand: z.enum(EMPLOYEE_BANDS, { message: "Choose a band" }),
  turnoverBand: z.enum(TURNOVER_BANDS, { message: "Choose a band" }),
})
export type ProfileStepValues = z.infer<typeof profileStepSchema>

export const counterpartyStepSchema = z.object({
  invoicesTo: z.array(z.enum(COUNTERPARTIES)).min(1, "Choose at least one"),
})
export type CounterpartyStepValues = z.infer<typeof counterpartyStepSchema>

// The completed profile, same shape as IntakeState once every step has
// passed - used once, to validate the object right before it's handed to
// toAssessRequest(), as a final guard rather than a fourth form.
export const intakeSchema = countryStepSchema
  .extend({ vatRegistered: z.boolean() })
  .extend(profileStepSchema.omit({ vatRegistered: true }).shape)
  .extend(counterpartyStepSchema.shape)
