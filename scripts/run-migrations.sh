#!/usr/bin/env bash
# =============================================================================
# AutoLeap - Supabase Migration Runner
# Run this script from the repository root on your Mac Mini.
#
# Prerequisites:
#   brew install postgresql
#   (psql must be available in PATH)
#
# Usage:
#   chmod +x scripts/run-migrations.sh
#   ./scripts/run-migrations.sh
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration - edit these if needed, or export them before running
# ---------------------------------------------------------------------------
DB_HOST="${DB_HOST:-aws-1-ap-south-1.pooler.supabase.com}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-postgres}"
DB_USER="${DB_USER:-postgres.glzlorvhnfpiebnfwvdl}"
DB_PASS="${DB_PASS:-Autoleap@123}"

export PGPASSWORD="${DB_PASS}"

DSN="postgresql://${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

MIGRATIONS_DIR="$(cd "$(dirname "$0")/.." && pwd)/supabase/migrations"

# ---------------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_ok()      { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*"; }

# ---------------------------------------------------------------------------
# Prerequisite check
# ---------------------------------------------------------------------------
if ! command -v psql &>/dev/null; then
  log_error "psql not found. Install it with: brew install postgresql"
  exit 1
fi

log_info "psql version: $(psql --version)"

# ---------------------------------------------------------------------------
# Connection test
# ---------------------------------------------------------------------------
log_info "Testing connection to Supabase..."
if ! psql "${DSN}" -c "SELECT 1;" -q --tuples-only &>/dev/null; then
  log_error "Cannot connect to database. Check your credentials and network."
  log_error "DSN: ${DSN}"
  exit 1
fi
log_ok "Connection successful."

# ---------------------------------------------------------------------------
# Enable required extensions
# ---------------------------------------------------------------------------
log_info "Enabling pg_trgm extension..."
psql "${DSN}" -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;" -q
log_ok "pg_trgm enabled."

# ---------------------------------------------------------------------------
# Ordered migration files (must run in this exact sequence)
# ---------------------------------------------------------------------------
MIGRATIONS=(
  "001_initial_schema.sql"
  "002_create_users_table.sql"
  "20260112181500_create_appointments_table.sql"
  "20260112182500_create_business_costs.sql"
  "20260112194000_match_faqs_gemini.sql"
  "20260119_add_facebook_messenger_fields.sql"
  "20260119_add_user_roles_and_business_link.sql"
  "20260319_enhancements.sql"
  "20260319_security_and_perf.sql"
  "20260320_appointment_reminders.sql"
  "20260320_budgets_and_cost_logs.sql"
  "20260320_conversations_and_queue_fix.sql"
  "20260320_dead_letter_queue_and_budget_alerts.sql"
  "20260320_faq_hit_count.sql"
  "20260320_fix_appointment_status_default.sql"
  "20260320_timezone_email_cleanup.sql"
  "20260320_webhook_idempotency.sql"
  "20260321_rls_and_indexes_audit.sql"
  "20260321_waitlist_services_notes.sql"
  "20260322_service_tiers.sql"
  "20260322_workflow_improvements.sql"
  "20260323_platform_settings.sql"
  "20260324_reviews_unique_constraint.sql"
  "20260325_match_faqs_openai.sql"
  "20260326_budget_fixes.sql"
  "20260326_faq_dedup.sql"
  "20260327_rag_fixes.sql"
  "20260328_appointments_updated_at.sql"
)

TOTAL=${#MIGRATIONS[@]}
PASSED=0
FAILED=0
SKIPPED=0

echo ""
log_info "Running ${TOTAL} migrations..."
echo "---------------------------------------------------------------"

for FILE in "${MIGRATIONS[@]}"; do
  FILEPATH="${MIGRATIONS_DIR}/${FILE}"

  if [[ ! -f "${FILEPATH}" ]]; then
    log_warn "MISSING  ${FILE} - skipping"
    (( SKIPPED++ ))
    continue
  fi

  printf "${BLUE}[%02d/%02d]${NC} Running %-55s " "$((PASSED + FAILED + SKIPPED + 1))" "${TOTAL}" "${FILE}..."

  if psql "${DSN}" -f "${FILEPATH}" -q 2>/tmp/autoleap_migration_err; then
    echo -e "${GREEN}OK${NC}"
    (( PASSED++ ))
  else
    echo -e "${RED}FAILED${NC}"
    log_error "Error in ${FILE}:"
    cat /tmp/autoleap_migration_err | grep -v "^$" | head -10
    (( FAILED++ ))
    # Continue running remaining migrations rather than stopping
  fi
done

echo "---------------------------------------------------------------"
echo ""

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
log_info "Migration summary:"
echo -e "  ${GREEN}Passed :${NC} ${PASSED}"
echo -e "  ${RED}Failed :${NC} ${FAILED}"
echo -e "  ${YELLOW}Skipped:${NC} ${SKIPPED}"
echo ""

if [[ ${FAILED} -gt 0 ]]; then
  log_warn "Some migrations failed. Review the errors above."
  log_warn "Re-running the script is safe - most statements use IF NOT EXISTS."
else
  log_ok "All migrations completed successfully."
fi

# ---------------------------------------------------------------------------
# Verification - check expected tables exist
# ---------------------------------------------------------------------------
log_info "Verifying table presence..."
EXPECTED_TABLES=(
  "businesses"
  "users"
  "appointments"
  "services"
  "faq_documents"
  "faq_embeddings"
  "request_queue"
  "conversations"
  "budgets"
  "cost_logs"
  "waitlist"
  "platform_settings"
  "business_costs"
)

MISSING=0
for TABLE in "${EXPECTED_TABLES[@]}"; do
  EXISTS=$(psql "${DSN}" -tAc "SELECT to_regclass('public.${TABLE}');" 2>/dev/null)
  if [[ "${EXISTS}" == "public.${TABLE}" ]]; then
    echo -e "  ${GREEN}[OK]${NC} public.${TABLE}"
  else
    echo -e "  ${RED}[MISSING]${NC} public.${TABLE}"
    (( MISSING++ ))
  fi
done

echo ""
if [[ ${MISSING} -eq 0 ]]; then
  log_ok "All expected tables are present. Database setup is complete."
else
  log_warn "${MISSING} table(s) missing. Check the migration errors above."
fi

unset PGPASSWORD
