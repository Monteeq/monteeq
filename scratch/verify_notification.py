import sys
import os
from unittest.mock import patch

# Add backend to path
sys.path.append('/home/smasduq/montage/backend')

from app.services.email_service import send_challenge_exit_email

def test_refactored_logic():
    print("Testing refactored email logic...")
    # Mock _send_email_logic to see if it's called correctly
    with patch('app.services.email_service._send_email_logic') as mock_logic:
        send_challenge_exit_email("test@example.com", "testuser", "Test Challenge")
        print(f"Logic called: {mock_logic.called}")
        if mock_logic.called:
            args, kwargs = mock_logic.call_args
            print(f"Subject: {args[1]}")
            assert "Update on Challenge: Test Challenge" in args[1]
            print("REFACTORING VERIFIED")

if __name__ == "__main__":
    test_refactored_logic()
