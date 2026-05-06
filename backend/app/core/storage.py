import os
import logging
import time
from typing import Optional
import shutil
import boto3
from botocore.exceptions import ClientError
from sqlalchemy.orm import Session

from app.core import config
from app.db.session import SessionLocal
from app.models.models import Setting

logger = logging.getLogger(__name__)

class Storage:
    def __init__(self):
        self._mode: Optional[str] = None
        self._mode_cache_time: float = 0
        self._cache_ttl: int = 60  # Cache DB mode for 60 seconds

        self.s3_client = None
        if config.AWS_ACCESS_KEY_ID:
            self._init_s3_client()

    def _init_s3_client(self):
        try:
            from botocore.config import Config
            
            s3_opts = {'region_name': config.AWS_S3_REGION_NAME}
            if config.AWS_S3_USE_ACCELERATE:
                s3_opts['use_accelerate_endpoint'] = True
                logger.info("Enabling S3 Transfer Acceleration")
            
            s3_config = Config(s3=s3_opts)
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=config.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=config.AWS_SECRET_ACCESS_KEY,
                config=s3_config
            )
            logger.info("Successfully initialized AWS S3 client")
        except Exception as e:
            logger.error(f"Failed to initialize AWS S3 client: {e}", exc_info=True)

    @property
    def mode(self) -> str:
        """
        Dynamically resolves the storage mode from the database with a TTL cache.
        Falls back to config.STORAGE_MODE if not set in DB.
        """
        current_time = time.time()
        if self._mode and (current_time - self._mode_cache_time) < self._cache_ttl:
            return self._mode

        db = SessionLocal()
        try:
            setting = db.query(Setting).filter(Setting.key == "storage_mode").first()
            if setting and setting.value:
                self._mode = setting.value
            else:
                self._mode = config.STORAGE_MODE
            self._mode_cache_time = current_time
        except Exception as e:
            logger.error(f"Error fetching storage_mode from DB: {e}", exc_info=True)
            self._mode = config.STORAGE_MODE
        finally:
            db.close()
        
        return self._mode

    def upload_file(self, local_path: str, s3_key: str) -> str:
        """
        Uploads a file to the active storage provider and returns its URL.
        """
        current_mode = self.mode
        
        if current_mode == "local":
            return self._upload_local(local_path, s3_key)
        else:
            return self._upload_s3(local_path, s3_key)

    def _upload_local(self, local_path: str, s3_key: str) -> str:
        dest_path = os.path.join(config.STATIC_DIR, s3_key)
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        shutil.copy2(local_path, dest_path)
        url_key = s3_key.replace(os.sep, "/")
        return f"{config.BASE_URL}/static/{url_key}"

    def _upload_s3(self, local_path: str, s3_key: str) -> str:
        if not self.s3_client:
            raise ValueError("AWS S3 client is not initialized.")
        try:
            # S3 upload_file handles chunking and multi-part automatically
            self.s3_client.upload_file(
                local_path, 
                config.AWS_STORAGE_BUCKET_NAME, 
                s3_key
            )
            return self.get_url(s3_key, mode="s3")
        except Exception as e:
            logger.error(f"S3 Upload failed for {s3_key}: {e}", exc_info=True)
            raise

    def upload_file_obj(self, file_obj, s3_key: str) -> str:
        """
        Uploads a file-like object directly to storage (avoids local disk).
        """
        current_mode = self.mode
        
        if current_mode == "local":
            dest_path = os.path.join(config.STATIC_DIR, s3_key)
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            with open(dest_path, "wb") as buffer:
                shutil.copyfileobj(file_obj, buffer)
            url_key = s3_key.replace(os.sep, "/")
            return f"{config.BASE_URL}/static/{url_key}"
        else:
            if not self.s3_client:
                raise ValueError("AWS S3 client is not initialized.")
            try:
                # Detect content type from the key extension
                ext = os.path.splitext(s3_key)[1].lower()
                content_type_map = {
                    ".mp4": "video/mp4",
                    ".mov": "video/quicktime",
                    ".avi": "video/x-msvideo",
                    ".mkv": "video/x-matroska",
                    ".webm": "video/webm",
                    ".m3u8": "application/x-mpegURL",
                    ".ts": "video/MP2T",
                    ".jpg": "image/jpeg",
                    ".jpeg": "image/jpeg",
                    ".png": "image/png",
                }
                content_type = content_type_map.get(ext, "application/octet-stream")
                
                from boto3.s3.transfer import TransferConfig
                config_s3 = TransferConfig(
                    multipart_threshold=1024 * 25, # 25MB
                    max_concurrency=10,
                    multipart_chunksize=1024 * 25, # 25MB
                    use_threads=True
                )
                
                self.s3_client.upload_fileobj(
                    file_obj,
                    config.AWS_STORAGE_BUCKET_NAME,
                    s3_key,
                    ExtraArgs={
                        'ContentType': content_type
                    },
                    Config=config_s3
                )
                return self.get_url(s3_key, mode="s3")
            except Exception as e:
                logger.error(f"S3 Object Upload failed for {s3_key}: {e}", exc_info=True)
                raise

    def get_url(self, s3_key: str, mode: Optional[str] = None) -> str:
        """
        Returns the public URL for a given key.
        Uses CloudFront if configured, otherwise S3.
        """
        current_mode = mode or self.mode
        url_key = s3_key.replace(os.sep, "/")
        
        if current_mode == "local":
            return f"{config.BASE_URL}/static/{url_key}"
        else:
            # If CloudFront is configured, use it for super-fast global delivery
            if config.AWS_CLOUDFRONT_DOMAIN:
                return f"https://{config.AWS_CLOUDFRONT_DOMAIN}/{url_key}"
            
            # Fallback to direct S3
            return f"https://{config.AWS_STORAGE_BUCKET_NAME}.s3.{config.AWS_S3_REGION_NAME}.amazonaws.com/{url_key}"

    def delete_file(self, s3_key: str) -> None:
        """
        Deletes a file from storage.
        """
        current_mode = self.mode
        
        if current_mode == "local":
            local_path = os.path.join(config.STATIC_DIR, s3_key.replace("/", os.sep))
            if os.path.exists(local_path):
                try:
                    os.remove(local_path)
                    logger.info(f"Deleted local file: {local_path}")
                except Exception as e:
                    logger.error(f"Failed to delete local file {local_path}: {e}", exc_info=True)
        else:
            if not self.s3_client:
                logger.error("Cannot delete from S3: Client not initialized.")
                return
            try:
                self.s3_client.delete_object(
                    Bucket=config.AWS_STORAGE_BUCKET_NAME,
                    Key=s3_key
                )
                logger.info(f"Deleted S3 object: {s3_key}")
            except Exception as e:
                logger.error(f"Failed to delete S3 object {s3_key}: {e}", exc_info=True)
    def delete_prefix(self, prefix: str) -> None:
        """
        Deletes all objects with the given prefix (folder deletion).
        """
        current_mode = self.mode
        
        if current_mode == "local":
            local_dir = os.path.join(config.STATIC_DIR, prefix.replace("/", os.sep))
            if os.path.exists(local_dir) and os.path.isdir(local_dir):
                try:
                    shutil.rmtree(local_dir)
                    logger.info(f"Deleted local directory: {local_dir}")
                except Exception as e:
                    logger.error(f"Failed to delete local directory {local_dir}: {e}", exc_info=True)
        else:
            if not self.s3_client:
                logger.error("Cannot delete from S3: Client not initialized.")
                return
            try:
                # Paginate through objects with prefix and delete them
                paginator = self.s3_client.get_paginator('list_objects_v2')
                pages = paginator.paginate(Bucket=config.AWS_STORAGE_BUCKET_NAME, Prefix=prefix)

                delete_us = dict(Objects=[])
                for item in pages.search('Contents'):
                    if item:
                        delete_us['Objects'].append(dict(Key=item['Key']))

                        # S3 delete_objects has a limit of 1000 per call
                        if len(delete_us['Objects']) >= 1000:
                            self.s3_client.delete_objects(Bucket=config.AWS_STORAGE_BUCKET_NAME, Delete=delete_us)
                            delete_us = dict(Objects=[])

                if len(delete_us['Objects']):
                    self.s3_client.delete_objects(Bucket=config.AWS_STORAGE_BUCKET_NAME, Delete=delete_us)
                
                logger.info(f"Deleted S3 prefix: {prefix}")
            except Exception as e:
                logger.error(f"Failed to delete S3 prefix {prefix}: {e}", exc_info=True)

storage = Storage()
