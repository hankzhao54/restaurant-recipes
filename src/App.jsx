import { useState, useEffect, useRef, createContext, useContext } from "react";
import QRCode from "qrcode";
import {
  supabase,
  signIn, signOut, getCurrentProfile,
  fetchAllRecipes, fetchRecipeById, upsertRecipe, deleteRecipe, fetchRecipeVersions,
  fetchAllUsers, adminCreateUser, adminChangePassword, adminDeleteUser,
  logAction, fetchAuditLog,
  fetchCategories, upsertCategory, deleteCategory, nextCategoryId,
} from "./supabase.js";
import { resolveImage } from "./utils/image.js";

// ── Category context (DB-backed, editable) ────────────────────────────────────
const CatCtx = createContext([]);
function catLabel(cats, id, lang){ const c=(cats||[]).find(x=>x.id===id); return c?(lang==="en"?c.nameEn:c.nameHu):"—"; }
function catColor(cats, id){ const c=(cats||[]).find(x=>x.id===id); return c?c.color:"#a8833f"; }

// ── i18n — EN (primary) + HU only ────────────────────────────────────────────
const T = {
  en: {
    appName:"101 Kitchen Recipes", tagline:"Restaurant Recipe Management",
    login:"Login", logout:"Log out", username:"Username", password:"Password",
    loginBtn:"Sign In", wrongCreds:"Incorrect username or password",
    search:"Search recipes…", searchHint:"Search by name or ingredient…", allCats:"All",
    favorites:"Favorites", noFaves:"No favorites yet — tap ☆ on any recipe",
    addRecipe:"New Recipe", newRecipe:"New Recipe", editRecipe:"Edit Recipe",
    recipeName:"Recipe Name", recipeName_hu:"Hungarian Name (optional)",
    category:"Category", serves:"Serves", prepTime:"Prep (min)", cookTime:"Cook (min)",
    mins:"min", portions:"portions",
    packSpec:"Pack Size", shelfLife:"Shelf Life", vacuumLevel:"Vacuum Level",
    ingredients:"Ingredients", ingredientName:"Ingredient name", ingredientQty:"Quantity",
    addIngredient:"+ Add Ingredient",
    steps:"Steps", stepDesc:"Describe this step…", addStep:"+ Add Step",
    publish:"Save & Publish", saveDraft:"Save Draft", cancel:"Cancel", by:"By",
    oneLanguageHint:"Tip: fill just one language if you like — the other will copy it automatically.",
    recentlyViewed:"Recently viewed", sortBy:"Sort", sortDefault:"Newest", sortName:"Name", sortRecent:"Recent",
    prepList:"Prep List", addToPrep:"Add to prep list", prepListHint:"Select recipes and quantities — ingredients are totalled below.", prepEmpty:"No recipes added. Tap 🧾 on any recipe card.", totalIngredients:"Total ingredients", copyList:"Copy list", clearAll:"Clear all",
    duplicate:"Duplicate", usedIn:"Used in", stats:"Statistics", exportData:"Export", allergens:"Allergens",
    qrHint:"Scan to open this recipe", print:"Print", manageCats:"Categories", addCategory:"Add category",
    allergenLabels:{gluten:"Gluten",crustacean:"Crustaceans",egg:"Egg",fish:"Fish",peanut:"Peanut",soy:"Soy",milk:"Milk",nut:"Tree nuts",celery:"Celery",mustard:"Mustard",sesame:"Sesame",sulphite:"Sulphites",lupin:"Lupin",mollusc:"Molluscs"},
    draftBadge:"DRAFT", history:"History", versionHistory:"Version History",
    noVersions:"No previous versions", restoreVersion:"Restore this version", restored:"✓ Version restored", current:"Current", editedBy:"edited by",
    categories:["Sauce / Marinade","Cold Dish","Stock / Soup","Staple / Noodle","Dessert / Bread","Fermented / Spice"],
    catLabels:["Sauce","Cold","Soup","Staple","Dessert","Fermented"],
    catColors:["#a8833f","#7d9b6a","#d08c43","#b5703a","#a86a85","#5b9189"],
    roles:{admin:"Admin",chef:"Chef",staff:"Staff"},
    noResults:"No recipes found", back:"← Back", saving:"Saving…",
    confirmDelete:"Delete this recipe? This cannot be undone.",
    yes:"Yes, delete", no:"Keep it",
    coverPhoto:"Cover Photo", cost:"Cost tracking (DB integration pending)",
    uploadHint:"Click or drag to upload", required:"Recipe name is required",
    stepPhoto:"Step photo", ingredientPhoto:"Photo",
    hints:"Accounts: admin / admin123 · chef / chef123 · staff / staff123",
    originalName:"HU:",
    sections:{1:"Stocks",2:"Sauces & Marinades",3:"Meat & Poultry",4:"Pastry & Bread",
              5:"Dumplings",6:"Fermented",7:"Sides",8:"Noodles",9:"Chilli Oils & Spices",10:"Other"},
  },
  hu: {
    appName:"101 Konyhai Receptek", tagline:"Éttermi Recept Kezelés",
    login:"Bejelentkezés", logout:"Kijelentkezés",
    username:"Felhasználónév", password:"Jelszó",
    loginBtn:"Belépés", wrongCreds:"Hibás felhasználónév vagy jelszó",
    search:"Receptek keresése…", searchHint:"Keresés név vagy hozzávaló szerint…", allCats:"Összes",
    favorites:"Kedvencek", noFaves:"Még nincs kedvenc — koppints a ☆ jelre",
    addRecipe:"Új Recept", newRecipe:"Új Recept", editRecipe:"Recept szerkesztése",
    recipeName:"Recept neve (HU)", recipeName_hu:"",
    category:"Kategória", serves:"Adag", prepTime:"Előkészítés (perc)", cookTime:"Főzés (perc)",
    mins:"perc", portions:"adag",
    packSpec:"Kiszerelés", shelfLife:"Eltarthatóság", vacuumLevel:"Vákuum szint",
    ingredients:"Hozzávalók", ingredientName:"Hozzávaló neve", ingredientQty:"Mennyiség",
    addIngredient:"+ Hozzávaló hozzáadása",
    steps:"Lépések", stepDesc:"Írja le a lépést…", addStep:"+ Lépés hozzáadása",
    publish:"Mentés & Közzétesz", saveDraft:"Piszkozat mentése", cancel:"Mégsem", by:"Készítette",
    oneLanguageHint:"Tipp: elég csak az egyik nyelvet kitölteni — a másik automatikusan átmásolódik.",
    recentlyViewed:"Nemrég megtekintett", sortBy:"Rendezés", sortDefault:"Legújabb", sortName:"Név", sortRecent:"Legutóbbi",
    prepList:"Előkészítő lista", addToPrep:"Hozzáadás", prepListHint:"Válassz recepteket és mennyiséget — a hozzávalók lent összesítve.", prepEmpty:"Nincs recept. Koppints a 🧾 ikonra.", totalIngredients:"Összes hozzávaló", copyList:"Lista másolása", clearAll:"Összes törlése",
    duplicate:"Másolat", usedIn:"Felhasználva", stats:"Statisztika", exportData:"Exportálás", allergens:"Allergének",
    qrHint:"Szkenneld be a recept megnyitásához", print:"Nyomtatás", manageCats:"Kategóriák", addCategory:"Kategória hozzáadása",
    allergenLabels:{gluten:"Glutén",crustacean:"Rákfélék",egg:"Tojás",fish:"Hal",peanut:"Földimogyoró",soy:"Szója",milk:"Tej",nut:"Diófélék",celery:"Zeller",mustard:"Mustár",sesame:"Szezám",sulphite:"Szulfitok",lupin:"Csillagfürt",mollusc:"Puhatestűek"},
    draftBadge:"PISZKOZAT", history:"Előzmények", versionHistory:"Verzió előzmények",
    noVersions:"Nincs korábbi verzió", restoreVersion:"Verzió visszaállítása", restored:"✓ Verzió visszaállítva", current:"Jelenlegi", editedBy:"szerkesztette",
    categories:["Szósz / Marinád","Hideg étel","Alaplé / Leves","Tészta / Főétel","Desszert / Kenyér","Fermentált / Fűszer"],
    catLabels:["Szósz","Hideg","Leves","Tészta","Desszert","Fermentált"],
    catColors:["#a8833f","#7d9b6a","#d08c43","#b5703a","#a86a85","#5b9189"],
    roles:{admin:"Admin",chef:"Szakács",staff:"Alkalmazott"},
    noResults:"Nem találhatók receptek", back:"← Vissza", saving:"Mentés…",
    confirmDelete:"Törli ezt a receptet? Ez nem vonható vissza.",
    yes:"Igen, törlöm", no:"Mégtartom",
    coverPhoto:"Borítófotó", cost:"Költségkövetés (DB integráció folyamatban)",
    uploadHint:"Kattintson vagy húzzon ide", required:"A recept neve kötelező",
    stepPhoto:"Lépés fotója", ingredientPhoto:"Fotó",
    hints:"Tesztfiókok: admin / admin123 · chef / chef123 · staff / staff123",
    originalName:"EN:",
    sections:{1:"Alaplevek",2:"Szószok & Marinádok",3:"Húsételek",4:"Péksütemény",
              5:"Gombóc / Dumpling",6:"Fermentált",7:"Köretek",8:"Tészták",9:"Chilli olaj & Fűszerek",10:"Egyéb"},
  },
};


const EMOJIS=["🥘","🥗","🍜","🍚","🍮","🧆","🍗","🫕","🍱","🍲","🥩","🫙","🌶","🧄","🥟"];
const ALLERGEN_KEYS=["gluten","crustacean","egg","fish","peanut","soy","milk","nut","celery","mustard","sesame","sulphite","lupin","mollusc"];
const C={bg:"#f2ede1",card:"#fbf9f3",dark:"#1d2722",gold:"#a8833f",goldL:"#c6a45c",goldD:"#7c5f2a",text:"#20211c",muted:"#8b8576",border:"#e6dfce",danger:"#b0473f"};
const FONT="'Hanken Grotesk','Noto Serif SC',sans-serif";
const FONTH="'Cormorant Garamond','Noto Serif SC',serif";
const uid=()=>Math.random().toString(36).slice(2,9);

function LangSwitcher({lang,setLang}){
  return <div style={{display:"flex",gap:3}}>
    {["en","hu"].map(l=>(
      <button key={l} onClick={()=>setLang(l)} style={{
        padding:"3px 10px",borderRadius:20,border:`1px solid ${C.gold}`,
        fontSize:11,cursor:"pointer",fontFamily:FONT,letterSpacing:1,fontWeight:"bold",
        background:lang===l?C.gold:"transparent",
        color:lang===l?C.dark:C.gold,transition:"all .15s",
      }}>{l.toUpperCase()}</button>
    ))}
  </div>;
}

function TopBar({t,lang,setLang,user,onLogout,left}){
  return <div style={{background:C.dark,height:54,padding:"0 16px",display:"flex",
    alignItems:"center",justifyContent:"space-between",flexShrink:0,
    borderBottom:`2px solid ${C.gold}`,boxShadow:"0 2px 14px rgba(0,0,0,.35)"}}>
    <div style={{minWidth:100,display:"flex",alignItems:"center"}}>{left}</div>
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <LangSwitcher lang={lang} setLang={setLang}/>
      {user&&<>
        <div style={{width:28,height:28,borderRadius:"50%",background:`linear-gradient(135deg,${C.gold},${C.goldL})`,
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:C.dark,fontWeight:"bold"}}>
          {user.name[0]}
        </div>
        <span style={{color:"#e0b39a",fontSize:11,maxWidth:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</span>
        <button onClick={onLogout} style={{background:"transparent",border:`1px solid rgba(168,131,63,.35)`,
          color:"#9c7a3c",fontSize:11,padding:"4px 10px",borderRadius:6,cursor:"pointer",fontFamily:FONT}}>
          {t.logout}
        </button>
      </>}
    </div>
  </div>;
}

// ── Personal favorites (stored locally per browser/device) ────────────────────
const FAVES = {
  key: "fav-recipes",
  get(){ try{ return new Set(JSON.parse(localStorage.getItem(this.key)||"[]")); }catch{ return new Set(); } },
  toggle(id){
    const s=this.get();
    if(s.has(id)) s.delete(id); else s.add(id);
    try{ localStorage.setItem(this.key, JSON.stringify([...s])); }catch{}
    return s;
  },
};

// ── Recently viewed (stored locally per device) ──────────────────────────────
const RECENT = {
  key: "recent-recipes",
  get(){ try{ return JSON.parse(localStorage.getItem(this.key)||"[]"); }catch{ return []; } },
  push(id){
    let arr=this.get().filter(x=>x!==id);
    arr.unshift(id);
    arr=arr.slice(0,8);
    try{ localStorage.setItem(this.key, JSON.stringify(arr)); }catch{}
    return arr;
  },
};

function imgSrc(v){return v?(typeof v==="string"?v:v.preview):null;}
function ImageUpload({value,onChange,size="md",t}){
  const ref=useRef();
  const [drag,setDrag]=useState(false);
  const [hov,setHov]=useState(false);
  const h=size==="sm"?68:size==="cover"?175:100;
  const w=size==="sm"?76:"100%";
  const handle=async f=>{
    if(!f||!f.type.startsWith("image/"))return;
    // Generate a quick local preview; upload happens on Save
    const reader=new FileReader();
    reader.onload=e=>onChange({preview:e.target.result,file:f});
    reader.readAsDataURL(f);
  };
  return <div style={{width:w}}>
    <input ref={ref} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handle(e.target.files[0])}/>
    {value
      ?<div style={{position:"relative",width:w,height:h,borderRadius:10,overflow:"hidden",border:`1px solid ${C.border}`}}
          onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}>
          <img src={imgSrc(value)} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
          {hov&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.46)",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
            <button onClick={()=>ref.current.click()} style={{padding:"4px 10px",background:"#4a90c4",border:"none",borderRadius:5,color:"#fff",fontSize:11,cursor:"pointer"}}>✎</button>
            <button onClick={()=>onChange(null)} style={{padding:"4px 10px",background:C.danger,border:"none",borderRadius:5,color:"#fff",fontSize:11,cursor:"pointer"}}>✕</button>
          </div>}
        </div>
      :<div onClick={()=>ref.current.click()}
          onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)}
          onDrop={e=>{e.preventDefault();setDrag(false);handle(e.dataTransfer.files[0]);}}
          style={{width:w,height:h,borderRadius:10,boxSizing:"border-box",
            border:`2px dashed ${drag?C.gold:"#ddd"}`,background:drag?"rgba(168,131,63,.07)":"rgba(0,0,0,.02)",
            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",gap:5}}>
          <span style={{fontSize:size==="sm"?20:26,opacity:.3}}>📷</span>
          {size!=="sm"&&<span style={{fontSize:10,color:C.muted}}>{t.uploadHint}</span>}
        </div>}
  </div>;
}

const inputSt={width:"100%",boxSizing:"border-box",padding:"9px 11px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:13,fontFamily:FONT,color:C.text,background:"#fff",outline:"none"};
const backSt={background:"transparent",border:"none",color:C.gold,fontSize:14,cursor:"pointer",fontFamily:FONT};
function Field({label,children}){
  return <div style={{marginBottom:16}}>
    <label style={{display:"block",fontSize:10,color:"#9c7a3c",letterSpacing:2,marginBottom:6,textTransform:"uppercase"}}>{label}</label>
    {children}
  </div>;
}
function SI(props){return <input {...props} style={{...inputSt,...(props.style||{})}}/>;}
function SHead({title,color}){
  return <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:13}}>
    <div style={{width:4,height:20,background:color,borderRadius:2}}/>
    <h2 style={{margin:0,fontSize:21,fontFamily:FONTH,color:C.text,fontWeight:"bold"}}>{title}</h2>
  </div>;
}

