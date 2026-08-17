"""
Users Router — 5 endpoints for user management.

GET    /users        → list all users (ADMIN only)
POST   /users        → create user + assign role
GET    /users/{id}   → get user profile
PUT    /users/{id}   → update user
DELETE /users/{id}   → soft disable (is_active=false)
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.database import get_supabase, get_supabase_admin
from app.middleware.auth import CurrentUser, get_current_user
from app.middleware.rbac import require_admin, require_permission
from app.middleware.audit_log import log_audit_event
from app.schemas.common import PaginatedResponse
from app.schemas.user import RoleEnum, UserCreate, UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["Users"])


@router.get(
    "",
    response_model=PaginatedResponse[UserResponse],
    summary="List all users (ADMIN only)",
)
async def list_users(
    request: Request,
    page: int = 1,
    page_size: int = 20,
    role: str | None = None,
    user: CurrentUser = Depends(require_admin()),
):
    """List all system users. Restricted to ADMIN role."""
    sb = get_supabase_admin()
    query = sb.table("users").select("*", count="exact")

    if role:
        query = query.eq("role", role)

    offset = (page - 1) * page_size
    result = query.range(offset, offset + page_size - 1).execute()

    return PaginatedResponse(
        items=[UserResponse(**u) for u in (result.data or [])],
        total=result.count or 0,
        page=page,
        page_size=page_size,
    )


@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user",
)
async def create_user(
    request: Request,
    body: UserCreate,
    user: CurrentUser = Depends(require_admin()),
):
    """Create a new user in Supabase Auth + users table."""
    sb_admin = get_supabase_admin()

    # Create auth user in Supabase
    try:
        auth_result = sb_admin.auth.admin.create_user({
            "email": body.email,
            "password": body.password,
            "email_confirm": True,
        })
        auth_user = auth_result.user
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "USER_CREATE_FAILED",
                "message": f"Failed to create auth user: {str(e)}",
            },
        )

    # Create record in users table
    user_record = {
        "id": auth_user.id,
        "email": body.email,
        "full_name": body.full_name,
        "role": body.role.value,
        "is_active": True,
    }
    sb_admin.table("users").insert(user_record).execute()

    await log_audit_event(
        request, "CREATE", "user", auth_user.id, after=user_record
    )

    return UserResponse(**user_record)


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Get user profile",
)
async def get_user(
    request: Request,
    user_id: str,
    current: CurrentUser = Depends(get_current_user),
):
    """Get a user profile. Users can view their own profile; ADMIN can view any."""
    if current.id != user_id and current.role != RoleEnum.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "PERMISSION_DENIED",
                "message": "You can only view your own profile.",
            },
        )

    sb = get_supabase_admin()
    result = sb.table("users").select("*").eq("id", user_id).maybe_single().execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "USER_NOT_FOUND",
                "message": f"User {user_id} not found.",
            },
        )

    return UserResponse(**result.data)


@router.put(
    "/{user_id}",
    response_model=UserResponse,
    summary="Update a user",
)
async def update_user(
    request: Request,
    user_id: str,
    body: UserUpdate,
    current: CurrentUser = Depends(get_current_user),
):
    """Update user profile. Users can update their own name; ADMIN can update anything."""
    # Non-admins can only update their own non-role fields
    if current.role != RoleEnum.ADMIN:
        if current.id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "PERMISSION_DENIED", "message": "Cannot update other users."},
            )
        if body.role is not None or body.is_active is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "PERMISSION_DENIED", "message": "Only ADMIN can change role or active status."},
            )

    sb = get_supabase_admin()

    # Get before state for audit
    before = sb.table("users").select("*").eq("id", user_id).maybe_single().execute()
    if not before.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "USER_NOT_FOUND", "message": f"User {user_id} not found."},
        )

    update_data = body.model_dump(exclude_none=True)
    if "role" in update_data:
        update_data["role"] = update_data["role"].value

    result = sb.table("users").update(update_data).eq("id", user_id).execute()

    await log_audit_event(
        request, "UPDATE", "user", user_id,
        before=before.data, after=update_data,
    )

    updated = sb.table("users").select("*").eq("id", user_id).maybe_single().execute()
    return UserResponse(**updated.data)


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_200_OK,
    summary="Disable a user (soft delete)",
)
async def disable_user(
    request: Request,
    user_id: str,
    user: CurrentUser = Depends(require_admin()),
):
    """Soft-disable a user by setting is_active=false."""
    sb = get_supabase_admin()

    before = sb.table("users").select("*").eq("id", user_id).maybe_single().execute()
    if not before.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "USER_NOT_FOUND", "message": f"User {user_id} not found."},
        )

    sb.table("users").update({"is_active": False}).eq("id", user_id).execute()

    await log_audit_event(
        request, "DISABLE", "user", user_id, before=before.data,
    )

    return {"message": f"User {user_id} has been disabled."}
