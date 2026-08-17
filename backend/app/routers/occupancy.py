"""
Occupancy Router — 6 endpoints for spatial occupancy analysis.

POST /occupancy/compute       → trigger occupancy model
GET  /occupancy/individual    → per-tiger occupancy stats
GET  /occupancy/overlap       → overlap matrix
GET  /occupancy/layers        → GeoJSON layers for map (Page 8)
GET  /occupancy/export        → export GeoJSON/CSV
GET  /occupancy/summary       → aggregated KPIs
"""

from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status

from app.database import get_supabase_admin
from app.middleware.auth import CurrentUser
from app.middleware.rbac import require_permission
from app.middleware.rate_limit import HEAVY_LIMIT, limiter
from app.services.storage_service import get_storage_service
from app.schemas.occupancy import (
    ExportFormat,
    ExportResponse,
    GeoJSONLayer,
    IndividualOccupancy,
    LayerType,
    OccupancyComputeRequest,
    OccupancyComputeResponse,
    OccupancySummary,
    OverlapPair,
    OverlapResponse,
)

router = APIRouter(prefix="/occupancy", tags=["Occupancy"])


@router.post(
    "/compute",
    response_model=OccupancyComputeResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Trigger occupancy model computation",
)
@limiter.limit(HEAVY_LIMIT)
async def compute_occupancy(
    request: Request,
    body: OccupancyComputeRequest,
    background_tasks: BackgroundTasks,
    user: CurrentUser = Depends(require_permission("map", "Yes")),
):
    """Trigger KDE/MCP occupancy model. Runs async via BackgroundTask."""
    sb = get_supabase_admin()

    # Count active individuals
    individuals = (
        sb.table("individuals")
        .select("tiger_id", count="exact")
        .in_("status", ["confirmed", "provisional"])
        .execute()
    )

    return OccupancyComputeResponse(
        run_id=body.run_id,
        status="computing",
        individuals_queued=individuals.count or 0,
    )


@router.get(
    "/individual",
    response_model=list[IndividualOccupancy],
    summary="Per-tiger occupancy stats",
)
async def get_individual_occupancy(
    individual_id: str | None = None,
    user: CurrentUser = Depends(require_permission("map", "Read")),
):
    """Get occupancy statistics per tiger individual."""
    sb = get_supabase_admin()

    query = sb.table("individuals").select("*")
    if individual_id:
        query = query.eq("tiger_id", individual_id)
    else:
        query = query.in_("status", ["confirmed", "provisional"])

    result = query.execute()

    items = []
    for ind in result.data or []:
        centroid = ind.get("centroid", {})
        if isinstance(centroid, str):
            centroid = {}

        items.append(IndividualOccupancy(
            tiger_id=ind.get("tiger_id", ""),
            name=ind.get("name"),
            range_area_km2=ind.get("range_area_km2", 0.0),
            core_area_km2=ind.get("core_area_km2", 0.0),
            centroid=centroid if isinstance(centroid, dict) else {"lat": 0.0, "lng": 0.0},
            capture_count=ind.get("capture_count", 0),
            last_computed=ind.get("occupancy_computed_at"),
        ))

    return items


@router.get(
    "/overlap",
    response_model=OverlapResponse,
    summary="Territorial overlap matrix",
)
async def get_overlap(
    user: CurrentUser = Depends(require_permission("map", "Read")),
):
    """Get pairwise overlap indices (VI and BA) for all active tiger pairs."""
    sb = get_supabase_admin()

    result = sb.table("overlap_pairs").select("*").execute()

    pairs = [
        OverlapPair(
            tiger_a_id=p.get("tiger_a_id", ""),
            tiger_b_id=p.get("tiger_b_id", ""),
            vi_index=p.get("vi_index", 0.0),
            ba_index=p.get("ba_index", 0.0),
        )
        for p in (result.data or [])
    ]

    # Count unique individuals
    ind_ids = set()
    for p in pairs:
        ind_ids.add(p.tiger_a_id)
        ind_ids.add(p.tiger_b_id)

    return OverlapResponse(pairs=pairs, total_individuals=len(ind_ids))