function getName(recipe, lang){
  return lang==="en" ? (recipe.enName||recipe.huName||"") : (recipe.huName||recipe.enName||"");
}
function getAltName(recipe, lang){
  return lang==="en" ? (recipe.huName||"") : (recipe.enName||"");
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function LoginScreen({t,lang,setLang,form,setForm,doLogin,err,loading}){
  return <div style={{minHeight:"100vh",background:C.dark,display:"flex",flexDirection:"column",
    alignItems:"center",justifyContent:"center",fontFamily:FONT,
    backgroundImage:`radial-gradient(ellipse at 55% 35%,#232b26,${C.dark})`}}>
    <div style={{position:"absolute",top:0,left:0,right:0,height:3,
      background:`linear-gradient(90deg,${C.goldD},${C.gold},${C.goldL},${C.gold},${C.goldD})`}}/>
    <div style={{position:"absolute",top:14,right:18}}><LangSwitcher lang={lang} setLang={setLang}/></div>
    <div style={{textAlign:"center",marginBottom:36}}>
      <div style={{fontSize:50}}>🍽</div>
      <div style={{fontSize:36,fontFamily:FONTH,fontWeight:"bold",letterSpacing:1,color:C.goldL,
        textShadow:`0 2px 16px rgba(168,131,63,.45)`,marginTop:8}}>{t.appName}</div>
      <div style={{fontSize:11,color:C.goldD,letterSpacing:3,marginTop:5,textTransform:"uppercase"}}>{t.tagline}</div>
      <div style={{width:100,height:1,background:`linear-gradient(90deg,transparent,${C.gold},transparent)`,margin:"14px auto 0"}}/>
    </div>
    <div style={{background:"rgba(255,255,255,.04)",border:`1px solid rgba(168,131,63,.22)`,
      borderRadius:18,padding:"32px 36px",width:300,boxSizing:"border-box",
      backdropFilter:"blur(12px)",boxShadow:"0 22px 60px rgba(0,0,0,.55)"}}>
      {["username","password"].map(f=><div key={f} style={{marginBottom:15}}>
        <label style={{display:"block",fontSize:10,color:C.goldD,letterSpacing:2,marginBottom:5,textTransform:"uppercase"}}>{t[f]}</label>
        <input type={f==="password"?"password":"text"} value={form[f]}
          onChange={e=>setForm(p=>({...p,[f]:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&doLogin()}
          style={{width:"100%",boxSizing:"border-box",background:"rgba(255,255,255,.07)",
            border:`1px solid rgba(168,131,63,.3)`,borderRadius:8,padding:"10px 13px",
            color:"#f2e7df",fontSize:14,fontFamily:FONT,outline:"none"}}/>
      </div>)}
      {err&&<div style={{color:"#e06060",fontSize:12,marginBottom:11,textAlign:"center"}}>{err}</div>}
      <button onClick={doLogin} disabled={loading} style={{opacity:loading?0.5:1,width:"100%",padding:"12px 0",
        background:`linear-gradient(135deg,${C.gold},${C.goldL})`,
        border:"none",borderRadius:9,color:C.dark,fontWeight:"bold",fontSize:15,
        cursor:"pointer",letterSpacing:2,fontFamily:FONT,
        boxShadow:`0 4px 20px rgba(168,131,63,.38)`}}>{loading?"…":t.loginBtn}</button>
      <div style={{marginTop:15,fontSize:10,color:"rgba(160,128,64,.5)",textAlign:"center",lineHeight:1.8}}>{t.hints}</div>
    </div>
  </div>;
}

// ── LIST ──────────────────────────────────────────────────────────────────────
function ListScreen({t,lang,setLang,user,onLogout,recipes,allStubs,search,setSearch,activeCat,setActiveCat,onSelect,onAdd,canEdit,isAdmin,onAdmin,faves,toggleFave,favesOnly,setFavesOnly,totalCount,sortBy,setSortBy,recentIds,prepList,setPrepList,onOpenPrep}){
  const cats=useContext(CatCtx);
  const faveCount=faves?faves.size:0;
  const inPrep=id=>prepList.some(p=>p.id===id);
  const togglePrep=id=>setPrepList(prev=>inPrep(id)?prev.filter(p=>p.id!==id):[...prev,{id,mult:1}]);
  // Recently viewed (resolve ids → stubs, keep order)
  const recentRecipes=(recentIds||[]).map(id=>allStubs.find(r=>r.id===id)).filter(Boolean).slice(0,6);
  return <div style={{minHeight:"100vh",background:C.bg,fontFamily:FONT,display:"flex",flexDirection:"column"}}>
    <TopBar t={t} lang={lang} setLang={setLang} user={user} onLogout={onLogout}
      left={<span style={{color:C.goldL,fontWeight:"bold",fontSize:14,letterSpacing:1}}>🍽 {t.appName}</span>}/>
    <div style={{maxWidth:1040,margin:"0 auto",padding:"20px 16px 52px",width:"100%",boxSizing:"border-box"}}>
      {/* Search + new */}
      <div style={{display:"flex",gap:10,marginBottom:14}}>
        <div style={{flex:1,position:"relative"}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",opacity:.4,fontSize:16}}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={t.searchHint}
            style={{...inputSt,paddingLeft:36,boxShadow:"0 2px 9px rgba(0,0,0,.07)"}}/>
        </div>
        {prepList.length>0&&<button onClick={onOpenPrep} style={{padding:"9px 14px",
          background:"#3d7a52",border:"none",borderRadius:10,color:"#fff",fontWeight:"bold",
          fontSize:13,cursor:"pointer",fontFamily:FONT,whiteSpace:"nowrap"}}>🧾 {t.prepList} ({prepList.length})</button>}
        {isAdmin&&<button onClick={onAdmin} style={{padding:"9px 14px",
          background:"transparent",border:`1px solid ${C.gold}`,
          borderRadius:10,color:C.gold,fontWeight:"bold",
          fontSize:13,cursor:"pointer",fontFamily:FONT,whiteSpace:"nowrap"}}>⚙ Admin</button>}
        {canEdit&&<button onClick={onAdd} style={{padding:"9px 18px",
          background:`linear-gradient(135deg,${C.gold},${C.goldL})`,
          border:"none",borderRadius:10,color:C.dark,fontWeight:"bold",
          fontSize:13,cursor:"pointer",fontFamily:FONT,whiteSpace:"nowrap",
          boxShadow:`0 2px 10px rgba(168,131,63,.32)`}}>+ {t.addRecipe}</button>}
      </div>
      {/* Recently viewed */}
      {recentRecipes.length>0&&!search&&!favesOnly&&activeCat===-1&&<div style={{marginBottom:18}}>
        <div style={{fontSize:11,color:C.muted,letterSpacing:1,marginBottom:8,textTransform:"uppercase"}}>🕘 {t.recentlyViewed}</div>
        <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4}}>
          {recentRecipes.map(r=>(
            <button key={r.id} onClick={()=>onSelect(r)} style={{flexShrink:0,padding:"7px 13px",
              background:C.card,border:`1px solid ${C.border}`,borderRadius:20,fontSize:12,
              color:C.text,cursor:"pointer",fontFamily:FONT,whiteSpace:"nowrap",maxWidth:170,
              overflow:"hidden",textOverflow:"ellipsis"}}>
              {lang==="en"?(r.enName||r.huName):(r.huName||r.enName)}
            </button>
          ))}
        </div>
      </div>}
      {/* Sort row */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
        <span style={{fontSize:11,color:C.muted}}>{t.sortBy}:</span>
        {[["default",t.sortDefault],["name",t.sortName],["recent",t.sortRecent]].map(([k,l])=>(
          <button key={k} onClick={()=>setSortBy(k)} style={{padding:"4px 11px",borderRadius:14,
            border:`1px solid ${sortBy===k?C.gold:C.border}`,background:sortBy===k?C.gold:"transparent",
            color:sortBy===k?C.dark:C.muted,fontSize:11,cursor:"pointer",fontFamily:FONT,
            fontWeight:sortBy===k?"bold":"normal"}}>{l}</button>
        ))}
      </div>
      {/* Category chips + favorites toggle */}
      <div style={{display:"flex",gap:7,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
        <button onClick={()=>setFavesOnly(f=>!f)} style={{padding:"5px 14px",borderRadius:20,cursor:"pointer",
          fontFamily:FONT,fontSize:12,border:`1px solid ${favesOnly?"#c6a45c":"#b8954e"}`,
          background:favesOnly?"#c6a45c":"transparent",color:favesOnly?C.dark:"#a8833f",
          fontWeight:"bold",transition:"all .15s"}}>
          ★ {t.favorites} ({faveCount})
        </button>
        <div style={{width:1,height:20,background:C.border,margin:"0 3px"}}/>
        <Chip label={`${t.allCats} (${favesOnly?recipes.length:totalCount})`} active={activeCat===-1&&!favesOnly} color="#888" onClick={()=>{setActiveCat(-1);}}/>
        {cats.map(c=>{
          const cnt=recipes.filter(r=>r.category===c.id).length;
          return cnt>0?<Chip key={c.id} label={`${lang==="en"?c.nameEn:c.nameHu} (${cnt})`} active={activeCat===c.id} color={c.color} onClick={()=>setActiveCat(c.id)}/>:null;
        })}
      </div>
      {/* Grid */}
      {recipes.length===0
        ?<div style={{textAlign:"center",padding:"70px 0",color:C.muted,fontSize:16}}>
          {favesOnly?t.noFaves:t.noResults}
        </div>
        :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(205px,1fr))",gap:15}}>
          {recipes.map(r=><RecipeCard key={r.id} recipe={r} t={t} lang={lang} onClick={()=>onSelect(r)} isFave={faves&&faves.has(r.id)} onToggleFave={()=>toggleFave(r.id)} inPrep={inPrep(r.id)} onTogglePrep={()=>togglePrep(r.id)}/>)}
        </div>}
    </div>
  </div>;
}

function Chip({label,active,color,onClick}){
  return <button onClick={onClick} style={{padding:"5px 14px",borderRadius:20,cursor:"pointer",
    fontFamily:FONT,fontSize:12,border:`1px solid ${color}`,
    background:active?color:"transparent",color:active?"#fff":color,transition:"all .15s"}}>
    {label}
  </button>;
}

function RecipeCard({recipe,t,lang,onClick,isFave,onToggleFave,inPrep,onTogglePrep}){
  const cats=useContext(CatCtx);
  const [hov,setHov]=useState(false);
  const col=catColor(cats,recipe.category);
  const emo=EMOJIS[(recipe.id?.charCodeAt?.(recipe.id.length-1)||0)%EMOJIS.length];
  const name=getName(recipe,lang);
  const alt=getAltName(recipe,lang);
  return <div onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
    style={{background:C.card,borderRadius:14,overflow:"hidden",cursor:"pointer",
      border:`1px solid ${C.border}`,transition:"all .2s",
      boxShadow:hov?"0 14px 34px -10px rgba(168,131,63,.30)":"0 1px 3px rgba(40,30,15,.05),0 8px 22px -14px rgba(40,30,15,.18)",
      transform:hov?"translateY(-3px)":"none"}}>
    <div style={{height:115,overflow:"hidden",position:"relative",background:`linear-gradient(135deg,${col}18,${col}38)`}}>
      {recipe.coverImage
        ?<img src={recipe.coverImage} alt={name} loading="lazy" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
        :<div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3}}><span style={{fontFamily:FONTH,fontSize:42,fontWeight:"bold",color:col,opacity:.42,lineHeight:1}}>{(name||"·")[0]}</span><span style={{fontSize:8,letterSpacing:2,textTransform:"uppercase",color:col,opacity:.42,fontWeight:"bold"}}>Photo</span></div>}
      <span style={{position:"absolute",top:7,left:7,padding:"2px 9px",borderRadius:10,
        fontSize:10,background:`${col}dd`,color:"#fff",fontWeight:"bold"}}>
        {catLabel(cats,recipe.category,lang)}
      </span>
      {/* Favorite star */}
      <button onClick={e=>{e.stopPropagation();onToggleFave&&onToggleFave();}}
        title="Favorite"
        style={{position:"absolute",top:6,right:6,width:30,height:30,borderRadius:"50%",
          border:"none",cursor:"pointer",fontSize:16,lineHeight:1,
          display:"flex",alignItems:"center",justifyContent:"center",
          background:isFave?"rgba(232,184,75,.95)":"rgba(0,0,0,.35)",
          color:isFave?"#211f1c":"#fff",transition:"all .15s",padding:0}}>
        {isFave?"★":"☆"}
      </button>
      {/* Add to prep list */}
      <button onClick={e=>{e.stopPropagation();onTogglePrep&&onTogglePrep();}}
        title={t.addToPrep}
        style={{position:"absolute",top:6,right:42,width:30,height:30,borderRadius:"50%",
          border:"none",cursor:"pointer",fontSize:15,lineHeight:1,
          display:"flex",alignItems:"center",justifyContent:"center",
          background:inPrep?"rgba(61,122,82,.95)":"rgba(0,0,0,.35)",
          color:"#fff",transition:"all .15s",padding:0}}>
        {inPrep?"✓":"🧾"}
      </button>
      {recipe.status==="draft"&&<span style={{position:"absolute",bottom:7,right:7,
        padding:"2px 8px",borderRadius:7,fontSize:10,fontWeight:"bold",letterSpacing:1,
        background:"rgba(192,129,61,.95)",color:"#fff"}}>{t.draftBadge}</span>}
    </div>
    <div style={{padding:"11px 13px"}}>
      <div style={{fontSize:19,fontFamily:FONTH,fontWeight:"bold",color:C.text,lineHeight:1.2,
        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:2}}>{name}</div>
      {alt&&<div style={{fontSize:10,color:C.muted,overflow:"hidden",textOverflow:"ellipsis",
        whiteSpace:"nowrap",marginBottom:4}}>{alt}</div>}
      <div style={{display:"flex",gap:11,fontSize:11,color:C.muted}}>
        {recipe.packSpec&&<span>📦 {recipe.packSpec}</span>}
        {recipe.vacuumLevel&&<span>🔧 {recipe.vacuumLevel}</span>}
      </div>
    </div>
  </div>;
}

// ── DETAIL ────────────────────────────────────────────────────────────────────
// Smart scale a quantity string. Returns the original if no number detected.
// Recognises: "500 g", "1.5 kg", "1,5 l", "1/2 cup", "2db", "1 ek", "10ml"
function scaleQty(qty, multiplier) {
  if (!qty || multiplier === 1) return qty;
  const trimmed = String(qty).trim();
  // Match leading number (int / decimal / fraction), optional space, then the rest
  // Accept both . and , as decimal separators
  const m = trimmed.match(/^(\d+\s*\/\s*\d+|\d+[.,]\d+|\d+)(\s*.*)$/);
  if (!m) return qty;
  let n;
  if (m[1].includes('/')) {
    const [a,b] = m[1].split('/').map(s => parseFloat(s.replace(',','.')));
    if (!b) return qty;
    n = a / b;
  } else {
    n = parseFloat(m[1].replace(',', '.'));
  }
  if (!isFinite(n)) return qty;
  const scaled = n * multiplier;
  // Pretty-print: integers without decimals, otherwise up to 2 decimals
  const pretty = Number.isInteger(scaled) ? String(scaled)
    : scaled < 10 ? scaled.toFixed(2).replace(/\.?0+$/, '')
    : scaled.toFixed(1).replace(/\.0$/, '');
  return pretty + m[2];
}

function DetailScreen({t,lang,setLang,recipe,loading,user,canEdit,onBack,onEdit,onDelete,onHistory,onDuplicate,onZoom,allStubs,onSearchIngredient}){
  const cats=useContext(CatCtx);
  const [cdel,setCdel]=useState(false);
  const [trans,setTrans]=useState(null);       // translated ings + steps
  const [multiplier,setMultiplier]=useState(1);
  const [showQR,setShowQR]=useState(false);

  if(!recipe&&!loading)return null;
  const col=recipe?catColor(cats,recipe.category):C.gold;
  const emo=recipe?EMOJIS[(recipe.id?.charCodeAt?.(recipe.id.length-1)||0)%EMOJIS.length]:"🍲";
  const isOwner=canEdit&&(user?.id===recipe?.authorId||user?.role==="admin");
  const name=recipe?getName(recipe,lang):"";
  const alt=recipe?getAltName(recipe,lang):"";

  // Local bilingual + apply multiplier to quantities
  const displayIngs=(recipe?.ingredients||[]).map(i=>({
    ...i,
    name:lang==="en"?(i.enName||i.name):i.name,
    qty:scaleQty(i.qty, multiplier),
  }));
  const displaySteps=(recipe?.steps||[]).map(s=>({...s,desc:lang==="en"?(s.enDesc||s.desc):s.desc}));

  return <div style={{minHeight:"100vh",background:C.bg,fontFamily:FONT,display:"flex",flexDirection:"column"}}>
    <TopBar t={t} lang={lang} setLang={setLang} user={user} onLogout={()=>{}}
      left={<button onClick={onBack} style={backSt}>{t.back}</button>}/>
    {loading||!recipe
      ?<div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,fontSize:15}}>⏳</div>
      :<div style={{maxWidth:740,margin:"0 auto",padding:"24px 16px 64px",width:"100%",boxSizing:"border-box"}}>
          {/* Hero */}
          <div style={{borderRadius:20,height:200,overflow:"hidden",marginBottom:22,
            background:`linear-gradient(135deg,${col}22,${col}55)`,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:80,
            boxShadow:`0 8px 30px ${col}28`}}>
            {recipe.coverImage
              ?<img src={recipe.coverImage} alt={name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              :<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}><span style={{fontFamily:FONTH,fontSize:74,fontWeight:"bold",color:col,opacity:.38,lineHeight:1}}>{(name||"·")[0]}</span><span style={{fontSize:10,letterSpacing:3,textTransform:"uppercase",color:col,opacity:.42,fontWeight:"bold"}}>Dish photo</span></div>}
          </div>
          {/* Title */}
          <div style={{marginBottom:18}}>
            <span style={{display:"inline-block",padding:"3px 12px",borderRadius:12,fontSize:11,
              background:`${col}22`,color:col,border:`1px solid ${col}44`,marginBottom:8}}>
              {catLabel(cats,recipe.category,lang)}
              {recipe.section&&t.sections[recipe.section]?" · "+t.sections[recipe.section]:""}
            </span>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
              <div>
                <h1 style={{margin:"0 0 3px",fontSize:36,fontFamily:FONTH,color:C.text,lineHeight:1.08}}>
                  {name}
                  {recipe.status==="draft"&&<span style={{fontSize:12,fontWeight:"bold",color:"#fff",
                    background:"#a8833f",padding:"3px 9px",borderRadius:8,marginLeft:10,verticalAlign:"middle",
                    letterSpacing:1}}>{t.draftBadge}</span>}
                </h1>
                {alt&&<div style={{fontSize:13,color:C.muted}}>{t.originalName} {alt}</div>}
              </div>
              <div style={{display:"flex",gap:7,flexShrink:0,marginTop:4}}>
                <button onClick={()=>setShowQR(true)} title="QR" style={{padding:"6px 12px",border:`1px solid ${C.muted}`,borderRadius:7,background:"transparent",color:C.muted,fontSize:12,cursor:"pointer",fontFamily:FONT}}>⊞</button>
                {isOwner&&!cdel&&<>
                  <button onClick={onHistory} title={t.history} style={{padding:"6px 12px",border:`1px solid ${C.muted}`,borderRadius:7,background:"transparent",color:C.muted,fontSize:12,cursor:"pointer",fontFamily:FONT}}>🕘</button>
                  <button onClick={onDuplicate} title={t.duplicate} style={{padding:"6px 12px",border:`1px solid ${C.muted}`,borderRadius:7,background:"transparent",color:C.muted,fontSize:12,cursor:"pointer",fontFamily:FONT}}>⧉</button>
                  <button onClick={onEdit} style={{padding:"6px 12px",border:`1px solid ${C.gold}`,borderRadius:7,background:"transparent",color:C.gold,fontSize:12,cursor:"pointer",fontFamily:FONT}}>✎</button>
                  <button onClick={()=>setCdel(true)} style={{padding:"6px 12px",border:`1px solid ${C.danger}`,borderRadius:7,background:"transparent",color:C.danger,fontSize:12,cursor:"pointer",fontFamily:FONT}}>✕</button>
                </>}
              </div>
            </div>
            <div style={{color:C.muted,fontSize:12,marginTop:4}}>{t.by}: {recipe.author}</div>
            {/* Allergen badges */}
            {recipe.allergens&&recipe.allergens.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10}}>
              {recipe.allergens.map(a=>(
                <span key={a} style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:"bold",
                  background:"#fdeaea",color:"#c04040",border:"1px solid #f0c0c0"}}>
                  ⚠ {(t.allergenLabels&&t.allergenLabels[a])||a}
                </span>
              ))}
            </div>}
          </div>
          {showQR&&<QRModal recipe={recipe} name={name} t={t} onClose={()=>setShowQR(false)}/>}
          {cdel&&<div style={{background:"#fff5f5",border:"1px solid #fcc",borderRadius:11,padding:"14px 16px",marginBottom:18}}>
            <div style={{color:C.danger,fontSize:13,marginBottom:10}}>{t.confirmDelete}</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={onDelete} style={{padding:"6px 14px",background:C.danger,border:"none",borderRadius:7,color:"#fff",fontSize:12,cursor:"pointer",fontFamily:FONT}}>{t.yes}</button>
              <button onClick={()=>setCdel(false)} style={{padding:"6px 14px",background:"transparent",border:"1px solid #ccc",borderRadius:7,color:"#666",fontSize:12,cursor:"pointer",fontFamily:FONT}}>{t.no}</button>
            </div>
          </div>}
          {/* Stats */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:11,marginBottom:22}}>
            {[{i:"📦",l:t.packSpec,v:recipe.packSpec||"—"},
              {i:"🕐",l:t.shelfLife,v:recipe.shelfLife||"—"},
              {i:"🔧",l:t.vacuumLevel,v:recipe.vacuumLevel||"—"}
            ].map(s=><div key={s.l} style={{background:C.card,borderRadius:12,padding:"12px 8px",textAlign:"center",border:`1px solid ${C.border}`}}>
              <div style={{fontSize:20,marginBottom:3}}>{s.i}</div>
              <div style={{fontSize:14,fontWeight:"bold",color:C.text,wordBreak:"break-word"}}>{s.v}</div>
              <div style={{fontSize:10,color:C.muted,marginTop:2}}>{s.l}</div>
            </div>)}
          </div>
          <div style={{background:"rgba(168,131,63,.06)",border:"1px dashed rgba(168,131,63,.3)",
            borderRadius:9,padding:"9px 14px",marginBottom:24,color:"#9c7a3c",fontSize:11}}>💰 {t.cost}</div>
          {/* Ingredients */}
          {displayIngs.length>0&&<>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:13,flexWrap:"wrap",gap:8}}>
              <SHead title={t.ingredients} color={col}/>
              {/* Servings multiplier */}
              <div style={{display:"flex",alignItems:"center",gap:8,background:C.card,
                borderRadius:24,padding:"4px 6px 4px 14px",border:`1px solid ${C.border}`,
                boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}>
                <span style={{fontSize:11,color:C.muted}}>Scale</span>
                <button onClick={()=>setMultiplier(m=>Math.max(0.25,+(m-0.5).toFixed(2)))}
                  style={{width:26,height:26,borderRadius:"50%",border:`1px solid ${C.gold}`,
                    background:"transparent",color:C.gold,fontSize:14,cursor:"pointer",fontFamily:FONT,
                    display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>−</button>
                <input type="number" min="0.25" max="100" step="0.5" value={multiplier}
                  onChange={e=>{const v=parseFloat(e.target.value);if(isFinite(v)&&v>0)setMultiplier(v);}}
                  style={{width:46,padding:"4px 4px",border:`1px solid ${C.border}`,borderRadius:6,
                    fontSize:13,fontFamily:FONT,color:C.text,textAlign:"center",outline:"none"}}/>
                <span style={{fontSize:11,color:C.muted,fontWeight:"bold"}}>×</span>
                <button onClick={()=>setMultiplier(m=>+(m+0.5).toFixed(2))}
                  style={{width:26,height:26,borderRadius:"50%",border:`1px solid ${C.gold}`,
                    background:C.gold,color:C.dark,fontSize:14,cursor:"pointer",fontFamily:FONT,fontWeight:"bold",
                    display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>+</button>
                {multiplier!==1&&<button onClick={()=>setMultiplier(1)}
                  style={{padding:"4px 9px",background:"transparent",border:"none",
                    color:C.muted,fontSize:11,cursor:"pointer",fontFamily:FONT,textDecoration:"underline"}}>
                  reset
                </button>}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:10,marginBottom:28}}>
              {displayIngs.map((ing,i)=>(
                <div key={ing.id||i} style={{background:C.card,borderRadius:11,overflow:"hidden",border:`1px solid ${C.border}`,textAlign:"center"}}>
                  {ing.image
                    ?<img src={ing.image} alt={ing.name} onClick={()=>onZoom&&onZoom(ing.image)} style={{width:"100%",height:85,objectFit:"cover",display:"block",cursor:"zoom-in"}}/>
                    :<div style={{height:62,background:`${col}10`,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontFamily:FONTH,fontSize:26,fontWeight:"bold",color:col,opacity:.4}}>{(ing.name||"·")[0]}</span></div>}
                  <div style={{padding:"7px 8px"}}>
                    <div onClick={()=>onSearchIngredient&&onSearchIngredient(ing.name)}
                      title={t.usedIn}
                      style={{fontSize:12,fontWeight:"bold",color:C.text,lineHeight:1.3,cursor:"pointer",textDecoration:"underline dotted",textUnderlineOffset:2}}>{ing.name}</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:2}}>{ing.qty}</div>
                  </div>
                </div>
              ))}
            </div>
          </>}
          {/* Steps */}
          {displaySteps.length>0&&<>
            <SHead title={t.steps} color={col}/>
            
            {displaySteps.map((step,i)=>(
              <div key={step.id||i} style={{display:"flex",gap:12,marginBottom:15}}>
                <div style={{width:28,height:28,borderRadius:"50%",flexShrink:0,
                  background:`linear-gradient(135deg,${col},${col}bb)`,color:"#fff",
                  fontWeight:"bold",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",
                  boxShadow:`0 2px 8px ${col}38`}}>{i+1}</div>
                <div style={{flex:1}}>
                  <div style={{background:C.card,borderRadius:10,padding:"11px 14px",
                    border:`1px solid ${C.border}`,color:C.text,fontSize:14,lineHeight:1.68,
                    whiteSpace:"pre-wrap",marginBottom:step.image?8:0}}>{step.desc}</div>
                  {step.image&&<img src={step.image} alt={`step ${i+1}`} onClick={()=>onZoom&&onZoom(step.image)}
                    style={{width:"100%",borderRadius:10,display:"block",maxHeight:220,objectFit:"cover",border:`1px solid ${C.border}`,cursor:"zoom-in"}}/>}
                </div>
              </div>
            ))}
          </>}
        </div>}
  </div>;
}

