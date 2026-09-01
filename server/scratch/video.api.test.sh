#!/usr/bin/env bash
# =============================================================================
# Media Asset Pipeline — API Endpoint Test Suite
# Usage: chmod +x video.api.test.sh && ./video.api.test.sh
# Requires: curl, jq (brew install jq)
# Server must be running: npm run dev (port 5001)
# Redis must be running: docker compose up -d
# =============================================================================

BASE_URL="http://localhost:5001"
PASS=0
FAIL=0
RESULTS=()

# ─── Helpers ──────────────────────────────────────────────────────────────────
assert_status() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  local body="$4"
  if [ "$actual" -eq "$expected" ]; then
    echo "  ✅  PASS [$label] — HTTP $actual"
    PASS=$((PASS + 1))
    RESULTS+=("PASS: $label")
  else
    echo "  ❌  FAIL [$label] — expected HTTP $expected, got HTTP $actual"
    echo "      Body: $body"
    FAIL=$((FAIL + 1))
    RESULTS+=("FAIL: $label (expected $expected got $actual)")
  fi
}

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  Media Asset Pipeline — API Test Suite"
echo "══════════════════════════════════════════════════════════"
echo ""

# ─── TEST 1: Health Check ──────────────────────────────────────────────────────
echo "▶ TEST 1: Health Check"
RESPONSE=$(curl -s -o /tmp/body.txt -w "%{http_code}" "$BASE_URL/api/health")
BODY=$(cat /tmp/body.txt)
assert_status "GET /api/health → 200" 200 "$RESPONSE" "$BODY"
echo "      Body: $BODY"
echo ""

# ─── TEST 2: Upload with no file ──────────────────────────────────────────────
echo "▶ TEST 2: Upload — Missing file → 400"
RESPONSE=$(curl -s -o /tmp/body.txt -w "%{http_code}" -X POST "$BASE_URL/api/v1/video/local-upload")
BODY=$(cat /tmp/body.txt)
assert_status "POST /local-upload (no file) → 400" 400 "$RESPONSE" "$BODY"
echo "      Body: $BODY"
echo ""

# ─── TEST 3: Process — missing videoId → 400 ──────────────────────────────────
echo "▶ TEST 3: Process — Missing videoId → 400"
RESPONSE=$(curl -s -o /tmp/body.txt -w "%{http_code}" \
  -X POST "$BASE_URL/api/v1/video/process" \
  -H "Content-Type: application/json" \
  -d '{}')
BODY=$(cat /tmp/body.txt)
assert_status "POST /process (no videoId) → 400" 400 "$RESPONSE" "$BODY"
echo "      Body: $BODY"
echo ""

# ─── TEST 4: Process — non-existent UUID → 404 ────────────────────────────────
echo "▶ TEST 4: Process — Non-existent videoId → 404"
FAKE_UUID="00000000-0000-0000-0000-000000000000"
RESPONSE=$(curl -s -o /tmp/body.txt -w "%{http_code}" \
  -X POST "$BASE_URL/api/v1/video/process" \
  -H "Content-Type: application/json" \
  -d "{\"videoId\": \"$FAKE_UUID\"}")
BODY=$(cat /tmp/body.txt)
assert_status "POST /process (bad UUID) → 404" 404 "$RESPONSE" "$BODY"
echo "      Body: $BODY"
echo ""

# ─── TEST 5: Full Upload → Process flow ───────────────────────────────────────
# We need a real video file for the upload step.
# Using a tiny synthetic MP4 created via ffmpeg (if available), or skip gracefully.
echo "▶ TEST 5: Full Upload + Process flow (requires ffmpeg)"

SAMPLE_VIDEO="/tmp/test_sample.mp4"
if command -v ffmpeg &> /dev/null; then
  ffmpeg -y -f lavfi -i color=c=blue:size=320x240:duration=3 \
    -c:v libx264 -t 3 -pix_fmt yuv420p "$SAMPLE_VIDEO" -loglevel quiet 2>/dev/null
  echo "  ℹ  Sample video created at $SAMPLE_VIDEO"

  # Upload the test video
  echo "  → Uploading test video..."
  UPLOAD_RESPONSE=$(curl -s -o /tmp/upload_body.txt -w "%{http_code}" \
    -X POST "$BASE_URL/api/v1/video/local-upload" \
    -F "asset=@$SAMPLE_VIDEO")
  UPLOAD_BODY=$(cat /tmp/upload_body.txt)
  assert_status "POST /local-upload (with file) → 201" 201 "$UPLOAD_RESPONSE" "$UPLOAD_BODY"
  echo "      Body: $UPLOAD_BODY"

  # Extract videoId from response if upload succeeded
  if [ "$UPLOAD_RESPONSE" -eq 201 ]; then
    VIDEO_ID=$(echo "$UPLOAD_BODY" | jq -r '.video.id' 2>/dev/null)
    if [ -n "$VIDEO_ID" ] && [ "$VIDEO_ID" != "null" ]; then
      echo "  ℹ  Extracted videoId: $VIDEO_ID"

      # Enqueue the job
      echo "  → Enqueuing processing job..."
      PROCESS_RESPONSE=$(curl -s -o /tmp/process_body.txt -w "%{http_code}" \
        -X POST "$BASE_URL/api/v1/video/process" \
        -H "Content-Type: application/json" \
        -d "{\"videoId\": \"$VIDEO_ID\"}")
      PROCESS_BODY=$(cat /tmp/process_body.txt)
      assert_status "POST /process (valid videoId) → 202" 202 "$PROCESS_RESPONSE" "$PROCESS_BODY"
      echo "      Body: $PROCESS_BODY"

      JOB_ID=$(echo "$PROCESS_BODY" | jq -r '.jobId' 2>/dev/null)
      if [ -n "$JOB_ID" ] && [ "$JOB_ID" != "null" ]; then
        echo "  ✅  Job successfully enqueued → jobId: $JOB_ID"
        echo "  ℹ  Worker is now processing in the background."
        echo "  ℹ  Listen to Socket.io 'pipeline-update' events for progress."
      fi
    else
      echo "  ⚠  Could not parse videoId from upload response — skipping process step."
    fi
  fi
else
  echo "  ⚠  ffmpeg not found in PATH — skipping full upload+process test."
  echo "      To run this test: brew install ffmpeg"
fi

echo ""

# ─── Summary ──────────────────────────────────────────────────────────────────
echo "══════════════════════════════════════════════════════════"
echo "  Results: ✅ $PASS passed  ❌ $FAIL failed"
echo "══════════════════════════════════════════════════════════"
for r in "${RESULTS[@]}"; do echo "  $r"; done
echo ""

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
