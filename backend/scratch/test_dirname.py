import os
url = "https://storage.googleapis.com/bucket/videos/123/master.m3u8"
print(f"URL: {url}")
print(f"Dirname: {os.path.dirname(url)}")