// ── PREP LIST (今日备料清单) ────────────────────────────────────────────────
function PrepListScreen({t,lang,setLang,user,prepList,setPrepList,allStubs,onBack,onSelect}){
  const [loaded,setLoaded]=useState({}); // id -> full recipe
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    let cancel=false;
    (async()=>{
      setLoading(true);
      const out={};
      for(const p of prepList){
        try{ const r=await fetchRecipeById(p.id); if(r)out[p.id]=r; }catch{}
      }
      if(!cancel){setLoaded(out);setLoading(false);}
    })();
    return()=>{cancel=true;};
  },[prepList.map(p=>p.id).join(",")]);

  const nameFor=r=>lang==="en"?(r.enName||r.huName):(r.huName||r.enName);
  const setMult=(id,m)=>setPrepList(prev=>prev.map(p=>p.id===id?{...p,mult:Math.max(0.25,m)}:p));
  const remove=id=>setPrepList(prev=>prev.filter(p=>p.id!==id));

  // Aggregate ingredients across all selected recipes (×mult), merging same name+unit
  const agg={};
  for(const p of prepList){
    const r=loaded[p.id]; if(!r)continue;
    for(const ing of (r.ingredients||[])){
      const nm=lang==="en"?(ing.enName||ing.name):(ing.name||ing.enName);
      const scaled=scaleQty(ing.qty,p.mult);
      // Parse number+unit for merge
      const m=String(scaled||"").trim().match(/^(\d+[.,]?\d*)\s*(.*)$/);
      const key=nm.toLowerCase().trim();
      if(m){
        const num=parseFloat(m[1].replace(",",".")); const unit=(m[2]||"").trim();
        const mk=`${key}|${unit.toLowerCase()}`;
        if(!agg[mk])agg[mk]={name:nm,unit,num:0,nonNum:[]};
        agg[mk].num+=isFinite(num)?num:0;
      } else {
        const mk=`${key}|_`;
        if(!agg[mk])agg[mk]={name:nm,unit:"",num:null,nonNum:[]};
        agg[mk].nonNum.push(scaled);
      }
    }
  }
  const aggList=Object.values(agg).map(a=>{
    if(a.num!==null){
      const pretty=Number.isInteger(a.num)?String(a.num):a.num.toFixed(2).replace(/\.?0+$/,"");
      return {name:a.name, qty:`${pretty}${a.unit?" "+a.unit:""}`};
    }
    return {name:a.name, qty:a.nonNum.join(", ")};
  }).sort((x,y)=>x.name.localeCompare(y.name));

  return <div style={{minHeight:"100vh",background:C.bg,fontFamily:FONT,display:"flex",flexDirection:"column"}}>
    <TopBar t={t} lang={lang} setLang={setLang} user={user} onLogout={()=>{}}
      left={<button onClick={onBack} style={backSt}>{t.back}</button>}/>
    <div style={{maxWidth:820,margin:"0 auto",padding:"24px 16px 64px",width:"100%",boxSizing:"border-box"}}>
      <h2 style={{margin:"0 0 4px",fontSize:20,color:C.text}}>🧾 {t.prepList}</h2>
      <div style={{color:C.muted,fontSize:13,marginBottom:20}}>{t.prepListHint}</div>

      {prepList.length===0
        ?<div style={{textAlign:"center",padding:"50px 0",color:C.muted}}>{t.prepEmpty}</div>
        :<>
          {/* Selected recipes with multipliers */}
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:24}}>
            {prepList.map(p=>{
              const r=loaded[p.id];
              return <div key={p.id} style={{background:C.card,borderRadius:11,padding:"11px 14px",
                border:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <span onClick={()=>r&&onSelect(r)} style={{flex:1,minWidth:140,fontSize:14,fontWeight:"bold",
                  color:C.text,cursor:r?"pointer":"default"}}>
                  {r?nameFor(r):"…"}
                </span>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <button onClick={()=>setMult(p.id,+(p.mult-0.5).toFixed(2))} style={multBtn}>−</button>
                  <span style={{minWidth:42,textAlign:"center",fontSize:13,fontWeight:"bold",color:C.gold}}>{p.mult}×</span>
                  <button onClick={()=>setMult(p.id,+(p.mult+0.5).toFixed(2))} style={multBtn}>+</button>
                </div>
                <button onClick={()=>remove(p.id)} style={{padding:"4px 9px",background:"transparent",
                  border:"none",color:C.danger,fontSize:16,cursor:"pointer"}}>✕</button>
              </div>;
            })}
          </div>

          {/* Aggregated shopping list */}
          <div style={{fontSize:13,fontWeight:"bold",color:C.text,marginBottom:11,letterSpacing:1}}>
            📋 {t.totalIngredients} ({aggList.length})
          </div>
          {loading
            ?<div style={{textAlign:"center",padding:"30px 0",color:C.muted}}>⏳</div>
            :<div style={{background:C.card,borderRadius:12,border:`1px solid ${C.border}`,overflow:"hidden"}}>
              {aggList.map((a,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"10px 16px",
                  borderBottom:i<aggList.length-1?`1px solid ${C.border}`:"none",fontSize:14}}>
                  <span style={{color:C.text}}>{a.name}</span>
                  <span style={{color:C.gold,fontWeight:"bold"}}>{a.qty}</span>
                </div>
              ))}
            </div>}
          <div style={{display:"flex",gap:10,marginTop:18}}>
            <button onClick={()=>{
              const txt=aggList.map(a=>`${a.name}: ${a.qty}`).join("\n");
              navigator.clipboard?.writeText(txt);
            }} style={{padding:"9px 18px",background:C.gold,border:"none",borderRadius:9,
              color:C.dark,fontWeight:"bold",fontSize:13,cursor:"pointer",fontFamily:FONT}}>
              📋 {t.copyList}
            </button>
            <button onClick={()=>setPrepList([])} style={{padding:"9px 16px",background:"transparent",
              border:"1px solid #ccc",borderRadius:9,color:"#888",fontSize:13,cursor:"pointer",fontFamily:FONT}}>
              {t.clearAll}
            </button>
          </div>
        </>}
    </div>
  </div>;
}
const multBtn={width:26,height:26,borderRadius:"50%",border:`1px solid ${C.gold}`,background:"transparent",color:C.gold,fontSize:14,cursor:"pointer",fontFamily:FONT,display:"flex",alignItems:"center",justifyContent:"center",padding:0};

