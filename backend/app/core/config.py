import os
from dotenv import load_dotenv

# Load .env file from the backend directory
env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
load_dotenv(env_path)

SECRET_KEY = os.getenv("SECRET_KEY", "SUPER_SECRET_KEY_CHANGE_ME")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "43200"))

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
BASE_URL = os.getenv("BASE_URL")
RUST_SERVICE_URL = os.getenv("RUST_SERVICE_URL")
FRONTEND_URL = os.getenv("FRONTEND_URL", "")
STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "static")

# Database Configuration
DATABASE_URL = os.getenv("DATABASE_URL")

# Quota Limits
FLASH_QUOTA_LIMIT = 50
HOME_QUOTA_LIMIT = 20

# Storage Configuration
STORAGE_MODE = os.getenv("STORAGE_MODE", "s3") # 'local' or 's3'
AWS_ACCESS_KEY_ID = os.getenv("S3_ACCESS_KEY", os.getenv("AWS_ACCESS_KEY_ID", ""))
AWS_SECRET_ACCESS_KEY = os.getenv("S3_SECRET_KEY", os.getenv("AWS_SECRET_ACCESS_KEY", ""))
AWS_STORAGE_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", os.getenv("AWS_STORAGE_BUCKET_NAME", "monteeq"))
AWS_S3_REGION_NAME = os.getenv("S3_REGION", os.getenv("AWS_S3_REGION_NAME", "eu-north-1"))
S3_ENDPOINT = os.getenv("S3_ENDPOINT", None)
AWS_S3_USE_ACCELERATE = os.getenv("AWS_S3_USE_ACCELERATE", "false").lower() == "true"
AWS_CLOUDFRONT_DOMAIN = os.getenv("AWS_CLOUDFRONT_DOMAIN", "") # Remove default to avoid broken URLs

PAYSTACK_SECRET_KEY = os.getenv("PAYSTACK_SECRET_KEY", "")
# STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
# STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_SECRET_KEY = ""
STRIPE_WEBHOOK_SECRET = ""


# Email / SMTP Configuration
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", "")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "Monteeq")

# Redis Configuration (Live Cloud)
REDIS_URL = os.getenv("REDIS_URL")

