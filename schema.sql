-- 이온랩(IONLAB REFINERY) 위탁 정련 접수 및 작업 로그 데이터베이스 스키마 (Cloudflare D1: ionlab-refinery)
DROP TABLE IF EXISTS refinery_order_logs;
DROP TABLE IF EXISTS refinery_orders;

CREATE TABLE IF NOT EXISTS refinery_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_number TEXT NOT NULL UNIQUE,
  submitted_at TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  client_email TEXT NOT NULL,
  access_password TEXT NOT NULL,
  track TEXT NOT NULL,
  track_name TEXT NOT NULL,
  weight INTEGER NOT NULL,
  preprocess_option TEXT NOT NULL,
  preprocess_label TEXT NOT NULL,
  purity_option TEXT NOT NULL DEFAULT 'standard',
  purity_label TEXT NOT NULL DEFAULT '표준 1차 정련 (순도 98.5% ~ 99.5%)',
  settlement_type TEXT NOT NULL,
  expected_gold REAL NOT NULL,
  actual_gold REAL DEFAULT NULL,
  gold_price INTEGER NOT NULL,
  base_cost_a INTEGER NOT NULL,
  preprocess_cost_b INTEGER NOT NULL,
  chemical_cost_c INTEGER NOT NULL,
  purity_cost_d INTEGER NOT NULL DEFAULT 0,
  final_work_fee INTEGER NOT NULL,
  total_gold_value_v INTEGER NOT NULL,
  net_client_profit INTEGER NOT NULL,
  is_ratio_applied INTEGER NOT NULL DEFAULT 0,
  memo TEXT,
  photo_keys_json TEXT DEFAULT '[]',
  photo_urls_json TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'RECEIVED',
  current_step INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS refinery_order_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_number TEXT NOT NULL,
  step_number INTEGER NOT NULL DEFAULT 1,
  stage_label TEXT NOT NULL,
  log_title TEXT NOT NULL,
  log_detail TEXT NOT NULL,
  operator_name TEXT NOT NULL DEFAULT '이온랩 정련팀',
  measured_value TEXT DEFAULT NULL,
  photo_url TEXT DEFAULT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_refinery_orders_receipt_number ON refinery_orders(receipt_number);
CREATE INDEX IF NOT EXISTS idx_refinery_orders_lookup ON refinery_orders(client_email, client_phone);
CREATE INDEX IF NOT EXISTS idx_refinery_order_logs_receipt ON refinery_order_logs(receipt_number, id ASC);