// ── VERSION HISTORY ───────────────────────────────────────────────────────────
function HistoryScreen({t,lang,setLang,user,recipe,versions,loading,onBack,onRestore}){
  const [confirmId,setConfirmId]=useState(null);
  const fmt=ts=>{const d=new Date(ts);return d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})+" "+d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});};
  const nameOf=r=>lang==="en"?(r.enName||r.huName):(r.huName||r.enName);

  return <div style={{minHeight:"100vh",background:C.bg,fontFamily:FONT,display:"flex",flexDirection:"column"}}>
    <TopBar t={t} lang={lang} setLang={setLang} user={user} onLogout={()=>{}}
      left={<button onClick={onBack} style={backSt}>{t.back}</button>}/>
    <div style={{maxWidth:740,margin:"0 auto",padding:"24px 16px 64px",width:"100%",boxSizing:"border-box"}}>
      <h2 style={{margin:"0 0 6px",fontSize:20,color:C.text}}>{t.versionHistory}</h2>
      <div style={{color:C.muted,fontSize:13,marginBottom:20}}>{recipe?nameOf(recipe):""}</div>

      {/* Current version */}
      {recipe&&<div style={{background:C.card,borderRadius:12,padding:"14px 16px",marginBottom:14,
        border:`2px solid ${C.gold}`}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
          <div>
            <span style={{fontSize:11,fontWeight:"bold",color:C.dark,background:C.gold,
              padding:"2px 9px",borderRadius:7,letterSpacing:1}}>{t.current}</span>
            <span style={{fontSize:14,fontWeight:"bold",color:C.text,marginLeft:10}}>{nameOf(recipe)}</span>
          </div>
          <span style={{fontSize:12,color:C.muted}}>
            {(recipe.ingredients||[]).length} ingredients · {(recipe.steps||[]).length} steps
          </span>
        </div>
      </div>}

      {loading
        ?<div style={{textAlign:"center",padding:"40px 0",color:C.muted}}>⏳</div>
        :versions.length===0
          ?<div style={{textAlign:"center",padding:"50px 0",color:C.muted,fontSize:15}}>{t.noVersions}</div>
          :<div style={{display:"flex",flexDirection:"column",gap:10}}>
            {versions.map(v=>(
              <div key={v.id} style={{background:C.card,borderRadius:12,padding:"14px 16px",border:`1px solid ${C.border}`}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
                  <div style={{flex:1,minWidth:160}}>
                    <div style={{fontSize:14,fontWeight:"bold",color:C.text}}>{nameOf(v.snapshot)}</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:3}}>
                      {fmt(v.ts)} · {t.editedBy} {v.editedByName}
                    </div>
                    <div style={{fontSize:11,color:C.muted,marginTop:2}}>
                      {(v.snapshot.ingredients||[]).length} ingredients · {(v.snapshot.steps||[]).length} steps
                    </div>
                  </div>
                  {confirmId===v.id
                    ?<div style={{display:"flex",gap:6,flexShrink:0}}>
                      <button onClick={()=>{onRestore(v.snapshot);setConfirmId(null);}}
                        style={{padding:"6px 13px",background:C.gold,border:"none",borderRadius:7,
                          color:C.dark,fontSize:12,fontWeight:"bold",cursor:"pointer",fontFamily:FONT}}>
                        {t.yes}
                      </button>
                      <button onClick={()=>setConfirmId(null)}
                        style={{padding:"6px 13px",background:"transparent",border:"1px solid #ccc",
                          borderRadius:7,color:"#666",fontSize:12,cursor:"pointer",fontFamily:FONT}}>
                        {t.no}
                      </button>
                    </div>
                    :<button onClick={()=>setConfirmId(v.id)}
                      style={{padding:"6px 13px",background:"transparent",border:`1px solid ${C.gold}`,
                        borderRadius:7,color:C.gold,fontSize:12,cursor:"pointer",fontFamily:FONT,flexShrink:0}}>
                      {t.restoreVersion}
                    </button>}
                </div>
              </div>
            ))}
          </div>}
    </div>
  </div>;
}

