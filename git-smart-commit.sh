#!/bin/bash

# Smart Git Commit & Push - one commit + push per file

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}🚀 Smart Git Commit & Push (per-file)${NC}"
echo "=================================================="

if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}❌ Not a git repository${NC}"
    exit 1
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)

generate_commit_message() {
    local status=$1
    local file=$2
    local filename
    filename=$(basename "$file")
    local ext="${filename##*.}"
    local dir
    dir=$(dirname "$file")

    # Determine action verb from git status code
    local action="add"
    case "$status" in
        M) action="update" ;;
        D) action="remove" ;;
        R) action="rename" ;;
        A) action="add" ;;
        ?) action="add" ;;
    esac

    # Determine conventional commit type from file
    if [[ "$filename" == "README.md" || "$filename" == "*.md" || "$ext" == "md" || "$ext" == "rst" || "$ext" == "txt" ]]; then
        echo "docs($filename): $action $filename"
    elif [[ "$filename" == "docker-compose.yml" || "$filename" == "Dockerfile" || "$ext" == "yml" || "$ext" == "yaml" ]]; then
        echo "build($filename): $action $filename"
    elif [[ "$filename" == ".gitignore" || "$filename" == ".env.example" || "$filename" == ".env" ]]; then
        echo "chore($filename): $action $filename"
    elif [[ "$ext" == "sh" ]]; then
        echo "chore($filename): $action script $filename"
    elif [[ "$ext" == "py" ]]; then
        if [[ "$dir" == *"models"* ]]; then
            echo "feat(models): $action $filename"
        elif [[ "$dir" == *"routers"* ]]; then
            echo "feat(api): $action $filename router"
        elif [[ "$dir" == *"schemas"* ]]; then
            echo "feat(schemas): $action $filename"
        elif [[ "$dir" == *"core"* ]]; then
            echo "feat(core): $action $filename"
        else
            echo "feat($filename): $action $filename"
        fi
    elif [[ "$ext" == "jsx" || "$ext" == "tsx" ]]; then
        if [[ "$dir" == *"pages"* ]]; then
            echo "feat(pages): $action ${filename%.*} page"
        elif [[ "$dir" == *"components"* ]]; then
            echo "feat(components): $action ${filename%.*} component"
        elif [[ "$dir" == *"context"* ]]; then
            echo "feat(context): $action ${filename%.*} context"
        else
            echo "feat(ui): $action $filename"
        fi
    elif [[ "$ext" == "js" || "$ext" == "ts" ]]; then
        if [[ "$dir" == *"api"* ]]; then
            echo "feat(api): $action $filename"
        else
            echo "feat($filename): $action $filename"
        fi
    elif [[ "$ext" == "css" ]]; then
        echo "style($filename): $action $filename"
    elif [[ "$ext" == "json" && "$filename" == "package.json" ]]; then
        echo "build(deps): $action $filename"
    elif [[ "$ext" == "json" ]]; then
        echo "chore($filename): $action $filename"
    elif [[ "$ext" == "toml" || "$ext" == "cfg" || "$ext" == "ini" || "$ext" == "conf" ]]; then
        echo "chore(config): $action $filename"
    elif [[ "$ext" == "html" ]]; then
        echo "feat(html): $action $filename"
    else
        echo "feat($filename): $action $filename"
    fi
}

# Read status and file separately to handle spaces and special chars
COMMIT_COUNT=0
FAIL_COUNT=0

while IFS= read -r line; do
    [[ -z "$line" ]] && continue

    STATUS="${line:0:2}"
    STATUS="${STATUS// /}"   # trim spaces (e.g. " M" -> "M")
    FILE="${line:3}"

    # Skip empty file entries
    [[ -z "$FILE" ]] && continue

    COMMIT_COUNT=$((COMMIT_COUNT + 1))
    COMMIT_MSG=$(generate_commit_message "$STATUS" "$FILE")

    echo -e "${CYAN}[$COMMIT_COUNT] ${FILE}${NC}"

    # Stage the specific file
    if [[ "$STATUS" == "D" ]]; then
        git rm --cached "$FILE" 2>/dev/null || git add "$FILE"
    else
        git add "$FILE"
    fi

    # Commit
    if git commit -m "$COMMIT_MSG" > /dev/null 2>&1; then
        echo -e "${GREEN}  ✅ committed: $COMMIT_MSG${NC}"
    else
        echo -e "${RED}  ❌ commit failed for: $FILE${NC}"
        FAIL_COUNT=$((FAIL_COUNT + 1))
        continue
    fi

    # Push immediately after each commit
    if git push -u origin "$BRANCH" > /dev/null 2>&1; then
        echo -e "${GREEN}  🚀 pushed to $BRANCH${NC}"
    else
        echo -e "${RED}  ⚠️  push failed for commit: $COMMIT_MSG${NC}"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi

    echo ""

done < <(git status --porcelain)

echo "=================================================="
if [[ $FAIL_COUNT -eq 0 ]]; then
    echo -e "${GREEN}✅ Done! $COMMIT_COUNT file(s) committed and pushed.${NC}"
else
    echo -e "${YELLOW}⚠️  Done with $FAIL_COUNT failure(s) out of $COMMIT_COUNT file(s).${NC}"
fi
