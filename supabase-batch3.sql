-- ════════════════════════════════════════════════════════════════════════════
-- 第三批功能：过敏原标记 (#11) + 自定义分类 (#8)
-- 在 Supabase SQL Editor 运行一次
-- ════════════════════════════════════════════════════════════════════════════

-- ── #11 过敏原：给 recipes 加 allergens 数组字段 ─────────────────────────────
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS allergens TEXT[] DEFAULT '{}';

-- ── #8 自定义分类：新建 categories 表 ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id        INT PRIMARY KEY,
  name_en   TEXT NOT NULL,
  name_hu   TEXT NOT NULL,
  color     TEXT NOT NULL DEFAULT '#c8922a',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 用现有的 6 个分类做种子（id 保持和现在的 index 一致，旧菜谱不受影响）
INSERT INTO categories (id, name_en, name_hu, color, sort_order) VALUES
  (0, 'Sauce / Marinade',   'Szósz / Marinád',    '#c8922a', 0),
  (1, 'Cold Dish',          'Hideg étel',         '#5a9e6f', 1),
  (2, 'Stock / Soup',       'Alaplé / Leves',     '#4a90c4', 2),
  (3, 'Staple / Noodle',    'Tészta / Főétel',    '#c4774a', 3),
  (4, 'Dessert / Bread',    'Desszert / Kenyér',  '#c06090', 4),
  (5, 'Fermented / Spice',  'Fermentált / Fűszer','#4ab0c4', 5)
ON CONFLICT (id) DO NOTHING;

-- RLS for categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read categories" ON categories;
CREATE POLICY "read categories" ON categories
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin manage categories" ON categories;
CREATE POLICY "admin manage categories" ON categories
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