// ── ADD / EDIT ────────────────────────────────────────────────────────────────
function AddEditScreen({t,lang,setLang,user,existing,onSave,onCancel}){
  const cats=useContext(CatCtx);
  const blank={id:"",huName:"",enName:"",category:(cats[0]?.id??0),section:0,serves:10,prepTime:20,cookTime:60,
    packSpec:"",shelfLife:"",vacuumLevel:"",status:"published",allergens:[],
    coverImage:null,ingredients:[{id:uid(),name:"",qty:"",image:null}],
    steps:[{id:uid(),desc:"",image:null}]};
  const [form,setForm]=useState(()=>existing
    ?{...existing,
      ingredients:existing.ingredients?.length?existing.ingredients:blank.ingredients,
      steps:existing.steps?.length?existing.steps:blank.steps}
    :blank);
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState("");
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  const updI=(i,k,v)=>{const a=[...form.ingredients];a[i]={...a[i],[k]:v};set("ingredients",a);};
  const updS=(i,k,v)=>{const a=[...form.steps];a[i]={...a[i],[k]:v};set("steps",a);};
  const db={padding:"8px 15px",background:"transparent",border:`1.5px dashed ${C.gold}`,borderRadius:8,color:C.gold,fontSize:12,cursor:"pointer",fontFamily:FONT};
  const rb={background:"#fff0f0",border:"1px solid #fcc",borderRadius:7,color:"#c44",fontSize:13,padding:"3px 8px",cursor:"pointer",flexShrink:0};

  const handleSave=async(asDraft)=>{
    if(!form.huName.trim()&&!form.enName.trim()){setErr(t.required);return;}
    setSaving(true);
    // Keep items if EITHER language is filled; fall back to the other language for the missing one
    const fillIng = i => {
      const hu=(i.name||"").trim(), en=(i.enName||"").trim();
      if(!hu && !en) return null;
      return {...i, name: hu || en, enName: en || hu};
    };
    const fillStep = s => {
      const hu=(s.desc||"").trim(), en=(s.enDesc||"").trim();
      if(!hu && !en) return null;
      return {...s, desc: hu || en, enDesc: en || hu};
    };
    const recipe={...form,
      id:form.id||`u-${Date.now()}`,
      // Fall back: if one language name is empty, copy the other over
      huName: form.huName.trim() || form.enName.trim(),
      enName: form.enName.trim() || form.huName.trim(),
      author:user.name,authorId:user.id,
      createdAt:form.createdAt||Date.now(),
      status: asDraft ? "draft" : "published",
      ingredients:form.ingredients.map(fillIng).filter(Boolean),
      steps:form.steps.map(fillStep).filter(Boolean),
    };
    await onSave(recipe);
    setSaving(false);
  };

  return <div style={{minHeight:"100vh",background:C.bg,fontFamily:FONT,display:"flex",flexDirection:"column"}}>
    <TopBar t={t} lang={lang} setLang={setLang} user={user} onLogout={()=>{}}
      left={<button onClick={onCancel} style={backSt}>{t.cancel}</button>}/>
    <div style={{maxWidth:700,margin:"0 auto",padding:"24px 16px 80px",width:"100%",boxSizing:"border-box"}}>
      <h2 style={{margin:"0 0 22px",fontSize:20,color:C.text}}>{existing?t.editRecipe:t.newRecipe}</h2>
      <Field label={t.coverPhoto}>
        <ImageUpload value={form.coverImage} onChange={v=>set("coverImage",v)} size="cover" t={t}/>
      </Field>
      {/* Name fields: primary (HU) + secondary (EN) */}
      <div style={{fontSize:11,color:C.muted,marginBottom:7,fontStyle:"italic"}}>{t.oneLanguageHint}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="Name (HU)">
          <SI value={form.huName} onChange={e=>{set("huName",e.target.value);setErr("");}} placeholder="Magyar név"/>
          {err&&<div style={{color:C.danger,fontSize:11,marginTop:4}}>{err}</div>}
        </Field>
        <Field label="Name (EN)">
          <SI value={form.enName||""} onChange={e=>{set("enName",e.target.value);setErr("");}} placeholder="English name"/>
        </Field>
      </div>
      <Field label={t.category}>
        <select value={form.category} onChange={e=>set("category",+e.target.value)} style={inputSt}>
          {cats.map(c=><option key={c.id} value={c.id}>{lang==="en"?c.nameEn:c.nameHu}</option>)}
        </select>
      </Field>
      {/* Allergens */}
      <Field label={t.allergens}>
        <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
          {ALLERGEN_KEYS.map(a=>{
            const on=(form.allergens||[]).includes(a);
            return <button key={a} type="button" onClick={()=>{
              const cur=form.allergens||[];
              set("allergens", on?cur.filter(x=>x!==a):[...cur,a]);
            }} style={{padding:"6px 12px",borderRadius:20,fontSize:12,cursor:"pointer",fontFamily:FONT,
              border:`1px solid ${on?"#c04040":C.border}`,
              background:on?"#fdeaea":"transparent",color:on?"#c04040":C.muted,
              fontWeight:on?"bold":"normal"}}>
              {on?"⚠ ":""}{(t.allergenLabels&&t.allergenLabels[a])||a}
            </button>;
          })}
        </div>
      </Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:11}}>
        {[[t.packSpec,"packSpec","e.g. 2.5 kg / bag"],
          [t.shelfLife,"shelfLife","e.g. 6 months frozen"],
          [t.vacuumLevel,"vacuumLevel","e.g. P3"]].map(([l,k,ph])=>(
          <Field key={k} label={l}><SI type="text" value={form[k]||""} placeholder={ph} onChange={e=>set(k,e.target.value)}/></Field>
        ))}
      </div>
      {/* Ingredients — bilingual side by side */}
      <div style={{marginBottom:24}}>
        <SHead title={t.ingredients} color={C.gold}/>
        {form.ingredients.map((ing,i)=>(
          <div key={ing.id} style={{display:"flex",gap:10,marginBottom:11,alignItems:"flex-start",
            background:C.card,borderRadius:12,padding:"11px 13px",border:`1px solid ${C.border}`}}>
            <div style={{flexShrink:0}}>
              <div style={{fontSize:10,color:C.muted,marginBottom:4,textAlign:"center"}}>{t.ingredientPhoto}</div>
              <ImageUpload value={ing.image} onChange={v=>updI(i,"image",v)} size="sm" t={t}/>
            </div>
            <div style={{flex:1,display:"flex",flexDirection:"column",gap:7}}>
              {/* HU + EN name side by side */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
                <div>
                  <div style={{fontSize:9,color:"#9c7a3c",letterSpacing:1.5,marginBottom:3,fontWeight:"bold"}}>HU NAME</div>
                  <SI value={ing.name||""} onChange={e=>updI(i,"name",e.target.value)} placeholder="Magyar név"/>
                </div>
                <div>
                  <div style={{fontSize:9,color:"#9c7a3c",letterSpacing:1.5,marginBottom:3,fontWeight:"bold"}}>EN NAME</div>
                  <SI value={ing.enName||""} onChange={e=>updI(i,"enName",e.target.value)} placeholder="English name"/>
                </div>
              </div>
              {/* Qty (shared) */}
              <div>
                <div style={{fontSize:9,color:"#9c7a3c",letterSpacing:1.5,marginBottom:3,fontWeight:"bold"}}>QTY</div>
                <SI value={ing.qty||""} onChange={e=>updI(i,"qty",e.target.value)} placeholder={t.ingredientQty}/>
              </div>
            </div>
            {form.ingredients.length>1&&<button onClick={()=>set("ingredients",form.ingredients.filter((_,j)=>j!==i))} style={rb}>✕</button>}
          </div>
        ))}
        <button onClick={()=>set("ingredients",[...form.ingredients,{id:uid(),name:"",enName:"",qty:"",image:null}])} style={db}>{t.addIngredient}</button>
      </div>

      {/* Steps — bilingual side by side */}
      <div style={{marginBottom:30}}>
        <SHead title={t.steps} color={C.gold}/>
        {form.steps.map((step,i)=>(
          <div key={step.id} style={{display:"flex",gap:12,marginBottom:13,alignItems:"flex-start"}}>
            <div style={{width:27,height:27,borderRadius:"50%",flexShrink:0,marginTop:9,
              background:`linear-gradient(135deg,${C.gold},${C.goldL})`,color:C.dark,
              fontWeight:"bold",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>{i+1}</div>
            <div style={{flex:1,background:C.card,borderRadius:12,padding:"11px 13px",border:`1px solid ${C.border}`}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:10}}>
                <div>
                  <div style={{fontSize:9,color:"#9c7a3c",letterSpacing:1.5,marginBottom:3,fontWeight:"bold"}}>HU STEP</div>
                  <textarea value={step.desc||""} onChange={e=>updS(i,"desc",e.target.value)}
                    placeholder="Magyar lépés…" rows={3}
                    style={{...inputSt,resize:"vertical",minHeight:70}}/>
                </div>
                <div>
                  <div style={{fontSize:9,color:"#9c7a3c",letterSpacing:1.5,marginBottom:3,fontWeight:"bold"}}>EN STEP</div>
                  <textarea value={step.enDesc||""} onChange={e=>updS(i,"enDesc",e.target.value)}
                    placeholder="English step…" rows={3}
                    style={{...inputSt,resize:"vertical",minHeight:70}}/>
                </div>
              </div>
              <div style={{fontSize:10,color:C.muted,marginBottom:5}}>{t.stepPhoto}:</div>
              <ImageUpload value={step.image} onChange={v=>updS(i,"image",v)} size="md" t={t}/>
            </div>
            {form.steps.length>1&&<button onClick={()=>set("steps",form.steps.filter((_,j)=>j!==i))} style={{...rb,marginTop:9}}>✕</button>}
          </div>
        ))}
        <button onClick={()=>set("steps",[...form.steps,{id:uid(),desc:"",enDesc:"",image:null}])} style={db}>{t.addStep}</button>
      </div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={()=>handleSave(true)} disabled={saving} style={{flex:"0 0 auto",padding:"14px 22px",
          background:"transparent",border:`1.5px solid ${C.gold}`,borderRadius:12,color:C.gold,fontWeight:"bold",
          fontSize:14,cursor:saving?"not-allowed":"pointer",fontFamily:FONT,opacity:saving?0.5:1,whiteSpace:"nowrap"}}>
          {t.saveDraft}
        </button>
        <button onClick={()=>handleSave(false)} disabled={saving} style={{flex:1,padding:"14px 0",
          background:saving?"#ddd":`linear-gradient(135deg,${C.gold},${C.goldL})`,
          border:"none",borderRadius:12,color:saving?"#999":C.dark,fontWeight:"bold",
          fontSize:15,cursor:saving?"not-allowed":"pointer",letterSpacing:2,fontFamily:FONT,
          boxShadow:saving?"none":`0 4px 20px rgba(168,131,63,.35)`}}>{saving?t.saving:t.publish}</button>
      </div>
    </div>
  </div>;
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function App(){
  const [lang,setLang]=useState("en");
  const t=T[lang];

  // ── Auth ──────────────────────────────────────────────────────────────────
  const [user,setUser]=useState(null);
  const [authLoading,setAuthLoading]=useState(true);
  const [lf,setLf]=useState({username:"",password:""});
  const [lerr,setLerr]=useState("");
  const [loggingIn,setLoggingIn]=useState(false);

  // ── Data ──────────────────────────────────────────────────────────────────
  const [stubs,setStubs]=useState([]);     // recipe stubs (list view)
  const [users,setUsers]=useState([]);
  const [auditTick,setAuditTick]=useState(0);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [view,setView]=useState("list");
  const [selId,setSelId]=useState(null);
  const [selRecipe,setSelRecipe]=useState(null);
  const [detLoading,setDetLoading]=useState(false);
  const [versions,setVersions]=useState([]);
  const [versionsLoading,setVersionsLoading]=useState(false);
  const [search,setSearch]=useState("");
  const [activeCat,setActiveCat]=useState(-1);
  const [faves,setFaves]=useState(()=>FAVES.get());
  const [favesOnly,setFavesOnly]=useState(false);
  const toggleFave=(id)=>{ setFaves(new Set(FAVES.toggle(id))); };
  const [sortBy,setSortBy]=useState("default"); // default | name | recent
  const [recentIds,setRecentIds]=useState(()=>RECENT.get());
  // Cross-tab tools
  const [prepList,setPrepList]=useState([]); // [{id, mult}]
  const [zoomImg,setZoomImg]=useState(null);
  const [dupSource,setDupSource]=useState(null);
  const [cats,setCats]=useState([]); // DB-backed categories

  // ── Toast notifications ──────────────────────────────────────────────────
  const [toast,setToast]=useState(null); // {msg, kind:'success'|'error'}
  const showToast=(msg,kind="success")=>{
    setToast({msg,kind});
    setTimeout(()=>setToast(null), 2800);
  };

  // ── Restore session on mount ──────────────────────────────────────────────
  useEffect(()=>{
    // If we just reloaded after logout, show a confirmation toast
    try {
      if(sessionStorage.getItem("just-logged-out")==="1"){
        sessionStorage.removeItem("just-logged-out");
        setTimeout(()=>showToast("✓ Logged out","success"), 100);
      }
    } catch {}

    let cancelled = false;
    // Hard timeout: no matter what, exit Loading after 4 seconds
    const failsafe = setTimeout(()=>{
      if(!cancelled) setAuthLoading(false);
    }, 4000);

    (async()=>{
      try {
        const profile = await Promise.race([
          getCurrentProfile(),
          new Promise(resolve => setTimeout(() => resolve(null), 3500)),
        ]);
        if(cancelled) return;
        if(profile) setUser(profile);
      } catch(e) {
        console.error("Auth init failed:", e);
      } finally {
        if(!cancelled) setAuthLoading(false);
      }
    })();

    // Listen for auth changes (signed in / out)
    const{data:sub}=supabase.auth.onAuthStateChange(async(event)=>{
      if(cancelled) return;
      if(event==="SIGNED_OUT"){
        setUser(null);setStubs([]);setUsers([]);
      }
      if(event==="SIGNED_IN"){
        try {
          const profile = await Promise.race([
            getCurrentProfile(),
            new Promise(resolve => setTimeout(() => resolve(null), 3500)),
          ]);
          if(profile && !cancelled) setUser(profile);
        } catch(e){console.error(e);}
      }
    });

    return()=>{
      cancelled = true;
      clearTimeout(failsafe);
      sub.subscription.unsubscribe();
    };
  },[]);

  // ── Load recipes & users after login ──────────────────────────────────────
  useEffect(()=>{
    if(!user)return;
    (async()=>{
      try{
        const recipes=await fetchAllRecipes();
        setStubs(recipes);
        try{ const cs=await fetchCategories(); setCats(cs); }catch(e){console.error("cats load",e);}
        if(user.role==="admin"){
          const u=await fetchAllUsers();
          setUsers(u);
        }
        // If opened via QR code link (#recipe/xxx), jump straight to that recipe
        const hash=window.location.hash||"";
        const m=hash.match(/recipe\/([^/]+)/);
        if(m&&m[1]){ openDetail(decodeURIComponent(m[1])); }
      }catch(e){console.error("Load error:",e);}
    })();
  },[user]);

  // ── Login ─────────────────────────────────────────────────────────────────
  const doLogin=async()=>{
    if(loggingIn)return;
    setLoggingIn(true);setLerr("");
    try{
      await signIn(lf.username,lf.password);
      // onAuthStateChange will populate the user
    }catch(e){
      setLerr(T[lang].wrongCreds);
    }
    setLoggingIn(false);
  };
  const doLogout=async()=>{
    try{await signOut();}catch{}
    // Save a flag so login page shows a "logged out" toast after reload
    try{sessionStorage.setItem("just-logged-out","1");}catch{}
    window.location.reload();
  };

  // ── Image upload helper (walks through recipe and uploads any pending files)
  const uploadPendingImages=async(recipe)=>{
    const cover=await resolveImage(recipe.coverImage,"covers");
    const ingredients=[];
    for(const ing of recipe.ingredients){
      ingredients.push({...ing, image: await resolveImage(ing.image,"ings")});
    }
    const steps=[];
    for(const st of recipe.steps){
      steps.push({...st, image: await resolveImage(st.image,"steps")});
    }
    return{...recipe, coverImage:cover, ingredients, steps};
  };

  // ── Recipe handlers ───────────────────────────────────────────────────────
  const openDetail=async(id)=>{
    setDetLoading(true);setView("detail");setSelId(id);
    setRecentIds(RECENT.push(id));
    try{ window.location.hash = `recipe/${id}`; }catch{}
    try{
      const r=await fetchRecipeById(id);
      setSelRecipe(r);
    }catch(e){console.error(e);}
    setDetLoading(false);
  };

  const openHistory=async()=>{
    if(!selRecipe)return;
    setView("history");setVersionsLoading(true);
    try{
      const v=await fetchRecipeVersions(selRecipe.id);
      setVersions(v);
    }catch(e){console.error(e);setVersions([]);}
    setVersionsLoading(false);
  };

  const restoreVersion=async(snapshot)=>{
    try{
      // Save the snapshot as the current version (this also snapshots the now-current one)
      const restored={...snapshot,author:user.name,authorId:user.id};
      const withUrls=await uploadPendingImages(restored);
      const saved=await upsertRecipe(withUrls);
      setSelRecipe(saved);
      await logAction({action:"restore",recipeId:saved.id,recipeName:saved.enName||saved.huName,diff:{}});
      setAuditTick(n=>n+1);
      showToast(t.restored,"success");
      setView("detail");
    }catch(e){showToast("Restore failed: "+(e.message||e),"error");console.error(e);}
  };

  // Duplicate: open the Add form pre-filled from an existing recipe (new id, "(copy)" name)
  const handleDuplicate=()=>{
    if(!selRecipe)return;
    const copy={
      ...selRecipe,
      id:"", // new recipe
      huName:selRecipe.huName?`${selRecipe.huName} (másolat)`:"",
      enName:selRecipe.enName?`${selRecipe.enName} (copy)`:"",
      status:"draft",
      createdAt:Date.now(),
      ingredients:(selRecipe.ingredients||[]).map(i=>({...i,id:uid()})),
      steps:(selRecipe.steps||[]).map(s=>({...s,id:uid()})),
    };
    setDupSource(copy);
    setView("add");
  };

  // Save all categories (admin) — upserts each, deletes removed ones
  const saveCats=async(nextCats,removedIds)=>{
    try{
      for(const c of nextCats){ await upsertCategory(c); }
      for(const id of (removedIds||[])){ await deleteCategory(id); }
      const fresh=await fetchCategories();
      setCats(fresh);
      showToast("✓ Categories saved","success");
    }catch(e){showToast("Save failed: "+(e.message||e),"error");console.error(e);}
  };

  const handleSave=async(recipe)=>{
    try{
      // Clear duplicate source once we save
      setDupSource(null);
      // Upload any pending image files first
      const withUrls=await uploadPendingImages({
        ...recipe,
        id: recipe.id||`u-${Date.now()}`,
        author: user.name,
        authorId: user.id,
      });
      const isNew=!stubs.find(r=>r.id===withUrls.id);
      const saved=await upsertRecipe(withUrls);
      // Refresh stubs
      setStubs(prev=>{
        const stub={id:saved.id,huName:saved.huName,enName:saved.enName,
          category:saved.category,section:saved.section,serves:saved.serves,
          prepTime:saved.prepTime,cookTime:saved.cookTime,
          packSpec:saved.packSpec,shelfLife:saved.shelfLife,vacuumLevel:saved.vacuumLevel,
          author:saved.author,coverImage:saved.coverImage,createdAt:saved.createdAt};
        const pos=prev.findIndex(r=>r.id===stub.id);
        if(pos>=0){const copy=[...prev];copy[pos]=stub;return copy;}
        return[stub,...prev];
      });
      await logAction({
        action:isNew?"create":"edit",
        recipeId:saved.id,
        recipeName:saved.enName||saved.huName,
        diff:{ings:saved.ingredients?.length||0,steps:saved.steps?.length||0},
      });
      setAuditTick(n=>n+1);
      showToast(isNew?`✓ Recipe "${saved.enName||saved.huName}" created`:`✓ Recipe saved`,"success");
      if(view==="edit"){setSelRecipe(saved);setView("detail");}
      else setView("list");
    }catch(e){
      showToast("Save failed: "+(e.message||e),"error");
      console.error(e);
    }
  };

  const handleBulkSave=async(recipes)=>{
    try{
      for(const r of recipes){
        const withUrls=await uploadPendingImages({...r,author:user.name,authorId:user.id});
        await upsertRecipe(withUrls);
        await logAction({action:"bulk-edit",recipeId:r.id,recipeName:r.enName||r.huName,diff:{}});
      }
      const fresh=await fetchAllRecipes();
      setStubs(fresh);
      setAuditTick(n=>n+1);
      showToast(`✓ Updated ${recipes.length} recipe${recipes.length!==1?"s":""}`,"success");
    }catch(e){showToast("Bulk save failed: "+(e.message||e),"error");console.error(e);}
  };

  const handleBulkImport=async(recipes)=>{
    try{
      for(const r of recipes){
        const withUrls=await uploadPendingImages({...r,author:user.name,authorId:user.id});
        await upsertRecipe(withUrls);
        await logAction({action:"import",recipeId:r.id,recipeName:r.enName||r.huName,diff:{}});
      }
      const fresh=await fetchAllRecipes();
      setStubs(fresh);
      setAuditTick(n=>n+1);
      showToast(`✓ Imported ${recipes.length} recipe${recipes.length!==1?"s":""}`,"success");
    }catch(e){showToast("Import failed: "+(e.message||e),"error");console.error(e);}
  };

  const handleDelete=async(id)=>{
    try{
      const stub=stubs.find(r=>r.id===id);
      await deleteRecipe(id);
      setStubs(prev=>prev.filter(r=>r.id!==id));
      await logAction({action:"delete",recipeId:id,recipeName:stub?(stub.enName||stub.huName):id,diff:{}});
      setAuditTick(n=>n+1);
      showToast(`✓ Recipe deleted`,"success");
      setView("list");
    }catch(e){showToast("Delete failed: "+(e.message||e),"error");console.error(e);}
  };

  // ── User management handlers ──────────────────────────────────────────────
  const addUser=async(u)=>{
    try{
      await adminCreateUser(u);
      const fresh=await fetchAllUsers();
      setUsers(fresh);
      await logAction({action:"user-add",recipeId:`@${u.username}`,recipeName:u.name,diff:{}});
      setAuditTick(n=>n+1);
      showToast(`✓ User "${u.name}" created`,"success");
    }catch(e){showToast("Add user failed: "+(e.message||e),"error");throw e;}
  };
  const deleteUser=async(id)=>{
    try{
      const target=users.find(u=>u.id===id);
      await adminDeleteUser(id);
      const fresh=await fetchAllUsers();
      setUsers(fresh);
      await logAction({action:"user-del",recipeId:`@${target?.username||id}`,recipeName:target?.name||"",diff:{}});
      setAuditTick(n=>n+1);
      showToast(`✓ User "${target?.name||""}" deleted`,"success");
    }catch(e){showToast("Delete user failed: "+(e.message||e),"error");}
  };
  const changePassword=async(id,newPwd)=>{
    try{
      await adminChangePassword(id,newPwd);
      await logAction({action:"pwd-change",recipeId:`@${users.find(u=>u.id===id)?.username||id}`,recipeName:users.find(u=>u.id===id)?.name||"",diff:{}});
      setAuditTick(n=>n+1);
      showToast(`✓ Password updated`,"success");
    }catch(e){showToast("Password change failed: "+(e.message||e),"error");throw e;}
  };

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered=stubs.filter(r=>{
    const q=search.toLowerCase().trim();
    // Match against names AND ingredient names (both languages)
    let match = !q;
    if(q){
      if((r.enName||"").toLowerCase().includes(q)||(r.huName||"").toLowerCase().includes(q)){
        match=true;
      } else if(Array.isArray(r.ingredients)){
        match=r.ingredients.some(ing=>
          (ing.name||"").toLowerCase().includes(q)||(ing.enName||"").toLowerCase().includes(q)
        );
      }
    }
    const catOk = activeCat===-1||r.category===activeCat;
    const faveOk = !favesOnly || faves.has(r.id);
    // Drafts only visible to their author or admins
    const isDraft = r.status==="draft";
    const draftOk = !isDraft || user?.role==="admin" || r.authorId===user?.id;
    return match&&catOk&&faveOk&&draftOk;
  });
  // Sort: favorites first, then keep original order
  // Apply chosen sort, then always float favorites to the top
  const nameFor=r=>(lang==="en"?(r.enName||r.huName):(r.huName||r.enName))||"";
  filtered.sort((a,b)=>{
    if(sortBy==="name") return nameFor(a).localeCompare(nameFor(b));
    if(sortBy==="recent"){
      const ia=recentIds.indexOf(a.id), ib=recentIds.indexOf(b.id);
      const ra=ia===-1?9999:ia, rb=ib===-1?9999:ib;
      if(ra!==rb) return ra-rb;
    }
    return (b.createdAt||0)-(a.createdAt||0);
  });
  filtered.sort((a,b)=>{
    const fa=faves.has(a.id)?1:0, fb=faves.has(b.id)?1:0;
    return fb-fa;
  });

  const canEdit=user?.role==="admin"||user?.role==="chef";

  // ── Render ────────────────────────────────────────────────────────────────
  const renderScreen=()=>{
    if(authLoading)return <div style={{minHeight:"100vh",background:C.dark,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,color:C.gold,fontFamily:FONT,fontSize:14}}>
      Loading…
      <div style={{display:"flex",gap:8,marginTop:8}}>
        <button onClick={()=>window.location.reload()}
          style={{padding:"7px 14px",background:"transparent",border:`1px solid ${C.gold}`,
            borderRadius:8,color:C.gold,fontSize:12,cursor:"pointer",fontFamily:FONT}}>
          Reload
        </button>
        <button onClick={async()=>{try{await signOut();}catch{};localStorage.clear();sessionStorage.clear();window.location.reload();}}
          style={{padding:"7px 14px",background:"transparent",border:`1px solid #888`,
            borderRadius:8,color:"#888",fontSize:12,cursor:"pointer",fontFamily:FONT}}>
          Reset & sign out
        </button>
      </div>
    </div>;
    if(!user)return <LoginScreen t={t} lang={lang} setLang={setLang} form={lf} setForm={setLf} doLogin={doLogin} err={lerr} loading={loggingIn}/>;
    if(view==="edit")return <AddEditScreen t={t} lang={lang} setLang={setLang} user={user} existing={selRecipe} onSave={handleSave} onCancel={()=>setView(selRecipe?"detail":"list")}/>;
    if(view==="detail")return <DetailScreen t={t} lang={lang} setLang={setLang} recipe={selRecipe} loading={detLoading} user={user} canEdit={canEdit} onBack={()=>setView("list")} onEdit={()=>setView("edit")} onDelete={()=>handleDelete(selId)} onHistory={openHistory} onDuplicate={handleDuplicate} onZoom={setZoomImg} allStubs={stubs} onSearchIngredient={(term)=>{setSearch(term);setView("list");}}/>;
    if(view==="history")return <HistoryScreen t={t} lang={lang} setLang={setLang} user={user} recipe={selRecipe} versions={versions} loading={versionsLoading} onBack={()=>setView("detail")} onRestore={restoreVersion}/>;
    if(view==="add")return <AddEditScreen t={t} lang={lang} setLang={setLang} user={user} existing={dupSource} onSave={handleSave} onCancel={()=>setView("list")}/>;
    if(view==="prep")return <PrepListScreen t={t} lang={lang} setLang={setLang} user={user} prepList={prepList} setPrepList={setPrepList} allStubs={stubs} onBack={()=>setView("list")} onSelect={r=>openDetail(r.id)}/>;
    if(view==="admin")return <AdminPanel t={t} lang={lang} setLang={setLang} user={user} allStubs={stubs} onBack={()=>setView("list")} onBulkSave={handleBulkSave} onBulkImport={handleBulkImport} auditTick={auditTick} users={users} onAddUser={addUser} onDeleteUser={deleteUser} onChangePassword={changePassword} cats={cats} onSaveCats={saveCats}/>;
    return <ListScreen t={t} lang={lang} setLang={setLang} user={user} onLogout={doLogout} recipes={filtered} allStubs={stubs} search={search} setSearch={setSearch} activeCat={activeCat} setActiveCat={setActiveCat} onSelect={r=>openDetail(r.id)} onAdd={()=>setView("add")} canEdit={canEdit} isAdmin={user.role==="admin"} onAdmin={()=>setView("admin")} faves={faves} toggleFave={toggleFave} favesOnly={favesOnly} setFavesOnly={setFavesOnly} totalCount={stubs.length} sortBy={sortBy} setSortBy={setSortBy} recentIds={recentIds} prepList={prepList} setPrepList={setPrepList} onOpenPrep={()=>setView("prep")}/>;
  };

  return <CatCtx.Provider value={cats}>
    {renderScreen()}
    {toast && <Toast msg={toast.msg} kind={toast.kind}/>}
    {zoomImg && <div onClick={()=>setZoomImg(null)} style={{position:"fixed",inset:0,
      background:"rgba(0,0,0,.88)",zIndex:10000,display:"flex",alignItems:"center",
      justifyContent:"center",padding:20,cursor:"zoom-out"}}>
      <img src={zoomImg} alt="" style={{maxWidth:"100%",maxHeight:"100%",
        borderRadius:10,boxShadow:"0 8px 40px rgba(0,0,0,.5)"}}/>
      <button onClick={()=>setZoomImg(null)} style={{position:"absolute",top:16,right:16,
        width:40,height:40,borderRadius:"50%",border:"none",background:"rgba(255,255,255,.2)",
        color:"#fff",fontSize:20,cursor:"pointer"}}>✕</button>
    </div>}
  </CatCtx.Provider>;
}

// ── Toast component ───────────────────────────────────────────────────────────
function Toast({msg,kind}){
  const bg = kind==="error" ? "#c04040" : "#3d7a52";
  return <div style={{
    position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",
    background:bg,color:"#fff",padding:"11px 22px",borderRadius:10,
    fontSize:14,fontFamily:FONT,fontWeight:"bold",
    boxShadow:"0 6px 24px rgba(0,0,0,.35)",zIndex:9999,
    animation:"toastSlideIn .25s ease-out",maxWidth:"calc(100% - 32px)",
  }}>
    {msg}
    <style>{"@keyframes toastSlideIn{from{transform:translate(-50%,40px);opacity:0}to{transform:translate(-50%,0);opacity:1}}"}</style>
  </div>;
}

// ── QR code modal (#3) ────────────────────────────────────────────────────────
function QRModal({recipe,name,t,onClose}){
  const [dataUrl,setDataUrl]=useState("");
  const url=`${window.location.origin}${window.location.pathname}#recipe/${recipe.id}`;
  useEffect(()=>{
    QRCode.toDataURL(url,{width:320,margin:2,color:{dark:"#211f1c",light:"#ffffff"}})
      .then(setDataUrl).catch(e=>console.error("QR error",e));
  },[recipe.id]);
  const printQR=()=>{
    const w=window.open("","_blank");
    if(!w)return;
    w.document.write(`<html><head><title>${name}</title></head>
      <body style="text-align:center;font-family:Georgia,serif;padding:40px">
      <h2 style="color:#211f1c">${name}</h2>
      <img src="${dataUrl}" style="width:300px;height:300px"/>
      <p style="color:#888;font-size:13px">${t.qrHint}</p>
      </body></html>`);
    w.document.close();
    setTimeout(()=>w.print(),300);
  };
  return <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",
    zIndex:10001,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
    <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:16,padding:"28px",
      textAlign:"center",maxWidth:360,boxShadow:"0 12px 50px rgba(0,0,0,.4)"}}>
      <h3 style={{margin:"0 0 6px",fontSize:17,color:C.text}}>{name}</h3>
      <p style={{fontSize:12,color:C.muted,margin:"0 0 18px"}}>{t.qrHint}</p>
      {dataUrl
        ?<img src={dataUrl} alt="QR" style={{width:260,height:260}}/>
        :<div style={{height:260,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted}}>⏳</div>}
      <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"center"}}>
        <button onClick={printQR} style={{padding:"9px 20px",background:C.gold,border:"none",
          borderRadius:9,color:C.dark,fontWeight:"bold",fontSize:13,cursor:"pointer",fontFamily:FONT}}>🖨 {t.print}</button>
        <button onClick={onClose} style={{padding:"9px 18px",background:"transparent",border:"1px solid #ccc",
          borderRadius:9,color:"#888",fontSize:13,cursor:"pointer",fontFamily:FONT}}>{t.cancel}</button>
      </div>
    </div>
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function AdminPanel({t,lang,setLang,user,allStubs,onBack,onBulkSave,onBulkImport,auditTick,users,onAddUser,onDeleteUser,onChangePassword,cats,onSaveCats}){
  const [tab,setTab]=useState("log");
  return <div style={{minHeight:"100vh",background:"#f5f0e8",fontFamily:FONT,display:"flex",flexDirection:"column"}}>
    <div style={{background:C.dark,height:54,padding:"0 16px",display:"flex",
      alignItems:"center",justifyContent:"space-between",flexShrink:0,
      borderBottom:`2px solid ${C.gold}`,boxShadow:"0 2px 14px rgba(0,0,0,.35)"}}>
      <button onClick={onBack} style={{background:"transparent",border:"none",color:C.gold,fontSize:14,cursor:"pointer",fontFamily:FONT}}>← Back</button>
      <span style={{color:C.goldL,fontWeight:"bold",fontSize:14,letterSpacing:1}}>⚙ Admin Panel</span>
      <LangSwitcher lang={lang} setLang={setLang}/>
    </div>
    {/* Tab bar */}
    <div style={{background:C.dark,borderBottom:`1px solid rgba(168,131,63,.25)`,display:"flex",padding:"0 16px",gap:4,overflowX:"auto"}}>
      {[["log","📋 Change Log"],["users","👥 Users"],["cats","🏷 "+t.manageCats],["bulk-edit","✏️ Bulk Edit"],["import","📥 Bulk Import"],["stats","📊 "+t.stats],["export","💾 "+t.exportData]].map(([k,label])=>(
        <button key={k} onClick={()=>setTab(k)} style={{padding:"10px 18px",background:"transparent",
          border:"none",borderBottom:`2px solid ${tab===k?C.gold:"transparent"}`,
          color:tab===k?C.goldL:"rgba(200,160,80,.6)",fontSize:13,cursor:"pointer",
          fontFamily:FONT,transition:"all .15s",whiteSpace:"nowrap"}}>{label}</button>
      ))}
    </div>
    <div style={{flex:1,overflow:"auto"}}>
      {tab==="log"    && <ChangeLog   t={t} user={user} auditTick={auditTick}/>}
      {tab==="users"  && <UserMgmt    t={t} currentUser={user} users={users} onAdd={onAddUser} onDelete={onDeleteUser} onChangePassword={onChangePassword}/>}
      {tab==="cats"   && <CategoryManager t={t} lang={lang} cats={cats} onSave={onSaveCats}/>}
      {tab==="bulk-edit" && <BulkEdit t={t} lang={lang} allStubs={allStubs} onBulkSave={onBulkSave}/>}
      {tab==="import" && <BulkImport  t={t} lang={lang} onBulkImport={onBulkImport}/>}
      {tab==="stats"  && <StatsPanel  t={t} lang={lang} allStubs={allStubs} users={users}/>}
      {tab==="export" && <ExportPanel t={t} lang={lang} allStubs={allStubs}/>}
    </div>
  </div>;
}

