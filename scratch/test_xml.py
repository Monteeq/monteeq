import xml.etree.ElementTree as ET

def test_xml():
    ET.register_namespace('video', 'http://www.google.com/schemas/sitemap-video/1.1')
    urlset = ET.Element("urlset", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")
    # urlset.set("xmlns:video", "http://www.google.com/schemas/sitemap-video/1.1")
    
    video_ns = "{http://www.google.com/schemas/sitemap-video/1.1}"
    url_el = ET.SubElement(urlset, "url")
    loc = ET.SubElement(url_el, "loc")
    loc.text = "https://monteeq.com/watch/1"
    
    video_el = ET.SubElement(url_el, f"{video_ns}video")
    title = ET.SubElement(video_el, f"{video_ns}title")
    title.text = "Test Video"
    
    xml_data = b'<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(urlset, encoding="utf-8", method="xml")
    print(xml_data.decode())

test_xml()
