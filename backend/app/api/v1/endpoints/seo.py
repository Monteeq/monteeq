from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.session import get_db
from app.core import config, storage
import xml.etree.ElementTree as ET
from datetime import datetime

router = APIRouter()

BASE_URL = config.FRONTEND_URL.rstrip('/')


def _resolve_url(url):
    """Inline CDN resolver — avoids loading the full Video ORM (which may have columns not yet migrated)."""
    if not url:
        return url
    if "amazonaws.com" in url or "monteeq.s3" in url or "cdn.monteeq.com" in url:
        if ".com/" in url:
            parts = url.split(".com/")
            if len(parts) > 1:
                return storage.get_url(parts[1])
    return url


_VIDEOS_SQL = text("""
    SELECT id, title, description, video_url, thumbnail_url, tags,
           duration, created_at, owner_id, status
    FROM videos
    WHERE status = :status
""")


@router.get("/sitemap.xml")
async def get_sitemap(db: Session = Depends(get_db)):
    """Generates a standard XML sitemap for general pages + video watch pages."""
    urlset = ET.Element("urlset", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")

    # Static Public Pages
    pages = [
        {"path": "", "priority": "1.0"},
        {"path": "/home", "priority": "0.9"},
        {"path": "/flash", "priority": "0.9"},
        {"path": "/challenges", "priority": "0.8"},
        {"path": "/about", "priority": "0.7"},
        {"path": "/partner", "priority": "0.7"},
        {"path": "/privacy", "priority": "0.5"},
        {"path": "/terms", "priority": "0.5"},
    ]
    for page in pages:
        url_el = ET.SubElement(urlset, "url")
        ET.SubElement(url_el, "loc").text = f"{BASE_URL}{page['path']}"
        ET.SubElement(url_el, "changefreq").text = "daily"
        ET.SubElement(url_el, "priority").text = page["priority"]

    # Dynamic Video Pages — raw SQL to avoid ORM column-mismatch crashes
    rows = db.execute(_VIDEOS_SQL, {"status": "approved"}).fetchall()
    for row in rows:
        if not row.created_at:
            continue
        url_el = ET.SubElement(urlset, "url")
        ET.SubElement(url_el, "loc").text = f"{BASE_URL}/watch/{row.id}"
        ET.SubElement(url_el, "lastmod").text = row.created_at.strftime("%Y-%m-%d")
        ET.SubElement(url_el, "changefreq").text = "weekly"
        ET.SubElement(url_el, "priority").text = "0.6"

    xml_data = b'<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(urlset, encoding="utf-8", method="xml")
    return Response(content=xml_data, media_type="application/xml")


@router.get("/video-sitemap.xml")
async def get_video_sitemap(db: Session = Depends(get_db)):
    """Generates a Google Video Sitemap for video indexing."""
    urlset = ET.Element("urlset", {
        "xmlns": "http://www.sitemaps.org/schemas/sitemap/0.9",
        "xmlns:video": "http://www.google.com/schemas/sitemap-video/1.1",
    })
    video_ns = "{http://www.google.com/schemas/sitemap-video/1.1}"

    rows = db.execute(_VIDEOS_SQL, {"status": "approved"}).fetchall()

    for row in rows:
        if not row.created_at or not row.video_url:
            continue

        thumbnail = _resolve_url(row.thumbnail_url) if row.thumbnail_url else ""
        if not thumbnail:
            continue

        url_el = ET.SubElement(urlset, "url")
        ET.SubElement(url_el, "loc").text = f"{BASE_URL}/watch/{row.id}"

        video_el = ET.SubElement(url_el, f"{video_ns}video")
        ET.SubElement(video_el, f"{video_ns}thumbnail_loc").text = thumbnail
        ET.SubElement(video_el, f"{video_ns}title").text = row.title or ""
        ET.SubElement(video_el, f"{video_ns}description").text = (
            row.description or f"Watch {row.title} on Monteeq."
        )
        # player_loc: Google crawls this page which embeds the HLS player
        ET.SubElement(video_el, f"{video_ns}player_loc").text = f"{BASE_URL}/watch/{row.id}"

        # Duration — Google requires HH:MM:SS
        dur = int(row.duration or 0)
        hours, remainder = divmod(dur, 3600)
        minutes, seconds = divmod(remainder, 60)
        ET.SubElement(video_el, f"{video_ns}duration").text = f"{hours:02d}:{minutes:02d}:{seconds:02d}"

        pub_date = row.created_at.strftime("%Y-%m-%d")
        ET.SubElement(video_el, f"{video_ns}publication_date").text = pub_date

        # Tags (comma-separated in DB)
        if row.tags:
            for tag in [t.strip() for t in row.tags.split(",") if t.strip()][:32]:
                ET.SubElement(video_el, f"{video_ns}tag").text = tag

    xml_data = b'<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(urlset, encoding="utf-8", method="xml")
    return Response(content=xml_data, media_type="application/xml")
