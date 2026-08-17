"""
Audit Log Middleware — immutable trail of all mutations.

Logs all POST/PUT/DELETE requests to the `audit_log` Supabase table
with user ID, action, resource type, timestamp, and IP address.
"""

import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import Request

from app.database import get_supabase_admin


async def log_audit_event(
    request: Request,
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    before: Optional[dict] = None,
    after: Optional[dict] = None,
    notes: Optional[str] = None,
) -> None:
    """Write an audit log entry to Supabase.

    Called explicitly in route handlers after mutations.
    Uses the admin client to bypass RLS on audit_log table.
    """
    user = getattr(request.state, "current_user", None)
    user_id = user.id if user else None

    # Build the record
    record = {
        "user_id": user_id,
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "before": json.dumps(before) if before else None,
        "after": json.dumps(after) if after else None,
        "ip_address": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent", ""),
        "notes": notes,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        sb = get_supabase_admin()
        sb.table("audit_log").insert(record).execute()
    except Exception:
        # Audit logging should never crash the request
        pass
