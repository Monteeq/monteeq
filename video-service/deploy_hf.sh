#!/bin/bash
# Exit immediately if a command exits with a non-zero status.
set -e

echo -e "\033[1;34m=== Monteeq Video Service HF Space Deployer ===\033[0m"

# Ensure we are in the correct directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

# 1. Initialize git repo if not already done
if [ ! -d ".git" ]; then
    echo "Initializing new Git repository inside video-service..."
    git init -b main
else
    # Rename branch if it exists as master
    if git show-ref --verify --quiet refs/heads/master; then
        git branch -m master main
    fi
    echo "Git repository already initialized."
fi

# 2. Check/Setup Hugging Face remote
HF_REMOTE=$(git remote get-url hf 2>/dev/null || echo "")

if [ -z "$HF_REMOTE" ]; then
    echo -e "\033[1;33mNo Hugging Face remote found.\033[0m"
    echo -e "Please enter your Hugging Face Space Git URL (e.g., git@hf.co:spaces/username/space-name or https://huggingface.co/spaces/username/space-name):"
    read -r user_url
    if [ -z "$user_url" ]; then
        echo -e "\033[1;31mError: URL cannot be empty.\033[0m"
        exit 1
    fi
    git remote add hf "$user_url"
    echo -e "\033[1;32mRemote 'hf' successfully added!\033[0m"
else
    echo -e "Current Hugging Face remote is set to: \033[1;32m$HF_REMOTE\033[0m"
    echo "Do you want to change it? (y/n)"
    read -r change_remote
    if [[ "$change_remote" =~ ^[Yy]$ ]]; then
        echo "Enter new Hugging Face Space Git URL:"
        read -r user_url
        if [ -n "$user_url" ]; then
            git remote set-url hf "$user_url"
            echo -e "\033[1;32mRemote 'hf' updated!\033[0m"
        fi
    fi
fi

# 3. Stage and commit
echo "Staging files..."
git add .gitignore Dockerfile README.md Cargo.toml Cargo.lock src/

echo "Creating commit..."
git commit -m "Deploy Monteeq Video Service to Hugging Face Spaces" || echo "No changes to commit"

# 4. Push
echo -e "\033[1;33mPushing to Hugging Face Space...\033[0m"
echo -e "Note: If this is the first push, it might require SSH authentication or a HF Access Token."
git push hf main --force

echo -e "\033[1;32m=== Deployment completed successfully! ===\033[0m"
echo "Go to your Hugging Face Space page to monitor the build progress."
