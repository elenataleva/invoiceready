from slowapi import Limiter
from slowapi.util import get_remote_address

# One Limiter instance shared by app.main (registers it + the exception
# handler) and the routers that decorate individual endpoints with it -
# slowapi has no central place to declare per-route limits, so this module
# exists purely to avoid a circular import between main.py and the routers.
limiter = Limiter(key_func=get_remote_address)

# Per docs/04-FRONTEND-DESIGN.md #7.4: the Anthropic budget is exposed to
# the public internet the moment this deploys. Two windows, not one - the
# per-minute limit stops a burst, the per-day limit stops someone patient.
ASK_ASSESS_RATE_LIMIT = "10/minute;100/day"
