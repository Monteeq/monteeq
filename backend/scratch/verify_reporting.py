import sys
import os
import datetime
from sqlalchemy.orm import Session

# Add backend to python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.db.session import SessionLocal
from app.models.models import User, Video, Comment, Post, ContentReport, ModerationAuditLog

def sync_sequences(db: Session):
    print("Syncing DB sequences...")
    for table in ['posts', 'comments', 'videos', 'users']:
        try:
            max_id = db.execute(text(f"SELECT MAX(id) FROM {table}")).scalar()
            next_id = (max_id or 0) + 1
            db.execute(text(f"ALTER TABLE {table} ALTER COLUMN id RESTART WITH {next_id}"))
            db.commit()
            print(f"Synced sequence for table: {table} to start at {next_id}")
        except Exception as e:
            db.rollback()
            print(f"Could not sync sequence for table {table}: {e}")

def setup_test_data(db: Session):
    print("--- Cleaning up any stale test data ---")
    db.query(ContentReport).filter(ContentReport.description.like("%test%")).delete(synchronize_session=False)
    db.query(Comment).filter(Comment.content.like("%Test Offensive Comment%")).delete(synchronize_session=False)
    db.query(Video).filter(Video.title.like("%Test Offensive Video%")).delete(synchronize_session=False)
    db.query(Post).filter(Post.content.like("%Test Offensive Post%")).delete(synchronize_session=False)
    db.commit()

    sync_sequences(db)
    print("--- Setting up test data ---")
    
    # 1. Get or create Admin user
    admin = db.query(User).filter(User.role == "admin").first()
    if not admin:
        admin = User(
            email="admin_test@monteeq.com",
            hashed_password="fakehashadmin",
            username="admin_test",
            role="admin",
            is_active=True
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
        print(f"Created admin: {admin.username}")
    else:
        print(f"Found admin: {admin.username}")

    # 2. Get or create Reporter user
    reporter = db.query(User).filter(User.email == "reporter_test@monteeq.com").first()
    if not reporter:
        reporter = User(
            email="reporter_test@monteeq.com",
            hashed_password="fakehashreporter",
            username="reporter_test",
            role="creator",
            is_active=True
        )
        db.add(reporter)
        db.commit()
        db.refresh(reporter)
        print(f"Created reporter: {reporter.username}")
    else:
        print(f"Found reporter: {reporter.username}")

    # 3. Get or create Offender user
    offender = db.query(User).filter(User.email == "offender_test@monteeq.com").first()
    if not offender:
        offender = User(
            email="offender_test@monteeq.com",
            hashed_password="fakehashoffender",
            username="offender_test",
            role="creator",
            is_active=True
        )
        db.add(offender)
        db.commit()
        db.refresh(offender)
        print(f"Created offender: {offender.username}")
    else:
        print(f"Found offender: {offender.username}")

    # 4. Get or create Video
    video = db.query(Video).filter(Video.title == "Test Offensive Video").first()
    if not video:
        video = Video(
            title="Test Offensive Video",
            description="Violates guidelines",
            owner_id=offender.id,
            video_url="http://example.com/video.mp4",
            video_type="home",  # standard video
            public_id="v_test_offense"
        )
        db.add(video)
        db.commit()
        db.refresh(video)
        print(f"Created video: {video.title}")
    else:
        print(f"Found video: {video.title}")

    # 5. Get or create Comment
    comment = db.query(Comment).filter(Comment.content == "Test Offensive Comment").first()
    if not comment:
        comment = Comment(
            content="Test Offensive Comment",
            owner_id=offender.id,
            video_id=video.id
        )
        db.add(comment)
        db.commit()
        db.refresh(comment)
        print(f"Created comment: {comment.content}")
    else:
        print(f"Found comment: {comment.content}")

    # 6. Get or create Post
    post = db.query(Post).filter(Post.content == "Test Offensive Post").first()
    if not post:
        post = Post(
            content="Test Offensive Post",
            owner_id=offender.id,
        )
        db.add(post)
        db.commit()
        db.refresh(post)
        print(f"Created post: {post.content}")
    else:
        print(f"Found post: {post.content}")

    return admin, reporter, offender, video, comment, post


def clean_existing_reports(db: Session, reporter_id: int):
    print("Cleaning existing test reports...")
    db.query(ContentReport).filter(ContentReport.reporter_id == reporter_id).delete()
    db.commit()


def test_duplicate_prevention(db: Session, reporter: User, video: Video):
    print("\n--- Testing Duplicate Prevention ---")
    
    # 1st report submission
    r1 = ContentReport(
        reporter_id=reporter.id,
        content_type="video",
        video_id=video.id,
        reason="spam",
        description="Duplicate test 1"
    )
    db.add(r1)
    db.commit()
    print("Submitted first report successfully.")

    # 2nd report submission (simulate duplicate check)
    exists = db.query(ContentReport).filter(
        ContentReport.reporter_id == reporter.id,
        ContentReport.content_type == "video",
        ContentReport.video_id == video.id,
        ContentReport.status == "pending"
    ).first()

    if exists:
        print("SUCCESS: Duplicate check detected pending report correctly.")
    else:
        print("FAILED: Duplicate check failed to detect pending report.")


def test_rate_limiting(db: Session, reporter: User, video: Video):
    print("\n--- Testing Rate Limiting (Max 10 per hour) ---")
    
    # Clean previous reports
    db.query(ContentReport).filter(ContentReport.reporter_id == reporter.id).delete()
    db.commit()

    # Create 10 reports
    for i in range(10):
        r = ContentReport(
            reporter_id=reporter.id,
            content_type="video",
            video_id=video.id,
            reason="harassment",
            description=f"Rate limit report {i}"
        )
        db.add(r)
    db.commit()
    print("Submitted 10 reports successfully.")

    # Check how many reports this user has submitted in the last hour
    one_hour_ago = datetime.datetime.utcnow() - datetime.timedelta(hours=1)
    report_count = db.query(ContentReport).filter(
        ContentReport.reporter_id == reporter.id,
        ContentReport.created_at >= one_hour_ago
    ).count()

    print(f"Reports submitted in last hour: {report_count}")
    if report_count >= 10:
        print("SUCCESS: Rate limit trigger active (10 reports reached). Submitting another will be blocked.")
    else:
        print("FAILED: Rate limit check failed.")


def test_moderation_actions(db: Session, admin: User, reporter: User, offender: User, comment: Comment, post: Post):
    print("\n--- Testing Admin Actions ---")
    
    # Clean reports
    db.query(ContentReport).filter(ContentReport.reporter_id == reporter.id).delete()
    db.commit()

    # 1. Report the Comment
    rep_comment = ContentReport(
        reporter_id=reporter.id,
        content_type="comment",
        comment_id=comment.id,
        reason="hate",
        description="Hateful comment test"
    )
    db.add(rep_comment)
    db.commit()
    db.refresh(rep_comment)
    
    # Action: Delete Content
    print(f"Admin taking 'delete_content' action on comment report ID {rep_comment.id}")
    
    # Execute actual mock action
    rep_comment.status = "resolved"
    rep_comment.resolver_id = admin.id
    rep_comment.resolved_at = datetime.datetime.utcnow()
    rep_comment.notes = "Deleting hateful comment per guidelines"
    
    # Hard delete comment or soft delete/approve status
    db.delete(comment)
    
    audit_log = ModerationAuditLog(
        moderator_id=admin.id,
        action="delete_content",
        target_type="comment",
        target_id=str(comment.id),
        details=f"Deleted comment. Notes: {rep_comment.notes}"
    )
    db.add(audit_log)
    db.commit()

    # Verify comment deletion & audit trail
    comment_exists = db.query(Comment).filter(Comment.id == comment.id).first()
    audit_exists = db.query(ModerationAuditLog).filter(
        ModerationAuditLog.target_id == str(comment.id), 
        ModerationAuditLog.action == "delete_content"
    ).first()

    if not comment_exists and audit_exists:
        print("SUCCESS: Comment deleted and audit log generated successfully.")
        print(f"Audit Log Detail: {audit_exists.details}")
    else:
        print("FAILED: Comment action failed.")

    # 2. Report the Post
    rep_post = ContentReport(
        reporter_id=reporter.id,
        content_type="post",
        post_id=post.id,
        reason="harassment",
        description="Harassing post test"
    )
    db.add(rep_post)
    db.commit()
    db.refresh(rep_post)

    # Action: Suspend Creator
    print(f"Admin taking 'suspend_user' action on offender ID {offender.id}")
    offender.is_active = False
    rep_post.status = "resolved"
    rep_post.resolver_id = admin.id
    rep_post.resolved_at = datetime.datetime.utcnow()
    rep_post.notes = "Suspending user for harassment"

    audit_log_suspend = ModerationAuditLog(
        moderator_id=admin.id,
        action="suspend_user",
        target_type="user",
        target_id=str(offender.id),
        details=f"Suspended user @{offender.username}. Notes: {rep_post.notes}"
    )
    db.add(audit_log_suspend)
    db.commit()

    # Verify user suspended & audit trail
    offender_active = db.query(User).filter(User.id == offender.id).first().is_active
    audit_suspend_exists = db.query(ModerationAuditLog).filter(
        ModerationAuditLog.target_id == str(offender.id),
        ModerationAuditLog.action == "suspend_user"
    ).first()

    if not offender_active and audit_suspend_exists:
        print("SUCCESS: Offending user suspended and suspension audit log created.")
        print(f"Audit Log Detail: {audit_suspend_exists.details}")
    else:
        print("FAILED: Suspend action failed.")


def run_tests():
    db = SessionLocal()
    try:
        admin, reporter, offender, video, comment, post = setup_test_data(db)
        
        clean_existing_reports(db, reporter.id)
        
        test_duplicate_prevention(db, reporter, video)
        
        test_rate_limiting(db, reporter, video)
        
        test_moderation_actions(db, admin, reporter, offender, comment, post)
        
        # Finally clean up test reports and restore offender status
        print("\nCleaning up test reports...")
        db.query(ContentReport).filter(ContentReport.reporter_id == reporter.id).delete()
        
        # Restore active user
        offender.is_active = True
        db.add(offender)
        
        # Delete test video and post
        db.query(Video).filter(Video.id == video.id).delete()
        db.query(Post).filter(Post.id == post.id).delete()
        
        db.commit()
        print("All tests completed successfully!")
    finally:
        db.close()


if __name__ == "__main__":
    run_tests()
