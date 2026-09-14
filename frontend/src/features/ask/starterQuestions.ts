/**
 * Three suggested starter questions per country (docs/04-FRONTEND-DESIGN.md
 * #3.4), "so the user doesn't face an empty box." Pulled verbatim from
 * real, currently-passing grounded cases in tests/eval_set.yaml - not
 * invented copy. There's no API for this (the eval set is a backend test
 * fixture, not a served resource), so this is a static, duplicated
 * snapshot: if eval_set.yaml's BE/FR/PL cases change meaningfully, these
 * can drift and should be re-checked against it.
 */
export const STARTER_QUESTIONS: Record<string, string[]> = {
  BE: [
    "What invoice format do I need to use in Belgium?",
    "When does the Belgian e-invoicing mandate start?",
    "What's the fine if I can't send structured e-invoices in Belgium?",
  ],
  PL: [
    "What invoice format do I need to use in Poland?",
    "When do small businesses in Poland have to start issuing invoices through KSeF?",
    "What are the penalties for not using KSeF in Poland?",
  ],
  FR: [
    "What invoice format do I need to use in France?",
    "When must French SMEs start issuing electronic invoices?",
    "How long must I keep electronic invoices in France?",
  ],
}