// ── STATS PANEL (#10) ─────────────────────────────────────────────────────────
function StatsPanel({t,lang,allStubs,users}){
  const cats=useContext(CatCtx);
  const total=allStubs.length;
  const drafts=allStubs.filter(r=>r.status==="draft").length;
  const byCat=cats.map(c=>({label:lang==="en"?c.nameEn:c.nameHu,count:allStubs.filter(r=>r.category===c.id).length})).filter(c=>c.count>0).sort((a,b)=>b.count-a.count);
  const byAuthor={};
  allStubs.forEach(r=>{const a=r.author||"—";byAuthor[a]=(byAuthor[a]||0)+1;});
  const authorList=Object.entries(byAuthor).sort((a,b)=>b[1]-a[1]);
  const withImg=allStubs.filter(r=>r.coverImage).length;
  const maxCat=Math.max(1,...byCat.map(c=>c.count));

  const card={background:"#fff",borderRadius:12,padding:"16px 18px",border:`1px solid ${C.border}`};
  return <div style={{maxWidth:760,margin:"0 auto",padding:"24px 16px"}}>
    {/* Big numbers */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:12,marginBottom:20}}>
      {[["📒",total,t.stats==="Statistics"?"Total recipes":"Összes recept"],
        ["📝",drafts,t.draftBadge],
        ["🖼",withImg,"With photo"],
        ["👥",users.length,"Users"]].map(([emo,n,l])=>(
        <div key={l} style={{...card,textAlign:"center"}}>
          <div style={{fontSize:24}}>{emo}</div>
          <div style={{fontSize:26,fontWeight:"bold",color:C.gold}}>{n}</div>
          <div style={{fontSize:11,color:C.muted,marginTop:2}}>{l}</div>
        </div>
      ))}
    </div>
    {/* By category bar chart */}
    <div style={{...card,marginBottom:16}}>
      <div style={{fontSize:13,fontWeight:"bold",color:C.text,marginBottom:14}}>By category</div>
      {byCat.map(c=>(
        <div key={c.label} style={{display:"flex",alignItems:"center",gap:10,marginBottom:9}}>
          <span style={{fontSize:12,color:C.muted,width:130,flexShrink:0,textAlign:"right"}}>{c.label}</span>
          <div style={{flex:1,background:`${C.gold}18`,borderRadius:6,height:20,position:"relative"}}>
            <div style={{width:`${c.count/maxCat*100}%`,background:`linear-gradient(90deg,${C.gold},${C.goldL})`,
              height:"100%",borderRadius:6,minWidth:24}}/>
          </div>
          <span style={{fontSize:12,fontWeight:"bold",color:C.text,width:28}}>{c.count}</span>
        </div>
      ))}
    </div>
    {/* By author */}
    <div style={card}>
      <div style={{fontSize:13,fontWeight:"bold",color:C.text,marginBottom:12}}>By author</div>
      {authorList.map(([a,n])=>(
        <div key={a} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",
          borderBottom:`1px solid ${C.border}`,fontSize:13}}>
          <span style={{color:C.text}}>{a}</span>
          <span style={{color:C.gold,fontWeight:"bold"}}>{n}</span>
        </div>
      ))}
    </div>
  </div>;
}

