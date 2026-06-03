-- ════════════════════════════════════════════════════════════════════════════
-- 添加三个新字段：分装规格 / 保存时间 / 真空机挡位
-- 在 Supabase SQL Editor 运行一次即可
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS pack_spec   TEXT DEFAULT '';
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS shelf_life  TEXT DEFAULT '';
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS vacuum_level TEXT DEFAULT '';
