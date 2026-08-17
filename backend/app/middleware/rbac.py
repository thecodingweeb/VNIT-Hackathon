"""
RBAC Middleware — 5-role permission matrix enforcement.

Implements the permission matrix from the spec:
  ADMIN > BIOLOGIST > RANGE_OFFICER > FIELD_STAFF > VIEWER

Usage in routers:
    @router.post("/alerts/config")
    async def update_config(
        user: CurrentUser = Depends(require_permission("alerts", "R/W"))
    ):
        ...
"""

from typing import Callable

from fastapi import Depends, HTTPException, status

from app.middleware.auth import CurrentUser, get_current_user
from app.schemas.user import RoleEnum


# ---------------------------------------------------------------------------
# Permission matrix — directly from the spec's RBAC table
# ---------------------------------------------------------------------------
# Values: "Full", "R/W", "Read", "Limited", "Yes", "Partial", "Rounded", "View", "--" (denied)

PERMISSION_MATRIX: dict[RoleEnum, dict[str, str]] = {
    RoleEnum.ADMIN: {
        "dashboard": "Full",
        "catalogue": "R/W",
        "upload": "Yes",
        "review": "Yes",
        "alerts": "R/W",
        "map": "Yes",
        "settings": "Yes",
        "gps": "Full",
    },
    RoleEnum.BIOLOGIST: {
        "dashboard": "Full",
        "catalogue": "R/W",
        "upload": "Yes",
        "review": "Yes",
        "alerts": "R/W",
        "map": "Yes",
        "settings": "Partial",
        "gps": "Full",
    },
    RoleEnum.RANGE_OFFICER: {
        "dashboard": "Full",
        "catalogue": "Read",
        "upload": "Yes",
        "review": "--",
        "alerts": "R/W",
        "map": "Rounded",
        "settings": "--",
        "gps": "--",
    },
    RoleEnum.FIELD_STAFF: {
        "dashboard": "Limited",
        "catalogue": "--",
        "upload": "Yes",
        "review": "--",
        "alerts": "View",
        "map": "--",
        "settings": "--",
        "gps": "--",
    },
    RoleEnum.VIEWER: {
        "dashboard": "Full",
        "catalogue": "Read",
        "upload": "--",
        "review": "--",
        "alerts": "View",
        "map": "View",
        "settings": "--",
        "gps": "--",
    },
}


# Which permission strings grant read access
_READ_GRANTS = {"Full", "R/W", "Read", "Yes", "Partial", "Limited", "Rounded", "View"}
# Which permission strings grant write access
_WRITE_GRANTS = {"Full", "R/W", "Yes"}


def _check_permission(role: RoleEnum, resource: str, required: str) -> bool:
    """Check if a role has the required permission level on a resource.

    Args:
        role: The user's role.
        resource: e.g. "alerts", "catalogue", "dashboard".
        required: "Read", "R/W", "View", "Yes", "Full", etc.
    """
    role_perms = PERMISSION_MATRIX.get(role, {})
    actual = role_perms.get(resource, "--")

    if actual == "--":
        return False

    # If required is a write-level permission, check write grants
    if required in _WRITE_GRANTS:
        return actual in _WRITE_GRANTS

    # Otherwise read-level access is sufficient
    return actual in _READ_GRANTS


def require_permission(resource: str, level: str = "Read") -> Callable:
    """FastAPI dependency factory for RBAC enforcement.

    Usage:
        @router.get("/catalogue")
        async def list_catalogue(
            user: CurrentUser = Depends(require_permission("catalogue", "Read"))
        ):
            ...

    Returns 403 FORBIDDEN with the standard error shape.
    """

    async def _dependency(
        user: CurrentUser = Depends(get_current_user),
    ) -> CurrentUser:
        if not _check_permission(user.role, resource, level):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "PERMISSION_DENIED",
                    "message": (
                        f"Role '{user.role.value}' does not have "
                        f"'{level}' access to '{resource}'."
                    ),
                },
            )
        return user

    return _dependency


def require_admin() -> Callable:
    """Shortcut: require ADMIN role."""

    async def _dependency(
        user: CurrentUser = Depends(get_current_user),
    ) -> CurrentUser:
        if user.role != RoleEnum.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "ADMIN_REQUIRED",
                    "message": "This action requires ADMIN privileges.",
                },
            )
        return user

    return _dependency


def require_roles(*roles: RoleEnum) -> Callable:
    """Require the user to have one of the specified roles."""

    async def _dependency(
        user: CurrentUser = Depends(get_current_user),
    ) -> CurrentUser:
        if user.role not in roles:
            allowed = ", ".join(r.value for r in roles)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "ROLE_REQUIRED",
                    "message": f"Requires one of: {allowed}. You have: {user.role.value}.",
                },
            )
        return user

    return _dependency
