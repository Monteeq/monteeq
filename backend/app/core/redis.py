import redis
import logging
from app.core.config import REDIS_URL

logger = logging.getLogger(__name__)

class RedisManager:
    """
    Centralized Redis connection manager using a Singleton pattern.
    Provides a thread-safe StrictRedis client with automatic reconnection and basic health checks.
    """
    _instance = None
    _client = None
    last_error = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RedisManager, cls).__new__(cls)
        return cls._instance

    @property
    def client(self):
        if self._client is None:
            self.connect()
        return self._client

    def connect(self):
        """Initializes the Redis client and validates the connection."""
        try:
            # Use connection pooling for efficiency and stability
            pool = redis.ConnectionPool.from_url(
                REDIS_URL,
                decode_responses=True,
                socket_timeout=5,
                socket_connect_timeout=5,
                retry_on_timeout=True,
                max_connections=5
            )
            self._client = redis.StrictRedis(connection_pool=pool)
            
            # Simple health check to ensure Redis is responsive
            self._client.ping()
            self.last_error = None
            logger.info(f"Successfully connected to Redis Cloud at {REDIS_URL[:20]}...")
        except Exception as e:
            self.last_error = f"{type(e).__name__}: {str(e)}"
            logger.error(f"FATAL: Could not connect to Redis Cloud. Error: {e}")
            # We don't raise here to allow the app to start, 
            # but specific features requiring Redis will fail gracefully later.
            self._client = None

    def get_client(self):
        """Returns the active Redis client instance."""
        return self.client

class RedisClientProxy:
    """
    A lazy proxy that forwards attributes to the active Redis client.
    Allows retrying connection dynamically if it was previously disconnected.
    """
    @property
    def _real_client(self):
        client = redis_manager.client
        if client is None:
            raise redis.ConnectionError(f"Redis client is not connected. Last error: {redis_manager.last_error}")
        return client

    def __getattr__(self, name):
        return getattr(self._real_client, name)

    def __repr__(self):
        try:
            return repr(self._real_client)
        except Exception:
            return f"<RedisClientProxy (Disconnected: {redis_manager.last_error})>"

# Export a single instance for use across the application
redis_manager = RedisManager()
redis_client = RedisClientProxy()