// ── CATEGORY MANAGER (#8) ─────────────────────────────────────────────────────
function CategoryManager({t,lang,cats,onSave}){
  const [rows,setRows]=useState(()=>cats.map(c=>({...c})));
  const [removed,setRemoved]=useState([]);
  const [saving,setSaving]=useState(false);
  useEffect(()=>{ setRows(cats.map(c=>({...c}))); setRemoved([]); },[cats]);

  const PALETTE=["#a8833f","#5a9e6f","#4a90c4","#c4774a","#c06090","#4ab0c4","#8b5e9e","#3d9b9b","#a8833f","#7a9e3d"];
  const upd=(i,k,v)=>setRows(rs=>rs.map((r,j)=>j===i?{...r,[k]:v}:r));
  const addRow=()=>{
    const nextId=Math.max(-1,...rows.map(r=>r.id),...cats.map(c=>c.id))+1;
    setRows(rs=>[...rs,{id:nextId,nameEn:"",nameHu:"",color:PALETTE[rs.length%PALETTE.length],sort:rs.length}]);
  };
  const removeRow=(i)=>{
    const r=rows[i];
    if(r.id!==undefined && cats.some(c=>c.id===r.id)) setRemoved(x=>[...x,r.id]);
    setRows(rs=>rs.filter((_,j)=>j!==i));
  };
  const save=async()=>{
    // Validate
    for(const r of rows){
      if(!r.nameEn.trim()||!r.nameHu.trim()){ alert("All categories need both EN and HU names"); return; }
    }
    setSaving(true);
    const withSort=rows.map((r,i)=>({...r,nameEn:r.nameEn.trim(),nameHu:r.nameHu.trim(),sort:i}));
    await onSave(withSort,removed);
    setSaving(false);
  };

  const ipt={...inputSt,padding:"7px 10px",fontSize:13};
  return <div style={{maxWidth:720,margin:"0 auto",padding:"24px 16px"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
      <h2 style={{margin:0,fontSize:18,color:C.text}}>🏷 {t.manageCats}</h2>
      <button onClick={addRow} style={{padding:"7px 14px",background:"transparent",
        border:`1px solid ${C.gold}`,borderRadius:8,color:C.gold,fontSize:13,
        cursor:"pointer",fontFamily:FONT,fontWeight:"bold"}}>+ {t.addCategory}</button>
    </div>
    <p style={{fontSize:12,color:C.muted,marginBottom:18,lineHeight:1.6}}>
      Rename, recolor, add or remove categories. Removing a category that recipes still use will leave those recipes showing "—" until you reassign them.
    </p>

    <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
      {rows.map((r,i)=>(
        <div key={i} style={{background:"#fff",borderRadius:11,padding:"12px 14px",
          border:`1px solid ${C.border}`,display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap"}}>
          <div style={{flex:"1 1 160px"}}>
            <label style={{display:"block",fontSize:9,color:"#9c7a3c",letterSpacing:1.5,marginBottom:3,fontWeight:"bold"}}>EN NAME</label>
            <input value={r.nameEn} onChange={e=>upd(i,"nameEn",e.target.value)} placeholder="English" style={ipt}/>
          </div>
          <div style={{flex:"1 1 160px"}}>
            <label style={{display:"block",fontSize:9,color:"#9c7a3c",letterSpacing:1.5,marginBottom:3,fontWeight:"bold"}}>HU NAME</label>
            <input value={r.nameHu} onChange={e=>upd(i,"nameHu",e.target.value)} placeholder="Magyar" style={ipt}/>
          </div>
          <div>
            <label style={{display:"block",fontSize:9,color:"#9c7a3c",letterSpacing:1.5,marginBottom:3,fontWeight:"bold"}}>COLOR</label>
            <div style={{display:"flex",gap:4}}>
              {PALETTE.slice(0,5).map(col=>(
                <button key={col} onClick={()=>upd(i,"color",col)} style={{width:22,height:22,borderRadius:"50%",
                  background:col,border:r.color===col?`2px solid ${C.text}`:"2px solid transparent",cursor:"pointer"}}/>
              ))}
            </div>
          </div>
          <button onClick={()=>removeRow(i)} style={{padding:"7px 11px",background:"#fff0f0",
            border:"1px solid #fcc",borderRadius:7,color:"#c44",fontSize:13,cursor:"pointer",fontFamily:FONT}}>✕</button>
        </div>
      ))}
    </div>

    <button onClick={save} disabled={saving} style={{padding:"11px 24px",
      background:saving?"#ddd":`linear-gradient(135deg,${C.gold},${C.goldL})`,
      border:"none",borderRadius:10,color:saving?"#999":C.dark,fontWeight:"bold",fontSize:14,
      cursor:saving?"not-allowed":"pointer",fontFamily:FONT}}>
      {saving?"…":"💾 Save categories"}
    </button>
  </div>;
}

// ── EXPORT PANEL (#9) ─────────────────────────────────────────────────────────
function ExportPanel({t,lang,allStubs}){
  const cats=useContext(CatCtx);
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState("");

  const exportJSON=async()=>{
    setBusy(true);setMsg("");
    try{
      // Fetch full recipes (with ingredients/steps)
      const full=[];
      for(const s of allStubs){
        const r=await fetchRecipeById(s.id);
        if(r)full.push(r);
      }
      const blob=new Blob([JSON.stringify(full,null,2)],{type:"application/json"});
      downloadBlob(blob,`recipes-backup-${new Date().toISOString().slice(0,10)}.json`);
      setMsg(`✓ Exported ${full.length} recipes (JSON)`);
    }catch(e){setMsg("Export failed: "+(e.message||e));}
    setBusy(false);
  };

  const exportCSV=async()=>{
    setBusy(true);setMsg("");
    try{
      const full=[];
      for(const s of allStubs){
        const r=await fetchRecipeById(s.id);
        if(r)full.push(r);
      }
      const esc=v=>`"${String(v??"").replace(/"/g,'""')}"`;
      const rows=[["ID","HU Name","EN Name","Category","Pack Spec","Shelf Life","Vacuum","Status","Allergens","Author","Ingredients","Steps"].join(",")];
      full.forEach(r=>{
        const ings=(r.ingredients||[]).map(i=>`${i.name}${i.qty?` (${i.qty})`:""}`).join("; ");
        const steps=(r.steps||[]).map((s,i)=>`${i+1}. ${s.desc}`).join(" | ");
        rows.push([r.id,r.huName,r.enName,catLabel(cats,r.category,lang),r.packSpec,r.shelfLife,r.vacuumLevel,r.status,(r.allergens||[]).join(";"),r.author,ings,steps].map(esc).join(","));
      });
      const blob=new Blob(["\ufeff"+rows.join("\n")],{type:"text/csv;charset=utf-8"});
      downloadBlob(blob,`recipes-${new Date().toISOString().slice(0,10)}.csv`);
      setMsg(`✓ Exported ${full.length} recipes (CSV)`);
    }catch(e){setMsg("Export failed: "+(e.message||e));}
    setBusy(false);
  };

  const btn={padding:"12px 22px",border:"none",borderRadius:10,fontWeight:"bold",
    fontSize:14,cursor:busy?"not-allowed":"pointer",fontFamily:FONT,opacity:busy?0.5:1};
  return <div style={{maxWidth:600,margin:"0 auto",padding:"30px 16px"}}>
    <div style={{background:"#fff",borderRadius:14,padding:"24px",border:`1px solid ${C.border}`}}>
      <h2 style={{margin:"0 0 8px",fontSize:18,color:C.text}}>💾 {t.exportData}</h2>
      <p style={{fontSize:13,color:C.muted,lineHeight:1.6,marginBottom:20}}>
        Download a full backup of all {allStubs.length} recipes. JSON keeps everything (re-importable);
        CSV opens in Excel for reading.
      </p>
      <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
        <button onClick={exportJSON} disabled={busy} style={{...btn,background:`linear-gradient(135deg,${C.gold},${C.goldL})`,color:C.dark}}>
          {busy?"…":"⬇ JSON (backup)"}
        </button>
        <button onClick={exportCSV} disabled={busy} style={{...btn,background:"transparent",border:`1.5px solid ${C.gold}`,color:C.gold}}>
          {busy?"…":"⬇ CSV (Excel)"}
        </button>
      </div>
      {msg&&<div style={{marginTop:16,fontSize:13,color:msg.startsWith("✓")?"#3d7a52":C.danger,fontWeight:"bold"}}>{msg}</div>}
    </div>
  </div>;
}
function downloadBlob(blob,filename){
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();
  document.body.removeChild(a);URL.revokeObjectURL(url);
}

// ── User Management ──────────────────────────────────────────────────────────
function UserMgmt({t,currentUser,users,onAdd,onDelete,onChangePassword}){
  const [adding,setAdding]=useState(false);
  const [newUser,setNewUser]=useState({username:"",name:"",password:"",role:"staff"});
  const [pwdEditId,setPwdEditId]=useState(null);
  const [pwdValue,setPwdValue]=useState("");
  const [confirmDelId,setConfirmDelId]=useState(null);
  const [err,setErr]=useState("");

  const ROLE_COLOR={admin:"#c04040",chef:"#a8833f",staff:"#5a9e6f"};

  const handleAdd=async()=>{
    const u=newUser.username.trim(), n=newUser.name.trim(), p=newUser.password.trim();
    if(!u||!n||!p){setErr("All fields are required");return;}
    if(p.length<6){setErr("Password must be at least 6 characters");return;}
    if(users.some(x=>x.username===u)){setErr(`Username "${u}" already exists`);return;}
    await onAdd({username:u,name:n,password:p,role:newUser.role});
    setNewUser({username:"",name:"",password:"",role:"staff"});
    setAdding(false);setErr("");
  };
  const handlePwd=async(id)=>{
    if(pwdValue.length<6){setErr("Password must be at least 6 characters");return;}
    await onChangePassword(id,pwdValue);
    setPwdEditId(null);setPwdValue("");setErr("");
  };

  const ipt={...inputSt,padding:"8px 11px",fontSize:13};

  return <div style={{maxWidth:760,margin:"0 auto",padding:"22px 16px"}}>
    {/* Header + Add button */}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
      <h2 style={{margin:0,fontSize:18,color:C.text}}>Team members ({users.length})</h2>
      {!adding&&<button onClick={()=>{setAdding(true);setErr("");}} style={{padding:"8px 16px",
        background:`linear-gradient(135deg,${C.gold},${C.goldL})`,border:"none",borderRadius:9,
        color:C.dark,fontWeight:"bold",fontSize:13,cursor:"pointer",fontFamily:FONT}}>
        + Add user
      </button>}
    </div>

    {/* Add form */}
    {adding&&<div style={{background:"#fff",borderRadius:12,padding:"16px 18px",marginBottom:18,
      border:`1.5px solid ${C.gold}`,boxShadow:"0 2px 10px rgba(168,131,63,.12)"}}>
      <div style={{fontSize:13,fontWeight:"bold",color:C.text,marginBottom:13}}>New user account</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <div>
          <label style={{display:"block",fontSize:10,color:"#9c7a3c",letterSpacing:1.5,marginBottom:4,fontWeight:"bold"}}>USERNAME</label>
          <input value={newUser.username} onChange={e=>setNewUser(p=>({...p,username:e.target.value.toLowerCase().replace(/\s/g,"")}))} placeholder="e.g. jane" style={ipt}/>
        </div>
        <div>
          <label style={{display:"block",fontSize:10,color:"#9c7a3c",letterSpacing:1.5,marginBottom:4,fontWeight:"bold"}}>DISPLAY NAME</label>
          <input value={newUser.name} onChange={e=>setNewUser(p=>({...p,name:e.target.value}))} placeholder="e.g. Jane Doe" style={ipt}/>
        </div>
        <div>
          <label style={{display:"block",fontSize:10,color:"#9c7a3c",letterSpacing:1.5,marginBottom:4,fontWeight:"bold"}}>PASSWORD (≥6 chars)</label>
          <input type="text" value={newUser.password} onChange={e=>setNewUser(p=>({...p,password:e.target.value}))} placeholder="At least 6 characters" style={ipt}/>
        </div>
        <div>
          <label style={{display:"block",fontSize:10,color:"#9c7a3c",letterSpacing:1.5,marginBottom:4,fontWeight:"bold"}}>ROLE</label>
          <select value={newUser.role} onChange={e=>setNewUser(p=>({...p,role:e.target.value}))} style={ipt}>
            <option value="staff">Staff (view only)</option>
            <option value="chef">Chef (can edit recipes)</option>
            <option value="admin">Admin (full access)</option>
          </select>
        </div>
      </div>
      {err&&<div style={{color:C.danger,fontSize:12,marginBottom:10}}>{err}</div>}
      <div style={{display:"flex",gap:8}}>
        <button onClick={handleAdd} style={{padding:"8px 18px",background:`linear-gradient(135deg,${C.gold},${C.goldL})`,
          border:"none",borderRadius:8,color:C.dark,fontWeight:"bold",fontSize:13,cursor:"pointer",fontFamily:FONT}}>
          Create user
        </button>
        <button onClick={()=>{setAdding(false);setErr("");}} style={{padding:"8px 14px",
          background:"transparent",border:"1px solid #ccc",borderRadius:8,
          color:"#666",fontSize:13,cursor:"pointer",fontFamily:FONT}}>Cancel</button>
      </div>
    </div>}

    {/* User list */}
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {users.map(u=>{
        const isSelf=u.id===currentUser.id;
        const isLastAdmin=u.role==="admin"&&users.filter(x=>x.role==="admin").length===1;
        return <div key={u.id} style={{background:"#fff",borderRadius:11,padding:"13px 16px",
          border:`1px solid ${C.border}`,boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <div style={{width:34,height:34,borderRadius:"50%",background:`linear-gradient(135deg,${C.gold},${C.goldL})`,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,color:C.dark,fontWeight:"bold",flexShrink:0}}>
              {u.name[0]}
            </div>
            <div style={{flex:1,minWidth:140}}>
              <div style={{fontSize:14,fontWeight:"bold",color:C.text}}>
                {u.name} {isSelf&&<span style={{fontSize:11,color:C.gold,fontWeight:"normal",marginLeft:6}}>(you)</span>}
              </div>
              <div style={{fontSize:11,color:C.muted}}>@{u.username}</div>
            </div>
            <span style={{padding:"3px 10px",borderRadius:8,fontSize:11,fontWeight:"bold",letterSpacing:.5,
              background:(ROLE_COLOR[u.role]||"#888")+"22",color:ROLE_COLOR[u.role]||"#888",
              border:`1px solid ${ROLE_COLOR[u.role]||"#888"}44`,textTransform:"uppercase"}}>
              {u.role}
            </span>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>{setPwdEditId(u.id);setPwdValue("");setErr("");}}
                style={{padding:"5px 11px",background:"transparent",border:`1px solid ${C.gold}`,
                  borderRadius:7,color:C.gold,fontSize:11,cursor:"pointer",fontFamily:FONT}}>
                🔑 Password
              </button>
              {!isSelf&&!isLastAdmin&&<button onClick={()=>setConfirmDelId(u.id)}
                style={{padding:"5px 11px",background:"transparent",border:`1px solid ${C.danger}`,
                  borderRadius:7,color:C.danger,fontSize:11,cursor:"pointer",fontFamily:FONT}}>
                ✕ Delete
              </button>}
            </div>
          </div>
          {/* Password change inline */}
          {pwdEditId===u.id&&<div style={{marginTop:11,padding:"11px 13px",background:"rgba(168,131,63,.07)",
            borderRadius:8,border:`1px solid rgba(168,131,63,.25)`}}>
            <div style={{fontSize:11,color:"#8a7050",marginBottom:6}}>New password for <b>{u.name}</b>:</div>
            <div style={{display:"flex",gap:7}}>
              <input type="text" value={pwdValue} onChange={e=>setPwdValue(e.target.value)} placeholder="At least 6 characters" style={{...ipt,flex:1}} autoFocus/>
              <button onClick={()=>handlePwd(u.id)} style={{padding:"7px 14px",background:C.gold,
                border:"none",borderRadius:7,color:C.dark,fontWeight:"bold",fontSize:12,cursor:"pointer",fontFamily:FONT}}>
                Save
              </button>
              <button onClick={()=>{setPwdEditId(null);setPwdValue("");setErr("");}}
                style={{padding:"7px 12px",background:"transparent",border:"1px solid #ccc",
                  borderRadius:7,color:"#666",fontSize:12,cursor:"pointer",fontFamily:FONT}}>Cancel</button>
            </div>
            {err&&pwdEditId===u.id&&<div style={{color:C.danger,fontSize:11,marginTop:6}}>{err}</div>}
          </div>}
          {/* Delete confirm */}
          {confirmDelId===u.id&&<div style={{marginTop:11,padding:"11px 13px",background:"#fff5f5",
            borderRadius:8,border:"1px solid #fcc"}}>
            <div style={{color:C.danger,fontSize:12,marginBottom:8}}>Delete <b>{u.name}</b>'s account? This cannot be undone.</div>
            <div style={{display:"flex",gap:7}}>
              <button onClick={()=>{onDelete(u.id);setConfirmDelId(null);}}
                style={{padding:"6px 13px",background:C.danger,border:"none",borderRadius:7,
                  color:"#fff",fontSize:12,cursor:"pointer",fontFamily:FONT}}>
                Yes, delete
              </button>
              <button onClick={()=>setConfirmDelId(null)} style={{padding:"6px 13px",
                background:"transparent",border:"1px solid #ccc",borderRadius:7,
                color:"#666",fontSize:12,cursor:"pointer",fontFamily:FONT}}>Cancel</button>
            </div>
          </div>}
        </div>;
      })}
    </div>

    <div style={{marginTop:18,padding:"11px 14px",background:"rgba(74,144,196,.07)",
      borderRadius:9,border:"1px solid rgba(74,144,196,.2)",color:"#4a90c4",fontSize:11,lineHeight:1.7}}>
      💡 <b>Roles:</b> Admin = full access incl. user management · Chef = can create/edit recipes · Staff = view only
    </div>
  </div>;
}

// ── Change Log ────────────────────────────────────────────────────────────────
function ChangeLog({t,user,auditTick}){
  const [log,setLog]=useState([]);
  const [filter,setFilter]=useState("all"); // all | create | edit | delete | import | bulk-edit

  useEffect(()=>{
    fetchAuditLog(300).then(setLog).catch(()=>{});
  },[auditTick]);

  const ACTION_COLOR={create:"#5a9e6f",edit:"#4a90c4","bulk-edit":"#8b5e9e",import:"#a8833f",delete:"#c04040",restore:"#3d9b9b","user-add":"#5a9e6f","user-del":"#c04040","pwd-change":"#4a90c4"};
  const filtered = filter==="all" ? log : log.filter(e=>e.action===filter);

  const fmt = ts => {
    const d=new Date(ts);
    return d.toLocaleDateString("en-GB",{day:"2-digit",month:"short"})+" "+
           d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
  };

  return <div style={{maxWidth:860,margin:"0 auto",padding:"24px 16px"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,flexWrap:"wrap",gap:10}}>
      <h2 style={{margin:0,fontSize:18,color:C.text}}>Change History ({filtered.length})</h2>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {["all","create","edit","bulk-edit","import","delete","restore"].map(a=>(
          <button key={a} onClick={()=>setFilter(a)} style={{
            padding:"4px 12px",borderRadius:20,fontSize:11,cursor:"pointer",fontFamily:FONT,
            border:`1px solid ${ACTION_COLOR[a]||"#888"}`,
            background:filter===a?(ACTION_COLOR[a]||"#888"):"transparent",
            color:filter===a?"#fff":(ACTION_COLOR[a]||"#888"),
          }}>{a}</button>
        ))}
      </div>
    </div>

    {filtered.length===0
      ?<div style={{textAlign:"center",padding:"60px 0",color:C.muted}}>No changes recorded yet</div>
      :<div style={{display:"flex",flexDirection:"column",gap:8}}>
        {filtered.map(entry=>(
          <div key={entry.id} style={{background:"#fff",borderRadius:12,padding:"13px 16px",
            border:`1px solid ${C.border}`,boxShadow:"0 1px 4px rgba(0,0,0,.05)",
            display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
            {/* Action badge */}
            <span style={{padding:"3px 10px",borderRadius:8,fontSize:11,fontWeight:"bold",
              background:(ACTION_COLOR[entry.action]||"#888")+"22",
              color:ACTION_COLOR[entry.action]||"#888",
              border:`1px solid ${ACTION_COLOR[entry.action]||"#888"}44`,
              flexShrink:0,textTransform:"uppercase",letterSpacing:.5}}>
              {entry.action}
            </span>
            {/* Recipe name */}
            <span style={{fontWeight:"bold",color:C.text,fontSize:14,flex:1,minWidth:120}}>
              {entry.recipeName||entry.recipeId}
            </span>
            {/* User */}
            <span style={{display:"flex",alignItems:"center",gap:6,color:C.muted,fontSize:12,flexShrink:0}}>
              <div style={{width:22,height:22,borderRadius:"50%",background:`linear-gradient(135deg,${C.gold},${C.goldL})`,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:C.dark,fontWeight:"bold"}}>
                {(entry.userName||"?")[0]}
              </div>
              {entry.userName||"Unknown"}
            </span>
            {/* Timestamp */}
            <span style={{color:C.muted,fontSize:11,flexShrink:0}}>{fmt(entry.ts)}</span>
            {/* Detail */}
            {entry.diff&&(entry.diff.ings||entry.diff.steps)
              ?<span style={{color:C.muted,fontSize:11,flexShrink:0}}>
                  {entry.diff.ings} ingredients · {entry.diff.steps} steps
                </span>
              :null}
          </div>
        ))}
      </div>}
  </div>;
}

// ── Bulk Edit ─────────────────────────────────────────────────────────────────
function BulkEdit({t,lang,allStubs,onBulkSave}){
  const cats=useContext(CatCtx);
  const [selected,setSelected]=useState(new Set());
  const [fields,setFields]=useState({category:"",packSpec:"",shelfLife:"",vacuumLevel:""});
  const [search,setSearch]=useState("");
  const [saving,setSaving]=useState(false);
  const [done,setDone]=useState(0);

  const getName=r=>lang==="en"?(r.enName||r.huName):(r.huName||r.enName);
  const visible=allStubs.filter(r=>{
    const q=search.toLowerCase();
    return (r.enName||"").toLowerCase().includes(q)||(r.huName||"").toLowerCase().includes(q);
  });

  const toggle=id=>setSelected(s=>{const n=new Set(s);n.has(id)?n.delete(id):n.add(id);return n;});
  const toggleAll=()=>selected.size===visible.length
    ?setSelected(new Set())
    :setSelected(new Set(visible.map(r=>r.id)));

  const handleApply=async()=>{
    if(!selected.size)return;
    setSaving(true);setDone(0);
    const toSave=[];
    for(const id of selected){
      const full=await fetchRecipeById(id);
      if(!full)continue;
      const updated={...full};
      if(fields.category!=="")updated.category=+fields.category;
      if(fields.packSpec!=="")updated.packSpec=fields.packSpec;
      if(fields.shelfLife!=="")updated.shelfLife=fields.shelfLife;
      if(fields.vacuumLevel!=="")updated.vacuumLevel=fields.vacuumLevel;
      toSave.push(updated);
      setDone(n=>n+1);
    }
    await onBulkSave(toSave);
    setSaving(false);
    setSelected(new Set());
    setFields({category:"",packSpec:"",shelfLife:"",vacuumLevel:""});
    setDone(0);
  };

  const inputSm={...inputSt,padding:"7px 10px",fontSize:12};

  return <div style={{maxWidth:940,margin:"0 auto",padding:"24px 16px"}}>
    {/* Field editors */}
    <div style={{background:"#fff",borderRadius:14,padding:"18px 20px",marginBottom:18,
      border:`1px solid ${C.border}`,boxShadow:"0 2px 8px rgba(0,0,0,.05)"}}>
      <div style={{fontSize:13,fontWeight:"bold",color:C.text,marginBottom:13}}>
        Apply to selected ({selected.size} recipe{selected.size!==1?"s":""}):
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:12}}>
        <div>
          <label style={{display:"block",fontSize:10,color:"#9c7a3c",letterSpacing:2,marginBottom:5,textTransform:"uppercase"}}>{t.category}</label>
          <select value={fields.category} onChange={e=>setFields(f=>({...f,category:e.target.value}))} style={inputSm}>
            <option value="">— no change —</option>
            {cats.map(c=><option key={c.id} value={c.id}>{lang==="en"?c.nameEn:c.nameHu}</option>)}
          </select>
        </div>
        {[[t.packSpec,"packSpec"],[t.shelfLife,"shelfLife"],[t.vacuumLevel,"vacuumLevel"]].map(([l,k])=>(
          <div key={k}>
            <label style={{display:"block",fontSize:10,color:"#9c7a3c",letterSpacing:2,marginBottom:5,textTransform:"uppercase"}}>{l}</label>
            <input type="text" placeholder="no change" value={fields[k]}
              onChange={e=>setFields(f=>({...f,[k]:e.target.value}))} style={inputSm}/>
          </div>
        ))}
      </div>
      <div style={{marginTop:14,display:"flex",alignItems:"center",gap:10}}>
        <button onClick={handleApply} disabled={saving||!selected.size||Object.values(fields).every(v=>v==="")}
          style={{padding:"9px 22px",background:`linear-gradient(135deg,${C.gold},${C.goldL})`,
            border:"none",borderRadius:9,color:C.dark,fontWeight:"bold",fontSize:13,
            cursor:saving||!selected.size?"not-allowed":"pointer",fontFamily:FONT,
            opacity:saving||!selected.size?0.5:1}}>
          {saving?`Saving ${done}/${selected.size}…`:`Apply to ${selected.size} recipe${selected.size!==1?"s":""}`}
        </button>
        {selected.size>0&&<button onClick={()=>setSelected(new Set())} style={{
          padding:"9px 14px",background:"transparent",border:`1px solid #ccc`,
          borderRadius:9,color:"#888",fontSize:13,cursor:"pointer",fontFamily:FONT}}>
          Clear selection
        </button>}
      </div>
    </div>

    {/* Recipe list with checkboxes */}
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
      <div style={{position:"relative",flex:1}}>
        <span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",opacity:.4}}>🔍</span>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filter recipes…"
          style={{...inputSt,paddingLeft:34}}/>
      </div>
      <button onClick={toggleAll} style={{padding:"9px 14px",background:"transparent",
        border:`1px solid ${C.gold}`,borderRadius:9,color:C.gold,fontSize:12,
        cursor:"pointer",fontFamily:FONT,whiteSpace:"nowrap"}}>
        {selected.size===visible.length?"Deselect all":"Select all"}
      </button>
    </div>

    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      {visible.map(r=>{
        const isSel=selected.has(r.id);
        const col=catColor(cats,r.category);
        return <div key={r.id} onClick={()=>toggle(r.id)}
          style={{background:isSel?"rgba(168,131,63,.08)":"#fff",borderRadius:10,
            padding:"11px 14px",border:`1.5px solid ${isSel?C.gold:C.border}`,
            cursor:"pointer",display:"flex",alignItems:"center",gap:12,transition:"all .15s"}}>
          <div style={{width:20,height:20,borderRadius:4,border:`2px solid ${isSel?C.gold:"#ccc"}`,
            background:isSel?C.gold:"transparent",display:"flex",alignItems:"center",justifyContent:"center",
            flexShrink:0,transition:"all .15s"}}>
            {isSel&&<span style={{color:"#fff",fontSize:13,lineHeight:1}}>✓</span>}
          </div>
          <span style={{padding:"2px 8px",borderRadius:8,fontSize:10,background:`${col}22`,
            color:col,fontWeight:"bold",flexShrink:0}}>{catLabel(cats,r.category,lang)}</span>
          <span style={{fontWeight:"bold",color:C.text,fontSize:13,flex:1,
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{getName(r)}</span>
          {lang==="en"&&r.huName&&<span style={{fontSize:11,color:C.muted,
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:180}}>{r.huName}</span>}
          <span style={{fontSize:11,color:C.muted,flexShrink:0}}>
            {r.packSpec?`📦${r.packSpec} `:""}{r.vacuumLevel?`🔧${r.vacuumLevel}`:""}
          </span>
        </div>;
      })}
    </div>
  </div>;
}

// ── Bulk Import ───────────────────────────────────────────────────────────────
function BulkImport({t,lang,onBulkImport}){
  const cats=useContext(CatCtx);
  const [text,setText]=useState("");
  const [preview,setPreview]=useState([]);
  const [importing,setSaving]=useState(false);
  const [msg,setMsg]=useState("");

  const EXAMPLE = `English Name\tHungarian Name\tCategory (0-5)\tServes\tPrep min\tCook min\tIngredients (name|qty; name|qty)\tSteps (step1; step2)
Mapo Tofu\tMapo Tofu\t0\t4\t15\t20\tTofu|400g; Pork mince|100g; Doubanjiang|2 tbsp\tFry pork until cooked.; Add doubanjiang and tofu, simmer 5 min.
Spring Rolls\tTavasztekercs\t1\t6\t20\t10\tRice paper|12 sheets; Shrimp|200g\tSoak rice paper.; Fill and roll tightly.`;

  const parse=()=>{
    const lines=text.trim().split('\n').filter(Boolean);
    if(!lines.length){setPreview([]);return;}
    // Skip header row if it contains "Name" or "Category"
    const start=lines[0].toLowerCase().includes("name")||lines[0].toLowerCase().includes("categ")?1:0;
    const recipes=[];
    for(const line of lines.slice(start)){
      const cols=line.split('\t');
      if(cols.length<2)continue;
      const [enName,huName,catStr,servesStr,prepStr,cookStr,ingStr,stepStr]=cols;
      const cat=Math.min(5,Math.max(0,parseInt(catStr)||0));
      const ings=(ingStr||"").split(';').map(s=>{
        const [nm,qty]=(s||"").split('|');
        return nm?.trim()?{id:uid(),name:nm.trim(),qty:(qty||"").trim(),image:null}:null;
      }).filter(Boolean);
      const steps=(stepStr||"").split(';').map((s,i)=>
        s.trim()?{id:uid(),desc:s.trim(),image:null}:null).filter(Boolean);
      recipes.push({
        id:`u-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
        enName:(enName||"").trim(),huName:(huName||"").trim(),
        category:cat,serves:parseInt(servesStr)||4,
        prepTime:parseInt(prepStr)||15,cookTime:parseInt(cookStr)||30,
        author:"Head Chef",authorId:1,coverImage:null,createdAt:Date.now(),
        ingredients:ings,steps,
      });
    }
    setPreview(recipes);
    setMsg("");
  };

  const doImport=async()=>{
    if(!preview.length)return;
    setSaving(true);setMsg("");
    await onBulkImport(preview);
    setSaving(false);
    setText("");setPreview([]);
    setMsg(`✓ Imported ${preview.length} recipe${preview.length!==1?"s":""} successfully`);
  };

  return <div style={{maxWidth:900,margin:"0 auto",padding:"24px 16px"}}>
    {/* Format guide */}
    <div style={{background:"rgba(168,131,63,.07)",border:`1px solid rgba(168,131,63,.25)`,
      borderRadius:12,padding:"14px 18px",marginBottom:18}}>
      <div style={{fontSize:12,fontWeight:"bold",color:C.gold,marginBottom:8}}>📋 Format: Tab-separated columns</div>
      <div style={{fontSize:11,color:"#8a7050",lineHeight:1.7,fontFamily:"monospace"}}>
        EN Name · HU Name · Category (0-5) · Serves · Prep min · Cook min · Ingredients (name|qty; name|qty) · Steps (step1; step2)
      </div>
      <div style={{marginTop:10,fontSize:11,color:C.muted}}>
        Categories: 0=Sauce, 1=Cold, 2=Soup, 3=Staple, 4=Dessert, 5=Fermented
      </div>
      <button onClick={()=>setText(EXAMPLE)} style={{marginTop:10,padding:"5px 12px",
        background:"transparent",border:`1px solid ${C.gold}`,borderRadius:7,
        color:C.gold,fontSize:11,cursor:"pointer",fontFamily:FONT}}>Load example</button>
    </div>

    {/* Paste area */}
    <div style={{marginBottom:14}}>
      <label style={{display:"block",fontSize:10,color:"#9c7a3c",letterSpacing:2,marginBottom:6,textTransform:"uppercase"}}>
        Paste tab-separated data here (copy from Excel / Google Sheets)
      </label>
      <textarea value={text} onChange={e=>setText(e.target.value)}
        placeholder="Paste rows here…"
        rows={8} style={{...inputSt,resize:"vertical",minHeight:140,fontFamily:"monospace",fontSize:12}}/>
    </div>

    <div style={{display:"flex",gap:10,marginBottom:18}}>
      <button onClick={parse} style={{padding:"9px 20px",background:`linear-gradient(135deg,${C.gold},${C.goldL})`,
        border:"none",borderRadius:9,color:C.dark,fontWeight:"bold",fontSize:13,cursor:"pointer",fontFamily:FONT}}>
        Preview ({text.trim().split('\n').filter(Boolean).length} rows)
      </button>
      {preview.length>0&&<button onClick={doImport} disabled={importing}
        style={{padding:"9px 20px",background:importing?"#ddd":"linear-gradient(135deg,#5a9e6f,#3d7a52)",
          border:"none",borderRadius:9,color:importing?"#999":"#fff",fontWeight:"bold",
          fontSize:13,cursor:importing?"not-allowed":"pointer",fontFamily:FONT}}>
        {importing?`Importing…`:`✓ Import ${preview.length} recipe${preview.length!==1?"s":""}`}
      </button>}
      {text&&<button onClick={()=>{setText("");setPreview([]);setMsg("");}}
        style={{padding:"9px 14px",background:"transparent",border:`1px solid #ccc`,
          borderRadius:9,color:"#888",fontSize:13,cursor:"pointer",fontFamily:FONT}}>Clear</button>}
    </div>

    {msg&&<div style={{padding:"10px 16px",background:"rgba(90,158,111,.12)",border:"1px solid rgba(90,158,111,.4)",
      borderRadius:9,color:"#3d7a52",fontSize:13,marginBottom:16}}>{msg}</div>}

    {/* Preview table */}
    {preview.length>0&&<>
      <div style={{fontSize:13,fontWeight:"bold",color:C.text,marginBottom:10}}>
        Preview — {preview.length} recipe{preview.length!==1?"s":""}:
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {preview.map((r,i)=>(
          <div key={r.id} style={{background:"#fff",borderRadius:10,padding:"12px 15px",
            border:`1px solid ${C.border}`,display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{color:C.muted,fontSize:12,width:24,textAlign:"center"}}>{i+1}</span>
            <span style={{padding:"2px 9px",borderRadius:8,fontSize:10,fontWeight:"bold",
              background:`${catColor(cats,r.category)}22`,color:catColor(cats,r.category)}}>
              {catLabel(cats,r.category,lang)}
            </span>
            <span style={{fontWeight:"bold",color:C.text,fontSize:13,flex:1}}>{r.enName||r.huName}</span>
            {r.huName&&r.enName&&<span style={{color:C.muted,fontSize:12}}>{r.huName}</span>}
            <span style={{color:C.muted,fontSize:11,flexShrink:0}}>
              {r.ingredients.length} ings · {r.steps.length} steps · 👥{r.serves}
            </span>
          </div>
        ))}
      </div>
    </>}
  </div>;
}

