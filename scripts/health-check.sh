#!/bin/bash
# =============================================================================
# OffGrid AI - Image Generation Health Check
# =============================================================================
# Tests the Nano Banana (Gemini 3 Pro) image generation endpoint and logs results.
# Can be run manually or via cron for daily monitoring.
#
# Usage:
#   ./scripts/health-check.sh                    # Quick check
#   ./scripts/health-check.sh --full             # Full check (3 test prompts)
#   ./scripts/health-check.sh --log results.csv  # Append results to CSV
#
# Cron example (daily at 8am, 2pm, 8pm MST):
#   0 8,14,20 * * * /path/to/health-check.sh --full --log /path/to/health-log.csv
# =============================================================================

BASE_URL="${OFFGRID_API_URL:-https://offgridtoolkit.ai}"
LOG_FILE=""
FULL_CHECK=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --full) FULL_CHECK=true; shift ;;
        --log) LOG_FILE="$2"; shift 2 ;;
        --url) BASE_URL="$2"; shift 2 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
echo "============================================"
echo "OffGrid AI Health Check - $TIMESTAMP"
echo "Target: $BASE_URL"
echo "============================================"

# Initialize CSV if needed
if [[ -n "$LOG_FILE" && ! -f "$LOG_FILE" ]]; then
    echo "timestamp,test_name,status,duration_ms,image_generated,finish_reason,http_status,notes" > "$LOG_FILE"
fi

run_test() {
    local test_name="$1"
    local prompt="$2"
    
    echo ""
    echo "Test: $test_name"
    echo "  Prompt: ${prompt:0:60}..."
    
    START_MS=$(date +%s%N)
    
    RESPONSE=$(curl -s -w "\n__HTTP_STATUS__%{http_code}" \
        --max-time 120 \
        -X POST "$BASE_URL/api/command/generate-image" \
        -H "Content-Type: application/json" \
        -d "{\"prompt\": \"$prompt\"}")
    
    END_MS=$(date +%s%N)
    DURATION_MS=$(( (END_MS - START_MS) / 1000000 ))
    
    HTTP_STATUS=$(echo "$RESPONSE" | grep "__HTTP_STATUS__" | sed 's/__HTTP_STATUS__//')
    BODY=$(echo "$RESPONSE" | grep -v "__HTTP_STATUS__")
    
    # Parse response
    SUCCESS=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success', False))" 2>/dev/null || echo "parse_error")
    FINISH_REASON=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('finishReason', '-'))" 2>/dev/null || echo "-")
    ERROR_REASON=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('errorReason', '-'))" 2>/dev/null || echo "-")
    
    if [[ "$SUCCESS" == "True" ]]; then
        STATUS="PASS"
        IMAGE_GEN="yes"
        echo "  ✅ PASS | ${DURATION_MS}ms | Image generated successfully"
    elif [[ "$HTTP_STATUS" == "000" ]]; then
        STATUS="TIMEOUT"
        IMAGE_GEN="no"
        echo "  ⏱️  TIMEOUT | ${DURATION_MS}ms | Request timed out (120s limit)"
    else
        STATUS="FAIL"
        IMAGE_GEN="no"
        echo "  ❌ FAIL | ${DURATION_MS}ms | HTTP $HTTP_STATUS | reason: $ERROR_REASON | finish: $FINISH_REASON"
    fi
    
    # Log to CSV
    if [[ -n "$LOG_FILE" ]]; then
        echo "$TIMESTAMP,$test_name,$STATUS,$DURATION_MS,$IMAGE_GEN,$FINISH_REASON,$HTTP_STATUS,$ERROR_REASON" >> "$LOG_FILE"
    fi
}

# Test 1: Simple prompt (always runs)
run_test "simple_shape" "Generate a simple image of a blue square on a white background"

# Full check: additional prompts
if [[ "$FULL_CHECK" == true ]]; then
    run_test "nature_scene" "A photorealistic image of a campfire in a forest clearing at dusk with warm orange light"
    run_test "infographic" "A clean infographic showing 5 water purification methods with labeled diagrams on a light background"
fi

# Also hit the built-in health endpoint for stats
echo ""
echo "--- Server-side Stats ---"
HEALTH=$(curl -s --max-time 30 "$BASE_URL/api/health/image-gen" 2>/dev/null)
if [[ -n "$HEALTH" ]]; then
    echo "$HEALTH" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(f\"  Healthy: {d.get('healthy', '?')}\")
    print(f\"  Test duration: {d.get('testDurationMs', '?')}ms\")
    stats = d.get('recentStats', {})
    print(f\"  Recent requests: {stats.get('totalRequests', 0)}\")
    print(f\"  Success rate: {stats.get('successRate', 'N/A')}\")
    print(f\"  Avg response: {stats.get('avgResponseMs', '?')}ms\")
except: print('  Could not parse health response')
" 2>/dev/null
else
    echo "  Could not reach health endpoint"
fi

echo ""
echo "============================================"
echo "Health check complete."
if [[ -n "$LOG_FILE" ]]; then
    TOTAL=$(wc -l < "$LOG_FILE")
    echo "Results logged to: $LOG_FILE ($((TOTAL - 1)) entries)"
fi
echo "============================================"
