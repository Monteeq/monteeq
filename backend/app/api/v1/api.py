from fastapi import APIRouter
from app.api.v1.endpoints import auth, videos, admin, users, posts, achievements, notifications, ads, chat, challenges, monetization, video_views, seo, recommendations, partners, categories, library, history, watch_later, liked, following, metrics, email


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
api_router.include_router(categories.router, prefix="/categories", tags=["categories"])
api_router.include_router(library.router, prefix="/library", tags=["library"])
api_router.include_router(history.router, prefix="/history", tags=["history"])
api_router.include_router(watch_later.router, prefix="/watch-later", tags=["watch-later"])
api_router.include_router(liked.router, prefix="/liked", tags=["liked"])
api_router.include_router(following.router, prefix="/following", tags=["following"])
api_router.include_router(monetization.router, prefix="/monetization", tags=["monetization"])
api_router.include_router(metrics.router, prefix="/metrics", tags=["metrics"])
api_router.include_router(email.router, prefix="/email", tags=["email"])



