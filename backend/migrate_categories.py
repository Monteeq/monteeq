"""Run this script to create the discovered_categories table."""
import sys
sys.path.insert(0, ".")
from app.db.session import engine
from app.models.models import DiscoveredCategory
DiscoveredCategory.__table__.create(engine, checkfirst=True)
print("✅ discovered_categories table created successfully")
