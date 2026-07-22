from fastapi import APIRouter, Depends, Response
from sqlalchemy import text
from app.db.session import get_db
from app.core import config
from app.core.storage import storage
import xml.etree.ElementTree as ET

router = APIRouter()

BASE_URL = config.FRONTEND_URL.rstrip('/')

# Register namespace prefixes so ET serialises them correctly
_NS_SITEMAP = 'http://www.sitemaps.org/schemas/sitemap/0.9'
_NS_VIDEO = 'http://www.google.com/schemas/sitemap-video/1.1'
ET.register_namespace('', _NS_SITEMAP)
ET.register_namespace('video', _NS_VIDEO)

_VIDEOS_SQL = text("""
    SELECT id, title, description, video_url, thumbnail_url, tags,
           duration, created_at, owner_id, status
    FROM videos
    WHERE status = :status
""")


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


def _to_xml(root):
    """Serialize an ElementTree root to bytes with XML declaration."""
    return ET.tostring(root, encoding='unicode', xml_declaration=True).encode('utf-8')


def _video_el(tag):
    """Build a Clark-notation tag name in the video namespace."""
    return f'{{{_NS_VIDEO}}}{tag}'


@router.get("/sitemap.xml")
async def get_sitemap(db: Session = Depends(get_db)):
    """Generates a standard XML sitemap for general pages + video watch pages."""
    urlset = ET.Element("urlset")

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

    rows = db.execute(_VIDEOS_SQL, {"status": "approved"}).fetchall()
    for row in rows:
        if not row.created_at:
            continue
        url_el = ET.SubElement(urlset, "url")
        ET.SubElement(url_el, "loc").text = f"{BASE_URL}/watch/{row.id}"
        ET.SubElement(url_el, "lastmod").text = row.created_at.strftime("%Y-%m-%d")
        ET.SubElement(url_el, "changefreq").text = "weekly"
        ET.SubElement(url_el, "priority").text = "0.6"

    return Response(content=_to_xml(urlset), media_type="application/xml")


@router.get("/video-sitemap.xml")
async def get_video_sitemap(db: Session = Depends(get_db)):
    """Generates a Google Video Sitemap for video indexing."""
    urlset = ET.Element("urlset")

    rows = db.execute(_VIDEOS_SQL, {"status": "approved"}).fetchall()

    for row in rows:
        if not row.created_at or not row.video_url:
            continue

        thumbnail = _resolve_url(row.thumbnail_url) if row.thumbnail_url else ""
        if not thumbnail:
            continue

        url_el = ET.SubElement(urlset, "url")
        ET.SubElement(url_el, "loc").text = f"{BASE_URL}/watch/{row.id}"

        video_el = ET.SubElement(url_el, _video_el("video"))
        ET.SubElement(video_el, _video_el("thumbnail_loc")).text = thumbnail
        ET.SubElement(video_el, _video_el("title")).text = row.title or ""
        ET.SubElement(video_el, _video_el("description")).text = (
            row.description or f"Watch {row.title} on Monteeq."
        )
        ET.SubElement(video_el, _video_el("player_loc")).text = f"{BASE_URL}/watch/{row.id}"

        dur = int(row.duration or 0)
        hours, remainder = divmod(dur, 3600)
        minutes, seconds = divmod(remainder, 60)
        ET.SubElement(video_el, _video_el("duration")).text = f"{hours:02d}:{minutes:02d}:{seconds:02d}"

        pub_date = row.created_at.strftime("%Y-%m-%d")
        ET.SubElement(video_el, _video_el("publication_date")).text = pub_date

        if row.tags:
            for tag in [t.strip() for t in row.tags.split(",") if t.strip()][:32]:
                ET.SubElement(video_el, _video_el("tag")).text = tag

    return Response(content=_to_xml(urlset), media_type="application/xml")
