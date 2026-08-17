"""
Stations Router — 5 endpoints + bulk CSV import.

GET    /stations         → list with GeoJSON location
POST   /stations         → create station
GET    /stations/{id}    → station detail + recent captures
PUT    /stations/{id}    → update station config/GPS
DELETE /stations/{id}    → deactivate
POST   /stations/bulk    → bulk CSV import
"""

import csv
import io
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status

from app.database import get_supabase_admin
from app.middleware.auth import CurrentUser
from app.middleware.rbac import require_permission
from app.middleware.audit_log import log_audit_event
from app.schemas.common import PaginatedResponse
from app.schemas.stations import (
    BulkImportResponse,
    StationCreate,
    StationResponse,
    StationUpdate,
    StationZone,
)

router = APIRouter(prefix="/stations", tags=["Stations"])


def _station_to_response(s: dict) -> StationResponse:
    """Convert a raw station record to the response schema."""
    return StationResponse(
        id=s.get("id", ""),
        station_code=s.get("station_code", ""),
        name=s.get("name"),
        zone=s.get("zone", "core"),
        latitude=s.get("latitude", 0.0),
        longitude=s.get("longitude", 0.0),
        location={
            "type": "Point",
            "coordinates": [s.get("longitude", 0), s.get("latitude", 0)],
        },
        elevation_m=s.get("elevation_m"),
        is_active=s.get("is_active", True),
        recent_captures=s.get("recent_captures", 0),
        last_capture_at=s.get("last_capture_at"),
        created_at=s.get("created_at"),
        updated_at=s.get("updated_at"),
    )


@router.get(
    "",
    response_model=PaginatedResponse[StationResponse],
    summary="List all camera stations",
)
async def list_stations(
    page: int = 1,
    page_size: int = 50,
    zone: str | None = Query(None, description="Filter by zone: core, buffer, village"),
    is_active: bool | None = None,
    user: CurrentUser = Depends(require_permission("dashboard", "Read")),
):
    """List all camera trap stations with GeoJSON location for map pins."""
    sb = get_supabase_admin()
    offset = (page - 1) * page_size

    query = sb.table("stations").select("*", count="exact")

    if zone:
        query = query.eq("zone", zone)
    if is_active is not None:
        query = query.eq("is_active", is_active)

    result = (
        query
        .order("station_code", desc=False)
        .range(offset, offset + page_size - 1)
        .execute()
    )

    items = [_station_to_response(s) for s in (result.data or [])]

    return PaginatedResponse(
        items=items, total=result.count or 0, page=page, page_size=page_size,
    )


@router.post(
    "",
    response_model=StationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new camera station",
)
async def create_station(
    request: Request,
    body: StationCreate,
    user: CurrentUser = Depends(require_permission("settings", "Yes")),
):
    """Create a new camera trap station with GPS coordinates."""
    sb = get_supabase_admin()

    # Check for duplicate station_code
    existing = (
        sb.table("stations")
        .select("id")
        .eq("station_code", body.station_code)
        .maybe_single()
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "DUPLICATE_STATION",
                "message": f"Station code '{body.station_code}' already exists.",
                "field_errors": {"station_code": "This station code is already in use."},
            },
        )

    record = {
        "station_code": body.station_code,
        "name": body.name,
        "zone": body.zone.value,
        "latitude": body.latitude,
        "longitude": body.longitude,
        "elevation_m": body.elevation_m,
        "is_active": body.is_active,
        "notes": body.notes,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    result = sb.table("stations").insert(record).execute()

    await log_audit_event(request, "CREATE", "station", after=record)

    if result.data:
        return _station_to_response(result.data[0])
    return _station_to_response(record)


@router.get(
    "/{station_id}",
    response_model=StationResponse,
    summary="Get station detail + recent captures",
)
async def get_station(
    station_id: str,
    user: CurrentUser = Depends(require_permission("dashboard", "Read")),
):
    """Get station details including recent capture count."""
    sb = get_supabase_admin()

    result = (
        sb.table("stations")
        .select("*")
        .eq("id", station_id)
        .maybe_single()
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "STATION_NOT_FOUND", "message": f"Station {station_id} not found."},
        )

    # Count recent captures
    cap_count = (
        sb.table("captures")
        .select("id", count="exact")
        .eq("station_id", station_id)
        .execute()
    ).count or 0

    last_cap = (
        sb.table("captures")
        .select("captured_at")
        .eq("station_id", station_id)
        .order("captured_at", desc=True)
        .limit(1)
        .execute()
    ).data

    station = result.data
    station["recent_captures"] = cap_count
    station["last_capture_at"] = last_cap[0].get("captured_at") if last_cap else None

    return _station_to_response(station)


