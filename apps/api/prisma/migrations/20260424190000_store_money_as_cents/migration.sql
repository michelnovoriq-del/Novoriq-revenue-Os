ALTER TABLE "users"
  ALTER COLUMN "unpaidPerformanceBalance"
  TYPE INTEGER
  USING ROUND(COALESCE("unpaidPerformanceBalance", 0) * 100),
  ALTER COLUMN "unpaidPerformanceBalance" SET DEFAULT 0,
  ALTER COLUMN "totalRecoveredRevenue"
  TYPE INTEGER
  USING ROUND(COALESCE("totalRecoveredRevenue", 0) * 100),
  ALTER COLUMN "totalRecoveredRevenue" SET DEFAULT 0;

ALTER TABLE "evidences"
  ALTER COLUMN "recoveredAmount"
  TYPE INTEGER
  USING CASE
    WHEN "recoveredAmount" IS NULL THEN NULL
    ELSE ROUND("recoveredAmount" * 100)
  END;

ALTER TABLE "recovery_logs"
  ALTER COLUMN "recoveredAmount"
  TYPE INTEGER
  USING ROUND("recoveredAmount" * 100),
  ALTER COLUMN "platformFee"
  TYPE INTEGER
  USING ROUND("platformFee" * 100);
