from fastapi import APIRouter
from app.api.v1.endpoints import auth, videos, admin, users, posts, achievements, notifications, ads, chat, challenges, monetization, video_views, seo, recommendations, partners

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(videos.router, prefix="/videos", tags=["videos"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(challenges.router, prefix="/challenges", tags=["challenges"])
api_router.include_router(posts.router, prefix="/posts", tags=["posts"])
api_router.include_router(achievements.router, prefix="/achievements", tags=["achievements"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(ads.router, prefix="/ads", tags=["ads"])
api_router.include_router(video_views.router, prefix="/views", tags=["views"])
api_router.include_router(seo.router, prefix="/seo", tags=["seo"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(recommendations.router, prefix="/recommend", tags=["recommendations"])
api_router.include_router(partners.router, prefix="/partners", tags=["partners"])
