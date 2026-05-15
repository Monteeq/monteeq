import os
import re

frontend_dir = '../frontend/src'

for root, _, files in os.walk(frontend_dir):
    for file in files:
        if file.endswith(('.jsx', '.js')):
            path = os.path.join(root, file)
            with open(path, 'r') as f:
                content = f.read()

            # Find showNotification('error', 'String') and replace with err?.message || 'String'
            # We ONLY want to replace if there isn't already err.message or err.response etc.
            # Regex: showNotification\(\s*(['"]error['"])\s*,\s*(['"].*?['"])\s*\)
            # We'll replace it with: showNotification(\1, err?.message || \2)
            
            def replacer(match):
                error_arg = match.group(1)
                message_arg = match.group(2)
                # If message already contains err, skip
                if 'err' in message_arg:
                    return match.group(0)
                
                return f"showNotification({error_arg}, err?.message || {message_arg})"

            new_content = re.sub(
                r"showNotification\(\s*(['\"]error['\"])\s*,\s*(['\"].*?['\"])\s*\)",
                replacer,
                content
            )
            
            if new_content != content:
                with open(path, 'w') as f:
                    f.write(new_content)
                print(f"Injected err?.message in {path}")