@router.put(
    "/{station_id}",
    response_model=StationResponse,
    summary="Update station config/GPS",
)
async def update_station(
    request: Request,
    station_id: str,
    body: StationUpdate,
    user: CurrentUser = Depends(require_permission("settings", "Yes")),
):
    """Update station configuration or GPS coordinates."""
    sb = get_supabase_admin()

    before = sb.table("stations").select("*").eq("id", station_id).maybe_single().execute()
    if not before.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "STATION_NOT_FOUND", "message": f"Station {station_id} not found."},
        )

    update_data = body.model_dump(exclude_none=True)
    if "zone" in update_data:
        update_data["zone"] = update_data["zone"].value
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    sb.table("stations").update(update_data).eq("id", station_id).execute()

    await log_audit_event(
        request, "UPDATE", "station", station_id,
        before=before.data, after=update_data,
    )

    updated = sb.table("stations").select("*").eq("id", station_id).maybe_single().execute()
    return _station_to_response(updated.data)


@router.delete(
    "/{station_id}",
    status_code=status.HTTP_200_OK,
    summary="Deactivate a station",
)
async def deactivate_station(
    request: Request,
    station_id: str,
    user: CurrentUser = Depends(require_permission("settings", "Yes")),
):
    """Soft-deactivate a station (set is_active=false)."""
    sb = get_supabase_admin()

    before = sb.table("stations").select("*").eq("id", station_id).maybe_single().execute()
    if not before.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "STATION_NOT_FOUND", "message": f"Station {station_id} not found."},
        )

    sb.table("stations").update({"is_active": False}).eq("id", station_id).execute()

    await log_audit_event(request, "DEACTIVATE", "station", station_id)

    return {"message": f"Station {station_id} deactivated."}


@router.post(
    "/bulk",
    response_model=BulkImportResponse,
    summary="Bulk CSV import of stations",
)
async def bulk_import(
    request: Request,
    file: UploadFile = File(..., description="CSV file with station data"),
    user: CurrentUser = Depends(require_permission("settings", "Yes")),
):
    """Parse a CSV file and batch-insert camera trap stations.

    Expected CSV columns: station_code, name, zone, latitude, longitude, elevation_m
    """
    content = await file.read()
    text = content.decode("utf-8-sig")  # Handle BOM
    reader = csv.DictReader(io.StringIO(text))

    sb = get_supabase_admin()
    imported = 0
    skipped = 0
    errors = []

    for idx, row in enumerate(reader, start=2):  # Row 1 is header
        try:
            station_code = row.get("station_code", "").strip()
            if not station_code:
                errors.append({"row": str(idx), "error": "Missing station_code"})
                skipped += 1
                continue

            # Check for duplicate
            existing = (
                sb.table("stations")
                .select("id")
                .eq("station_code", station_code)
                .maybe_single()
                .execute()
            )
            if existing.data:
                skipped += 1
                continue

            zone = row.get("zone", "core").strip().lower()
            if zone not in ("core", "buffer", "village"):
                zone = "core"

            record = {
                "station_code": station_code,
                "name": row.get("name", "").strip() or None,
                "zone": zone,
                "latitude": float(row.get("latitude", 0)),
                "longitude": float(row.get("longitude", 0)),
                "elevation_m": float(row["elevation_m"]) if row.get("elevation_m") else None,
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            sb.table("stations").insert(record).execute()
            imported += 1

        except Exception as e:
            errors.append({"row": str(idx), "error": str(e)})
            skipped += 1

    await log_audit_event(
        request, "BULK_IMPORT", "station",
        notes=f"Imported {imported}, skipped {skipped}",
    )

    return BulkImportResponse(imported=imported, skipped=skipped, errors=errors[:20])
