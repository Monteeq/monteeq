from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.models import Video
import xml.etree.ElementTree as ET
from datetime import datetime

router = APIRouter()

BASE_URL = "https://monteeq.com" # Should ideally be from config

@router.get("/sitemap.xml")
async def get_sitemap(db: Session = Depends(get_db)):
    """Generates a standard XML sitemap for general pages."""
    urlset = ET.Element("urlset", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")
    
    # Static Public Pages
    pages = ["", "/home", "/flash", "/about", "/partner", "/privacy", "/terms", "/login", "/signup", "/challenges"]
    for page in pages:
        url_el = ET.SubElement(urlset, "url")
        ET.SubElement(url_el, "loc").text = f"{BASE_URL}{page}"
        ET.SubElement(url_el, "changefreq").text = "daily"
        ET.SubElement(url_el, "priority").text = "1.0" if page == "" else "0.8"

    # Dynamic Video Pages
    videos = db.query(Video).filter(Video.status == "approved").all()
    for video in videos:
        url_el = ET.SubElement(urlset, "url")
        ET.SubElement(url_el, "loc").text = f"{BASE_URL}/watch/{video.id}"
        ET.SubElement(url_el, "lastmod").text = video.created_at.strftime("%Y-%m-%d")
        ET.SubElement(url_el, "changefreq").text = "weekly"
        ET.SubElement(url_el, "priority").text = "0.6"

    xml_data = b'<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(urlset, encoding="utf-8", method="xml")
    return Response(content=xml_data, media_type="application/xml")

@router.get("/video-sitemap.xml")
async def get_video_sitemap(db: Session = Depends(get_db)):
    """Generates a specialized Video XML sitemap for Google Video Indexing."""
    ET.register_namespace('video', 'http://www.google.com/schemas/sitemap-video/1.1')
    urlset = ET.Element("urlset", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")
    
    videos = db.query(Video).filter(Video.status == "approved").all()
    video_ns = "{http://www.google.com/schemas/sitemap-video/1.1}"
    
    for video in videos:
        # Skip videos without necessary data
        if not video.created_at or not video.video_url:
            continue
            
        url_el = ET.SubElement(urlset, "url")
        ET.SubElement(url_el, "loc").text = f"{BASE_URL}/watch/{video.id}"
        
        video_el = ET.SubElement(url_el, f"{video_ns}video")
        ET.SubElement(video_el, f"{video_ns}thumbnail_loc").text = video.dynamic_thumbnail_url
        ET.SubElement(video_el, f"{video_ns}title").text = video.title
        ET.SubElement(video_el, f"{video_ns}description").text = video.description or f"Watch {video.title} on Monteeq."
        ET.SubElement(video_el, f"{video_ns}content_loc").text = video.dynamic_video_url
        ET.SubElement(video_el, f"{video_ns}duration").text = str(video.duration or 60)
        
        # W3C Format: YYYY-MM-DDThh:mm:ss+TZD
        pub_date = video.created_at.strftime("%Y-%m-%dT%H:%M:%S+00:00")
        ET.SubElement(video_el, f"{video_ns}publication_date").text = pub_date
        
        ET.SubElement(video_el, f"{video_ns}family_friendly").text = "yes"
        ET.SubElement(video_el, f"{video_ns}live").text = "no"

    xml_data = b'<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(urlset, encoding="utf-8", method="xml")
    return Response(content=xml_data, media_type="application/xml")