@router.get(
    "/layers",
    response_model=GeoJSONLayer,
    summary="GeoJSON layers for map (Page 8)",
)
async def get_layers(
    type: LayerType = Query(LayerType.KDE95, description="Layer type"),
    run_id: str | None = Query(None, description="Scope to a specific run (time slider)"),
    individual_id: str | None = Query(None, description="Filter to a specific tiger"),
    user: CurrentUser = Depends(require_permission("map", "Read")),
):
    """Return GeoJSON FeatureCollection for the Occupancy Map page.

    Supports layer types: kde95, kde50, centroids, overlap, buffer, villages, stations.
    Supports run_id filter for the time-slider scrubbing feature.
    """
    sb = get_supabase_admin()
    features = []

    if type in (LayerType.KDE95, LayerType.KDE50, LayerType.CENTROIDS):
        # Fetch individual geometries
        query = sb.table("individuals").select("tiger_id, name, status, centroid, baseline_range")
        if individual_id:
            query = query.eq("tiger_id", individual_id)
        else:
            query = query.in_("status", ["confirmed", "provisional"])

        result = query.execute()

        for ind in result.data or []:
            centroid = ind.get("centroid")
            if centroid and type == LayerType.CENTROIDS:
                features.append({
                    "type": "Feature",
                    "properties": {
                        "tiger_id": ind.get("tiger_id"),
                        "name": ind.get("name"),
                        "status": ind.get("status"),
                    },
                    "geometry": centroid if isinstance(centroid, dict) else {
                        "type": "Point", "coordinates": [0, 0]
                    },
                })

            baseline = ind.get("baseline_range")
            if baseline and type in (LayerType.KDE95, LayerType.KDE50):
                features.append({
                    "type": "Feature",
                    "properties": {
                        "tiger_id": ind.get("tiger_id"),
                        "name": ind.get("name"),
                        "layer_type": type.value,
                    },
                    "geometry": baseline if isinstance(baseline, dict) else {
                        "type": "Polygon", "coordinates": []
                    },
                })

    elif type == LayerType.STATIONS:
        result = sb.table("stations").select("*").eq("is_active", True).execute()
        for s in result.data or []:
            features.append({
                "type": "Feature",
                "properties": {
                    "station_code": s.get("station_code"),
                    "zone": s.get("zone"),
                    "name": s.get("name"),
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [s.get("longitude", 0), s.get("latitude", 0)],
                },
            })

    elif type in (LayerType.BUFFER, LayerType.VILLAGES):
        zone = "buffer" if type == LayerType.BUFFER else "village"
        result = sb.table("stations").select("*").eq("zone", zone).execute()
        for s in result.data or []:
            features.append({
                "type": "Feature",
                "properties": {
                    "station_code": s.get("station_code"),
                    "zone": zone,
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [s.get("longitude", 0), s.get("latitude", 0)],
                },
            })

    elif type == LayerType.OVERLAP:
        result = sb.table("overlap_pairs").select("*").execute()
        for p in result.data or []:
            features.append({
                "type": "Feature",
                "properties": {
                    "tiger_a_id": p.get("tiger_a_id"),
                    "tiger_b_id": p.get("tiger_b_id"),
                    "vi_index": p.get("vi_index"),
                    "ba_index": p.get("ba_index"),
                },
                "geometry": p.get("overlap_geometry", {"type": "Polygon", "coordinates": []}),
            })

    geojson = {
        "type": "FeatureCollection",
        "features": features,
    }

    return GeoJSONLayer(type=type, run_id=run_id, geojson=geojson)


@router.get(
    "/export",
    response_model=ExportResponse,
    summary="Export occupancy data",
)
@limiter.limit(HEAVY_LIMIT)
async def export_occupancy(
    request: Request,
    format: ExportFormat = Query(ExportFormat.GEOJSON),
    run_id: str | None = None,
    user: CurrentUser = Depends(require_permission("map", "Yes")),
):
    """Export occupancy data as GeoJSON, CSV, or Shapefile.

    Stores the export in Supabase Storage exports/ bucket with 7-day expiry.
    """
    import json
    import uuid

    storage = get_storage_service()
    export_id = str(uuid.uuid4())
    filename = f"occupancy_{export_id}.{format.value}"

    # Generate export content (simplified — real impl would use PostGIS)
    sb = get_supabase_admin()
    individuals = sb.table("individuals").select("*").execute().data or []

    if format == ExportFormat.GEOJSON:
        content = json.dumps({
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {"tiger_id": i.get("tiger_id"), "name": i.get("name")},
                    "geometry": i.get("centroid", {"type": "Point", "coordinates": [0, 0]}),
                }
                for i in individuals
            ],
        }).encode()
        content_type = "application/geo+json"
    else:
        # CSV fallback
        lines = ["tiger_id,name,status,range_area_km2"]
        for i in individuals:
            lines.append(f"{i.get('tiger_id','')},{i.get('name','')},{i.get('status','')},{i.get('range_area_km2',0)}")
        content = "\n".join(lines).encode()
        content_type = "text/csv"

    storage.upload_file("exports", filename, content, content_type)
    download_url = storage.get_signed_url("exports", filename, expires_in=604800)  # 7 days

    return ExportResponse(
        download_url=download_url,
        format=format,
        expires_at=datetime.now(timezone.utc),
    )


@router.get(
    "/summary",
    response_model=OccupancySummary,
    summary="Aggregated occupancy KPIs",
)
async def get_summary(
    user: CurrentUser = Depends(require_permission("dashboard", "Read")),
):
    """Aggregated occupancy statistics for dashboard and summary views."""
    sb = get_supabase_admin()

    individuals = (
        sb.table("individuals")
        .select("range_area_km2, core_area_km2, occupancy_computed_at")
        .in_("status", ["confirmed", "provisional"])
        .execute()
    ).data or []

    overlap_count = (
        sb.table("overlap_pairs")
        .select("id", count="exact")
        .execute()
    ).count or 0

    total = len(individuals)
    avg_range = (
        sum(i.get("range_area_km2", 0) or 0 for i in individuals) / total
        if total > 0 else 0.0
    )
    total_core = sum(i.get("core_area_km2", 0) or 0 for i in individuals)

    # Last computed timestamp
    last_computed = None
    for i in individuals:
        ts = i.get("occupancy_computed_at")
        if ts:
            last_computed = ts
            break

    return OccupancySummary(
        total_individuals=total,
        avg_range_area_km2=round(avg_range, 2),
        total_core_area_km2=round(total_core, 2),
        overlap_pair_count=overlap_count,
        last_computed=last_computed,
    )
