from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Rule


def get_applicable_rules(
    db: Session,
    country: str,
    employee_count: int,
    annual_turnover_eur: Decimal | int | None,
    invoices_to: list[str],
) -> list[Rule]:
    """Deterministic rule matching - no LLM involved.

    V1 only defines two segments (see Rule.applies_to_segment): 'all' and
    'turnover_above'. employee_count and invoices_to are accepted now to
    match the /api/assess request shape Task 13 will call this with, but
    are unused until a segment type that depends on them is added.
    """
    rules = db.execute(select(Rule).where(Rule.country_code == country)).scalars().all()

    applicable = []
    for rule in rules:
        if rule.applies_to_segment == "all":  # noqa: SIM114
            applicable.append(rule)
        elif (
            rule.applies_to_segment == "turnover_above"
            and annual_turnover_eur is not None
            and rule.threshold_amount is not None
            and annual_turnover_eur > rule.threshold_amount
        ):
            applicable.append(rule)

    return applicable
