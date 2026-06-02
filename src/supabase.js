import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── Auth helpers — username-based login (under the hood: username@restaurant.local) ──
const usernameToEmail = (username) => `${username.trim().toLowerCase()}@restaurant.local`;

export async function signIn(username, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

// Helper: race a promise against a timeout
const withTimeout = (promise, ms, label) => Promise.race([
  promise,
  new Promise((_, rej) => setTimeout(() => rej(new Error(`${label||'request'} timed out after ${ms}ms`)), ms)),
]);

export async function getCurrentProfile() {
  try {
    const { data: { session } } = await withTimeout(supabase.auth.getSession(), 2500, 'getSession');
    if (!session?.user) return null;
    const userId = session.user.id;
    const { data: profile, error } = await withTimeout(
      supabase.from('profiles').select('*').eq('id', userId).single(),
      2500, 'profile query'
    );
    if (error) { console.error('Profile fetch error:', error); return null; }
    return {
      id: userId,
      username: profile.username,
      name: profile.display_name || profile.username || 'User',
      role: profile.role,
    };
  } catch (e) {
    console.error('getCurrentProfile timeout/error:', e);
    return null;
  }
}

// ── Recipes ─────────────────────────────────────────────────────────────────
export async function fetchAllRecipes() {
  const { data, error } = await supabase
    .from('recipes')
    .select('id, hu_name, en_name, category, section, serves, prep_time, cook_time, pack_spec, shelf_life, vacuum_level, author_name, cover_image, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(toClientRecipe);
}

export async function fetchRecipeById(id) {
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data ? toClientRecipe(data) : null;
}

export async function upsertRecipe(recipe) {
  const row = toDbRecipe(recipe);
  const { data, error } = await supabase
    .from('recipes')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return toClientRecipe(data);
}

export async function deleteRecipe(id) {
  const { error } = await supabase.from('recipes').delete().eq('id', id);
  if (error) throw error;
}

// ── DB ↔ client field mapping ────────────────────────────────────────────────
function toClientRecipe(r) {
  return {
    id: r.id,
    huName: r.hu_name || '',
    enName: r.en_name || '',
    category: r.category,
    section: r.section,
    serves: r.serves,
    prepTime: r.prep_time,
    cookTime: r.cook_time,
    packSpec: r.pack_spec || '',
    shelfLife: r.shelf_life || '',
    vacuumLevel: r.vacuum_level || '',
    author: r.author_name || '',
    authorId: r.author_id,
    coverImage: r.cover_image,
    ingredients: r.ingredients || [],
    steps: r.steps || [],
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
  };
}
function toDbRecipe(r) {
  return {
    id: r.id,
    hu_name: r.huName || '',
    en_name: r.enName || '',
    category: r.category || 0,
    section: r.section || 0,
    serves: r.serves || 4,
    prep_time: r.prepTime || 15,
    cook_time: r.cookTime || 30,
    pack_spec: r.packSpec || '',
    shelf_life: r.shelfLife || '',
    vacuum_level: r.vacuumLevel || '',
    author_id: r.authorId || null,
    author_name: r.author || '',
    cover_image: r.coverImage || null,
    ingredients: r.ingredients || [],
    steps: r.steps || [],
  };
}

// ── Users (admin only) ──────────────────────────────────────────────────────
export async function fetchAllUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(p => ({
    id: p.id,
    username: p.username,
    name: p.display_name,
    role: p.role,
  }));
}

export async function adminCreateUser({ username, password, name, role }) {
  const { data, error } = await supabase.rpc('admin_create_user', {
    p_username: username,
    p_password: password,
    p_display_name: name,
    p_role: role,
  });
  if (error) throw error;
  return data;
}

export async function adminChangePassword(userId, newPassword) {
  const { error } = await supabase.rpc('admin_change_password', {
    p_user_id: userId,
    p_new_password: newPassword,
  });
  if (error) throw error;
}

export async function adminDeleteUser(userId) {
  const { error } = await supabase.rpc('admin_delete_user', { p_user_id: userId });
  if (error) throw error;
}

// ── Audit log ───────────────────────────────────────────────────────────────
export async function logAction({ action, recipeId, recipeName, diff = {} }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const profile = await getCurrentProfile();
  await supabase.from('audit_log').insert({
    user_id: user.id,
    user_name: profile?.name || 'Unknown',
    action,
    recipe_id: recipeId,
    recipe_name: recipeName,
    diff,
  });
}

export async function fetchAuditLog(limit = 200) {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(e => ({
    id: e.id,
    ts: new Date(e.created_at).getTime(),
    userId: e.user_id,
    userName: e.user_name,
    action: e.action,
    recipeId: e.recipe_id,
    recipeName: e.recipe_name,
    diff: e.diff || {},
  }));
}
