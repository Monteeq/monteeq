import xml.etree.ElementTree as ET

ET.register_namespace('video', 'http://www.google.com/schemas/sitemap-video/1.1')
urlset = ET.Element("urlset", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")
url_el = ET.SubElement(urlset, "url")
video_ns = "{http://www.google.com/schemas/sitemap-video/1.1}"
video_el = ET.SubElement(url_el, f"{video_ns}video")
ET.SubElement(video_el, f"{video_ns}title").text = "Test Video"

xml_data = b'<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(urlset, encoding="utf-8", method="xml")
print(xml_data.decode())
