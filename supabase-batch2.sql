-- ════════════════════════════════════════════════════════════════════════════
-- 第二批功能：草稿状态 (#10) + 版本历史 (#9)
-- 在 Supabase SQL Editor 运行一次
-- ════════════════════════════════════════════════════════════════════════════

-- ── #10 草稿状态：给 recipes 加 status 字段 ─────────────────────────────────
-- 'published' = 正式发布（所有人可见）
-- 'draft'     = 草稿（只有作者和 admin 可见）
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published'
  CHECK (status IN ('published','draft'));

-- ── #9 版本历史：新建 recipe_versions 表 ────────────────────────────────────
-- 每次保存菜谱时，把旧版本的完整快照存进来
CREATE TABLE IF NOT EXISTS recipe_versions (
  id           BIGSERIAL PRIMARY KEY,
  recipe_id    TEXT NOT NULL,
  snapshot     JSONB NOT NULL,        -- 完整的菜谱内容快照
  edited_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  edited_by_name TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_versions_recipe ON recipe_versions(recipe_id, created_at DESC);

-- RLS for recipe_versions
ALTER TABLE recipe_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read versions" ON recipe_versions;
CREATE POLICY "read versions" ON recipe_versions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert versions" ON recipe_versions;
CREATE POLICY "insert versions" ON recipe_versions
  FOR INSERT TO authenticated WITH CHECK (true);

-- 只保留每个菜谱最近 20 个版本（可选，防止表无限增长）
-- 这个触发器在插入新版本后，删除超过 20 个的旧版本
CREATE OR REPLACE FUNCTION trim_recipe_versions() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM recipe_versions
  WHERE recipe_id = NEW.recipe_id
    AND id NOT IN (
      SELECT id FROM recipe_versions
      WHERE recipe_id = NEW.recipe_id
      ORDER BY created_at DESC
      LIMIT 20
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_trim_versions ON recipe_versions;
CREATE TRIGGER trg_trim_versions AFTER INSERT ON recipe_versions
  FOR EACH ROW EXECUTE FUNCTION trim_recipe_versions();
