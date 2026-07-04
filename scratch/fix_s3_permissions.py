import boto3
from app.core import config
from app.db.session import SessionLocal
from app.models.models import Video

# Initialize S3 client
s3 = boto3.client(
    's3',
    aws_access_key_id=config.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=config.AWS_SECRET_ACCESS_KEY,
    region_name=config.AWS_S3_REGION_NAME
)

bucket = config.AWS_STORAGE_BUCKET_NAME

def fix_permissions():
    db = SessionLocal()
    try:
        videos = db.query(Video).filter(Video.status == "approved").all()
        
        print(f"Checking {len(videos)} approved videos...")
        
        for v in videos:
            # 1. Fix Thumbnail
            if v.thumbnail_url and "amazonaws.com" in v.thumbnail_url or "cdn.monteeq.com" in v.thumbnail_url:
                try:
                    key = v.thumbnail_url.split(".com/")[1]
                    print(f"  Fixing thumbnail: {key}")
                    s3.put_object_acl(Bucket=bucket, Key=key, ACL='public-read')
                except Exception as e:
                    print(f"    Error fixing thumbnail {v.id}: {e}")

            # 2. Fix Video Folder (Master + Variants + Chunks)
            if v.video_url and ("amazonaws.com" in v.video_url or "cdn.monteeq.com" in v.video_url):
                try:
                    # Extract prefix (folder)
                    # videos/383a1ad0-8635-49b9-be3b-533bc78dc7ef/master.m3u8 -> videos/383a1ad0-8635-49b9-be3b-533bc78dc7ef/
                    url_path = v.video_url.split(".com/")[1]
                    prefix = "/".join(url_path.split("/")[:-1])
                    
                    print(f"  Fixing video folder: {prefix}/")
                    
                    # Paginate through all objects with this prefix
                    paginator = s3.get_paginator('list_objects_v2')
                    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
                        if 'Contents' in page:
                            for obj in page['Contents']:
                                s3.put_object_acl(Bucket=bucket, Key=obj['Key'], ACL='public-read')
                                
                except Exception as e:
                    print(f"    Error fixing video {v.id}: {e}")

        print("Done!")
    finally:
        db.close()

if __name__ == "__main__":
    fix_permissions()
