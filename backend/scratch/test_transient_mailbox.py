import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from main import app
from app.db.session import get_db
from app.models.models import User, ChatMessage, Conversation
from app.core.dependencies import get_current_user

client = TestClient(app)

def test_transient_mailbox():
    # Setup database session
    db = next(get_db())
    
    # Ensure test users exist
    alice = db.query(User).filter(User.username == "alice").first()
    if not alice:
        alice = User(username="alice", email="alice@test.com", hashed_password="hash")
        db.add(alice)
    
    bob = db.query(User).filter(User.username == "bob").first()
    if not bob:
        bob = User(username="bob", email="bob@test.com", hashed_password="hash")
        db.add(bob)
        
    db.commit()
    
    # Mock current user authentication
    def override_get_current_user():
        return alice
        
    app.dependency_overrides[get_current_user] = override_get_current_user
    
    try:
        # 1. Send message from Alice to Bob
        payload = {
            "recipient_username": "bob",
            "encrypted_content": "test_content_ciphertext",
            "iv": "test_iv",
            "recipient_key": "bob_wrapped_key",
            "sender_key": "alice_wrapped_key",
            "message_type": "text"
        }
        resp = client.post("/api/v1/chat/messages", json=payload)
        assert resp.status_code == 200, resp.text
        msg_id = resp.json()["id"]
        
        # Verify message exists in database
        db.expire_all()
        msg_db = db.query(ChatMessage).filter(ChatMessage.id == msg_id).first()
        assert msg_db is not None
        
        # 2. Acknowledge message (as Alice/Bob)
        ack_payload = [msg_id]
        ack_resp = client.post("/api/v1/chat/messages/ack", json=ack_payload)
        assert ack_resp.status_code == 200, ack_resp.text
        assert ack_resp.json()["deleted"] == 1
        
        # Verify message has been deleted (transience check)
        db.expire_all()
        msg_db_after = db.query(ChatMessage).filter(ChatMessage.id == msg_id).first()
        assert msg_db_after is None, "Message should be deleted after acknowledgment"
        
        print("SUCCESS: Transient Mailbox verification passed!")
        
    finally:
        # Clean up dependency override
        app.dependency_overrides.pop(get_current_user, None)

if __name__ == "__main__":
    test_transient_mailbox()
