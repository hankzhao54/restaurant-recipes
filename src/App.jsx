import { useState, useEffect, useRef } from "react";
import {
  supabase,
  signIn, signOut, getCurrentProfile,
  fetchAllRecipes, fetchRecipeById, upsertRecipe, deleteRecipe,
  fetchAllUsers, adminCreateUser, adminChangePassword, adminDeleteUser,
  logAction, fetchAuditLog,
} from "./supabase.js";
import { resolveImage } from "./utils/image.js";

// ── i18n — EN (primary) + HU only ────────────────────────────────────────────
const T = {
  en: {
    appName:"101 Kitchen Recipes", tagline:"Restaurant Recipe Management",
    login:"Login", logout:"Log out", username:"Username", password:"Password",
    loginBtn:"Sign In", wrongCreds:"Incorrect username or password",
    search:"Search recipes…", allCats:"All",
    addRecipe:"New Recipe", newRecipe:"New Recipe", editRecipe:"Edit Recipe",
    recipeName:"Recipe Name", recipeName_hu:"Hungarian Name (optional)",
    category:"Category", serves:"Serves", prepTime:"Prep (min)", cookTime:"Cook (min)",
    mins:"min", portions:"portions",
    ingredients:"Ingredients", ingredientName:"Ingredient name", ingredientQty:"Quantity",
    addIngredient:"+ Add Ingredient",
    steps:"Steps", stepDesc:"Describe this step…", addStep:"+ Add Step",
    publish:"Save & Publish", cancel:"Cancel", by:"By",
    categories:["Sauce / Marinade","Cold Dish","Stock / Soup","Staple / Noodle","Dessert / Bread","Fermented / Spice"],
    catLabels:["Sauce","Cold","Soup","Staple","Dessert","Fermented"],
    catColors:["#c8922a","#5a9e6f","#4a90c4","#c4774a","#c06090","#4ab0c4"],
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
    search:"Receptek keresése…", allCats:"Összes",
    addRecipe:"Új Recept", newRecipe:"Új Recept", editRecipe:"Recept szerkesztése",
    recipeName:"Recept neve (HU)", recipeName_hu:"",
    category:"Kategória", serves:"Adag", prepTime:"Előkészítés (perc)", cookTime:"Főzés (perc)",
    mins:"perc", portions:"adag",
    ingredients:"Hozzávalók", ingredientName:"Hozzávaló neve", ingredientQty:"Mennyiség",
    addIngredient:"+ Hozzávaló hozzáadása",
    steps:"Lépések", stepDesc:"Írja le a lépést…", addStep:"+ Lépés hozzáadása",
    publish:"Mentés & Közzétesz", cancel:"Mégsem", by:"Készítette",
    categories:["Szósz / Marinád","Hideg étel","Alaplé / Leves","Tészta / Főétel","Desszert / Kenyér","Fermentált / Fűszer"],
    catLabels:["Szósz","Hideg","Leves","Tészta","Desszert","Fermentált"],
    catColors:["#c8922a","#5a9e6f","#4a90c4","#c4774a","#c06090","#4ab0c4"],
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
const C={bg:"#fdf8f0",card:"#fff",dark:"#1a1208",gold:"#c8922a",goldL:"#e8b84b",goldD:"#8b5e1a",text:"#2a1a05",muted:"#a08060",border:"#e8dcc8",danger:"#c04040"};
const FONT="'Georgia','Noto Serif SC',serif";
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
        <span style={{color:"#d0b080",fontSize:11,maxWidth:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</span>
        <button onClick={onLogout} style={{background:"transparent",border:`1px solid rgba(200,146,42,.35)`,
          color:"#a08040",fontSize:11,padding:"4px 10px",borderRadius:6,cursor:"pointer",fontFamily:FONT}}>
          {t.logout}
        </button>
      </>}
    </div>
  </div>;
}

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
            border:`2px dashed ${drag?C.gold:"#ddd"}`,background:drag?"rgba(200,146,42,.07)":"rgba(0,0,0,.02)",
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
    <label style={{display:"block",fontSize:10,color:"#a07030",letterSpacing:2,marginBottom:6,textTransform:"uppercase"}}>{label}</label>
    {children}
  </div>;
}
function SI(props){return <input {...props} style={{...inputSt,...(props.style||{})}}/>;}
function SHead({title,color}){
  return <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:13}}>
    <div style={{width:4,height:20,background:color,borderRadius:2}}/>
    <h2 style={{margin:0,fontSize:16,color:C.text,fontWeight:"bold"}}>{title}</h2>
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
    backgroundImage:`radial-gradient(ellipse at 55% 35%,#2e1f0a,${C.dark})`}}>
    <div style={{position:"absolute",top:0,left:0,right:0,height:3,
      background:`linear-gradient(90deg,${C.goldD},${C.gold},${C.goldL},${C.gold},${C.goldD})`}}/>
    <div style={{position:"absolute",top:14,right:18}}><LangSwitcher lang={lang} setLang={setLang}/></div>
    <div style={{textAlign:"center",marginBottom:36}}>
      <div style={{fontSize:50}}>🍽</div>
      <div style={{fontSize:24,fontWeight:"bold",letterSpacing:3,color:C.goldL,
        textShadow:`0 2px 16px rgba(200,146,42,.45)`,marginTop:8}}>{t.appName}</div>
      <div style={{fontSize:11,color:C.goldD,letterSpacing:3,marginTop:5,textTransform:"uppercase"}}>{t.tagline}</div>
      <div style={{width:100,height:1,background:`linear-gradient(90deg,transparent,${C.gold},transparent)`,margin:"14px auto 0"}}/>
    </div>
    <div style={{background:"rgba(255,255,255,.04)",border:`1px solid rgba(200,146,42,.22)`,
      borderRadius:18,padding:"32px 36px",width:300,boxSizing:"border-box",
      backdropFilter:"blur(12px)",boxShadow:"0 22px 60px rgba(0,0,0,.55)"}}>
      {["username","password"].map(f=><div key={f} style={{marginBottom:15}}>
        <label style={{display:"block",fontSize:10,color:C.goldD,letterSpacing:2,marginBottom:5,textTransform:"uppercase"}}>{t[f]}</label>
        <input type={f==="password"?"password":"text"} value={form[f]}
          onChange={e=>setForm(p=>({...p,[f]:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&doLogin()}
          style={{width:"100%",boxSizing:"border-box",background:"rgba(255,255,255,.07)",
            border:`1px solid rgba(200,146,42,.3)`,borderRadius:8,padding:"10px 13px",
            color:"#f0e0b0",fontSize:14,fontFamily:FONT,outline:"none"}}/>
      </div>)}
      {err&&<div style={{color:"#e06060",fontSize:12,marginBottom:11,textAlign:"center"}}>{err}</div>}
      <button onClick={doLogin} disabled={loading} style={{opacity:loading?0.5:1,width:"100%",padding:"12px 0",
        background:`linear-gradient(135deg,${C.gold},${C.goldL})`,
        border:"none",borderRadius:9,color:C.dark,fontWeight:"bold",fontSize:15,
        cursor:"pointer",letterSpacing:2,fontFamily:FONT,
        boxShadow:`0 4px 20px rgba(200,146,42,.38)`}}>{loading?"…":t.loginBtn}</button>
      <div style={{marginTop:15,fontSize:10,color:"rgba(160,128,64,.5)",textAlign:"center",lineHeight:1.8}}>{t.hints}</div>
    </div>
  </div>;
}

// ── LIST ──────────────────────────────────────────────────────────────────────
function ListScreen({t,lang,setLang,user,onLogout,recipes,search,setSearch,activeCat,setActiveCat,onSelect,onAdd,canEdit,isAdmin,onAdmin}){
  return <div style={{minHeight:"100vh",background:C.bg,fontFamily:FONT,display:"flex",flexDirection:"column"}}>
    <TopBar t={t} lang={lang} setLang={setLang} user={user} onLogout={onLogout}
      left={<span style={{color:C.goldL,fontWeight:"bold",fontSize:14,letterSpacing:1}}>🍽 {t.appName}</span>}/>
    <div style={{maxWidth:1040,margin:"0 auto",padding:"20px 16px 52px",width:"100%",boxSizing:"border-box"}}>
      {/* Search + new */}
      <div style={{display:"flex",gap:10,marginBottom:14}}>
        <div style={{flex:1,position:"relative"}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",opacity:.4,fontSize:16}}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={t.search}
            style={{...inputSt,paddingLeft:36,boxShadow:"0 2px 9px rgba(0,0,0,.07)"}}/>
        </div>
        {isAdmin&&<button onClick={onAdmin} style={{padding:"9px 14px",
          background:"transparent",border:`1px solid ${C.gold}`,
          borderRadius:10,color:C.gold,fontWeight:"bold",
          fontSize:13,cursor:"pointer",fontFamily:FONT,whiteSpace:"nowrap"}}>⚙ Admin</button>}
        {canEdit&&<button onClick={onAdd} style={{padding:"9px 18px",
          background:`linear-gradient(135deg,${C.gold},${C.goldL})`,
          border:"none",borderRadius:10,color:C.dark,fontWeight:"bold",
          fontSize:13,cursor:"pointer",fontFamily:FONT,whiteSpace:"nowrap",
          boxShadow:`0 2px 10px rgba(200,146,42,.32)`}}>+ {t.addRecipe}</button>}
      </div>
      {/* Category chips */}
      <div style={{display:"flex",gap:7,marginBottom:20,flexWrap:"wrap"}}>
        <Chip label={`${t.allCats} (${recipes.length})`} active={activeCat===-1} color="#888" onClick={()=>setActiveCat(-1)}/>
        {t.catLabels.map((l,i)=>{
          const cnt=recipes.filter(r=>r.category===i).length;
          return cnt>0?<Chip key={i} label={`${l} (${cnt})`} active={activeCat===i} color={t.catColors[i]} onClick={()=>setActiveCat(i)}/>:null;
        })}
      </div>
      {/* Grid */}
      {recipes.length===0
        ?<div style={{textAlign:"center",padding:"70px 0",color:C.muted,fontSize:16}}>{t.noResults}</div>
        :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(205px,1fr))",gap:15}}>
          {recipes.map(r=><RecipeCard key={r.id} recipe={r} t={t} lang={lang} onClick={()=>onSelect(r)}/>)}
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

function RecipeCard({recipe,t,lang,onClick}){
  const [hov,setHov]=useState(false);
  const col=t.catColors[recipe.category]||C.gold;
  const emo=EMOJIS[(recipe.id?.charCodeAt?.(recipe.id.length-1)||0)%EMOJIS.length];
  const name=getName(recipe,lang);
  const alt=getAltName(recipe,lang);
  return <div onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
    style={{background:C.card,borderRadius:14,overflow:"hidden",cursor:"pointer",
      border:`1px solid ${C.border}`,transition:"all .2s",
      boxShadow:hov?`0 8px 26px rgba(200,146,42,.18)`:"0 2px 8px rgba(0,0,0,.06)",
      transform:hov?"translateY(-3px)":"none"}}>
    <div style={{height:115,overflow:"hidden",position:"relative",background:`linear-gradient(135deg,${col}18,${col}38)`}}>
      {recipe.coverImage
        ?<img src={recipe.coverImage} alt={name} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
        :<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:46}}>{emo}</div>}
      <span style={{position:"absolute",top:7,left:7,padding:"2px 9px",borderRadius:10,
        fontSize:10,background:`${col}dd`,color:"#fff",fontWeight:"bold"}}>
        {t.catLabels[recipe.category]}
      </span>
    </div>
    <div style={{padding:"11px 13px"}}>
      <div style={{fontSize:14,fontWeight:"bold",color:C.text,lineHeight:1.3,
        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:2}}>{name}</div>
      {alt&&<div style={{fontSize:10,color:C.muted,overflow:"hidden",textOverflow:"ellipsis",
        whiteSpace:"nowrap",marginBottom:4}}>{alt}</div>}
      <div style={{display:"flex",gap:11,fontSize:11,color:C.muted}}>
        <span>⏱ {(recipe.prepTime||0)+(recipe.cookTime||0)}{t.mins}</span>
        <span>👥 {recipe.serves}</span>
      </div>
    </div>
  </div>;
}

// ── DETAIL ────────────────────────────────────────────────────────────────────
function DetailScreen({t,lang,setLang,recipe,loading,user,canEdit,onBack,onEdit,onDelete}){
  const [cdel,setCdel]=useState(false);
  const [trans,setTrans]=useState(null);       // translated ings + steps


  if(!recipe&&!loading)return null;
  const col=recipe?(t.catColors[recipe.category]||C.gold):C.gold;
  const emo=recipe?EMOJIS[(recipe.id?.charCodeAt?.(recipe.id.length-1)||0)%EMOJIS.length]:"🍲";
  const isOwner=canEdit&&(user?.id===recipe?.authorId||user?.role==="admin");
  const name=recipe?getName(recipe,lang):"";
  const alt=recipe?getAltName(recipe,lang):"";

  // Local bilingual — no API needed
  const displayIngs=(recipe?.ingredients||[]).map(i=>({...i,name:lang==="en"?(i.enName||i.name):i.name}));
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
              :<span>{emo}</span>}
          </div>
          {/* Title */}
          <div style={{marginBottom:18}}>
            <span style={{display:"inline-block",padding:"3px 12px",borderRadius:12,fontSize:11,
              background:`${col}22`,color:col,border:`1px solid ${col}44`,marginBottom:8}}>
              {t.catLabels[recipe.category]}
              {recipe.section&&t.sections[recipe.section]?" · "+t.sections[recipe.section]:""}
            </span>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
              <div>
                <h1 style={{margin:"0 0 3px",fontSize:26,color:C.text,lineHeight:1.2}}>{name}</h1>
                {alt&&<div style={{fontSize:13,color:C.muted}}>{t.originalName} {alt}</div>}
              </div>
              {isOwner&&!cdel&&<div style={{display:"flex",gap:7,flexShrink:0,marginTop:4}}>
                <button onClick={onEdit} style={{padding:"6px 12px",border:`1px solid ${C.gold}`,borderRadius:7,background:"transparent",color:C.gold,fontSize:12,cursor:"pointer",fontFamily:FONT}}>✎</button>
                <button onClick={()=>setCdel(true)} style={{padding:"6px 12px",border:`1px solid ${C.danger}`,borderRadius:7,background:"transparent",color:C.danger,fontSize:12,cursor:"pointer",fontFamily:FONT}}>✕</button>
              </div>}
            </div>
            <div style={{color:C.muted,fontSize:12,marginTop:4}}>{t.by}: {recipe.author}</div>
          </div>
          {cdel&&<div style={{background:"#fff5f5",border:"1px solid #fcc",borderRadius:11,padding:"14px 16px",marginBottom:18}}>
            <div style={{color:C.danger,fontSize:13,marginBottom:10}}>{t.confirmDelete}</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={onDelete} style={{padding:"6px 14px",background:C.danger,border:"none",borderRadius:7,color:"#fff",fontSize:12,cursor:"pointer",fontFamily:FONT}}>{t.yes}</button>
              <button onClick={()=>setCdel(false)} style={{padding:"6px 14px",background:"transparent",border:"1px solid #ccc",borderRadius:7,color:"#666",fontSize:12,cursor:"pointer",fontFamily:FONT}}>{t.no}</button>
            </div>
          </div>}
          {/* Stats */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:11,marginBottom:22}}>
            {[{i:"🔪",l:t.prepTime,v:`${recipe.prepTime} ${t.mins}`},
              {i:"🔥",l:t.cookTime,v:`${recipe.cookTime} ${t.mins}`},
              {i:"👥",l:t.serves,v:`${recipe.serves} ${t.portions}`}
            ].map(s=><div key={s.l} style={{background:C.card,borderRadius:12,padding:"12px 8px",textAlign:"center",border:`1px solid ${C.border}`}}>
              <div style={{fontSize:20,marginBottom:3}}>{s.i}</div>
              <div style={{fontSize:14,fontWeight:"bold",color:C.text}}>{s.v}</div>
              <div style={{fontSize:10,color:C.muted,marginTop:2}}>{s.l}</div>
            </div>)}
          </div>
          <div style={{background:"rgba(200,146,42,.06)",border:"1px dashed rgba(200,146,42,.3)",
            borderRadius:9,padding:"9px 14px",marginBottom:24,color:"#a07030",fontSize:11}}>💰 {t.cost}</div>
          {/* Ingredients */}
          {displayIngs.length>0&&<>
            <SHead title={t.ingredients} color={col}/>
            
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:10,marginBottom:28}}>
              {displayIngs.map((ing,i)=>(
                <div key={ing.id||i} style={{background:C.card,borderRadius:11,overflow:"hidden",border:`1px solid ${C.border}`,textAlign:"center"}}>
                  {ing.image
                    ?<img src={ing.image} alt={ing.name} style={{width:"100%",height:85,objectFit:"cover",display:"block"}}/>
                    :<div style={{height:62,background:`${col}10`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🥄</div>}
                  <div style={{padding:"7px 8px"}}>
                    <div style={{fontSize:12,fontWeight:"bold",color:C.text,lineHeight:1.3}}>{ing.name}</div>
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
                  {step.image&&<img src={step.image} alt={`step ${i+1}`}
                    style={{width:"100%",borderRadius:10,display:"block",maxHeight:220,objectFit:"cover",border:`1px solid ${C.border}`}}/>}
                </div>
              </div>
            ))}
          </>}
        </div>}
  </div>;
}

// ── ADD / EDIT ────────────────────────────────────────────────────────────────
function AddEditScreen({t,lang,setLang,user,existing,onSave,onCancel}){
  const blank={id:"",huName:"",enName:"",category:0,section:0,serves:10,prepTime:20,cookTime:60,
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

  const handleSave=async()=>{
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
      author:user.name,authorId:user.id,
      createdAt:form.createdAt||Date.now(),
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
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="Name (HU)">
          <SI value={form.huName} onChange={e=>{set("huName",e.target.value);setErr("");}} placeholder="Magyar név"/>
          {err&&<div style={{color:C.danger,fontSize:11,marginTop:4}}>{err}</div>}
        </Field>
        <Field label="Name (EN)">
          <SI value={form.enName||""} onChange={e=>set("enName",e.target.value)} placeholder="English name"/>
        </Field>
      </div>
      <Field label={t.category}>
        <select value={form.category} onChange={e=>set("category",+e.target.value)} style={inputSt}>
          {t.categories.map((c,i)=><option key={i} value={i}>{c}</option>)}
        </select>
      </Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:11}}>
        {[[t.serves,"serves"],[t.prepTime,"prepTime"],[t.cookTime,"cookTime"]].map(([l,k])=>(
          <Field key={k} label={l}><SI type="number" min="1" value={form[k]} onChange={e=>set(k,+e.target.value)}/></Field>
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
                  <div style={{fontSize:9,color:"#a07030",letterSpacing:1.5,marginBottom:3,fontWeight:"bold"}}>HU NAME</div>
                  <SI value={ing.name||""} onChange={e=>updI(i,"name",e.target.value)} placeholder="Magyar név"/>
                </div>
                <div>
                  <div style={{fontSize:9,color:"#a07030",letterSpacing:1.5,marginBottom:3,fontWeight:"bold"}}>EN NAME</div>
                  <SI value={ing.enName||""} onChange={e=>updI(i,"enName",e.target.value)} placeholder="English name"/>
                </div>
              </div>
              {/* Qty (shared) */}
              <div>
                <div style={{fontSize:9,color:"#a07030",letterSpacing:1.5,marginBottom:3,fontWeight:"bold"}}>QTY</div>
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
                  <div style={{fontSize:9,color:"#a07030",letterSpacing:1.5,marginBottom:3,fontWeight:"bold"}}>HU STEP</div>
                  <textarea value={step.desc||""} onChange={e=>updS(i,"desc",e.target.value)}
                    placeholder="Magyar lépés…" rows={3}
                    style={{...inputSt,resize:"vertical",minHeight:70}}/>
                </div>
                <div>
                  <div style={{fontSize:9,color:"#a07030",letterSpacing:1.5,marginBottom:3,fontWeight:"bold"}}>EN STEP</div>
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
      <button onClick={handleSave} disabled={saving} style={{width:"100%",padding:"14px 0",
        background:saving?"#ddd":`linear-gradient(135deg,${C.gold},${C.goldL})`,
        border:"none",borderRadius:12,color:saving?"#999":C.dark,fontWeight:"bold",
        fontSize:15,cursor:saving?"not-allowed":"pointer",letterSpacing:2,fontFamily:FONT,
        boxShadow:saving?"none":`0 4px 20px rgba(200,146,42,.35)`}}>{saving?t.saving:t.publish}</button>
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
  const [search,setSearch]=useState("");
  const [activeCat,setActiveCat]=useState(-1);

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
        if(user.role==="admin"){
          const u=await fetchAllUsers();
          setUsers(u);
        }
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
    try{
      const r=await fetchRecipeById(id);
      setSelRecipe(r);
    }catch(e){console.error(e);}
    setDetLoading(false);
  };

  const handleSave=async(recipe)=>{
    try{
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
    const q=search.toLowerCase();
    const match=(r.enName||"").toLowerCase().includes(q)||(r.huName||"").toLowerCase().includes(q);
    return match&&(activeCat===-1||r.category===activeCat);
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
    if(view==="detail")return <DetailScreen t={t} lang={lang} setLang={setLang} recipe={selRecipe} loading={detLoading} user={user} canEdit={canEdit} onBack={()=>setView("list")} onEdit={()=>setView("edit")} onDelete={()=>handleDelete(selId)}/>;
    if(view==="add")return <AddEditScreen t={t} lang={lang} setLang={setLang} user={user} existing={null} onSave={handleSave} onCancel={()=>setView("list")}/>;
    if(view==="admin")return <AdminPanel t={t} lang={lang} setLang={setLang} user={user} allStubs={stubs} onBack={()=>setView("list")} onBulkSave={handleBulkSave} onBulkImport={handleBulkImport} auditTick={auditTick} users={users} onAddUser={addUser} onDeleteUser={deleteUser} onChangePassword={changePassword}/>;
    return <ListScreen t={t} lang={lang} setLang={setLang} user={user} onLogout={doLogout} recipes={filtered} search={search} setSearch={setSearch} activeCat={activeCat} setActiveCat={setActiveCat} onSelect={r=>openDetail(r.id)} onAdd={()=>setView("add")} canEdit={canEdit} isAdmin={user.role==="admin"} onAdmin={()=>setView("admin")}/>;
  };

  return <>
    {renderScreen()}
    {toast && <Toast msg={toast.msg} kind={toast.kind}/>}
  </>;
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

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function AdminPanel({t,lang,setLang,user,allStubs,onBack,onBulkSave,onBulkImport,auditTick,users,onAddUser,onDeleteUser,onChangePassword}){
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
    <div style={{background:C.dark,borderBottom:`1px solid rgba(200,146,42,.25)`,display:"flex",padding:"0 16px",gap:4,overflowX:"auto"}}>
      {[["log","📋 Change Log"],["users","👥 Users"],["bulk-edit","✏️ Bulk Edit"],["import","📥 Bulk Import"]].map(([k,label])=>(
        <button key={k} onClick={()=>setTab(k)} style={{padding:"10px 18px",background:"transparent",
          border:"none",borderBottom:`2px solid ${tab===k?C.gold:"transparent"}`,
          color:tab===k?C.goldL:"rgba(200,160,80,.6)",fontSize:13,cursor:"pointer",
          fontFamily:FONT,transition:"all .15s",whiteSpace:"nowrap"}}>{label}</button>
      ))}
    </div>
    <div style={{flex:1,overflow:"auto"}}>
      {tab==="log"    && <ChangeLog   t={t} user={user} auditTick={auditTick}/>}
      {tab==="users"  && <UserMgmt    t={t} currentUser={user} users={users} onAdd={onAddUser} onDelete={onDeleteUser} onChangePassword={onChangePassword}/>}
      {tab==="bulk-edit" && <BulkEdit t={t} lang={lang} allStubs={allStubs} onBulkSave={onBulkSave}/>}
      {tab==="import" && <BulkImport  t={t} lang={lang} onBulkImport={onBulkImport}/>}
    </div>
  </div>;
}

// ── User Management ──────────────────────────────────────────────────────────
function UserMgmt({t,currentUser,users,onAdd,onDelete,onChangePassword}){
  const [adding,setAdding]=useState(false);
  const [newUser,setNewUser]=useState({username:"",name:"",password:"",role:"staff"});
  const [pwdEditId,setPwdEditId]=useState(null);
  const [pwdValue,setPwdValue]=useState("");
  const [confirmDelId,setConfirmDelId]=useState(null);
  const [err,setErr]=useState("");

  const ROLE_COLOR={admin:"#c04040",chef:"#c8922a",staff:"#5a9e6f"};

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
      border:`1.5px solid ${C.gold}`,boxShadow:"0 2px 10px rgba(200,146,42,.12)"}}>
      <div style={{fontSize:13,fontWeight:"bold",color:C.text,marginBottom:13}}>New user account</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <div>
          <label style={{display:"block",fontSize:10,color:"#a07030",letterSpacing:1.5,marginBottom:4,fontWeight:"bold"}}>USERNAME</label>
          <input value={newUser.username} onChange={e=>setNewUser(p=>({...p,username:e.target.value.toLowerCase().replace(/\s/g,"")}))} placeholder="e.g. jane" style={ipt}/>
        </div>
        <div>
          <label style={{display:"block",fontSize:10,color:"#a07030",letterSpacing:1.5,marginBottom:4,fontWeight:"bold"}}>DISPLAY NAME</label>
          <input value={newUser.name} onChange={e=>setNewUser(p=>({...p,name:e.target.value}))} placeholder="e.g. Jane Doe" style={ipt}/>
        </div>
        <div>
          <label style={{display:"block",fontSize:10,color:"#a07030",letterSpacing:1.5,marginBottom:4,fontWeight:"bold"}}>PASSWORD (≥6 chars)</label>
          <input type="text" value={newUser.password} onChange={e=>setNewUser(p=>({...p,password:e.target.value}))} placeholder="At least 6 characters" style={ipt}/>
        </div>
        <div>
          <label style={{display:"block",fontSize:10,color:"#a07030",letterSpacing:1.5,marginBottom:4,fontWeight:"bold"}}>ROLE</label>
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
          {pwdEditId===u.id&&<div style={{marginTop:11,padding:"11px 13px",background:"rgba(200,146,42,.07)",
            borderRadius:8,border:`1px solid rgba(200,146,42,.25)`}}>
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

  const ACTION_COLOR={create:"#5a9e6f",edit:"#4a90c4","bulk-edit":"#8b5e9e",import:"#c8922a",delete:"#c04040"};
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
        {["all","create","edit","bulk-edit","import","delete"].map(a=>(
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
  const [selected,setSelected]=useState(new Set());
  const [fields,setFields]=useState({category:"",serves:"",prepTime:"",cookTime:""});
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
      if(fields.serves!=="")updated.serves=+fields.serves;
      if(fields.prepTime!=="")updated.prepTime=+fields.prepTime;
      if(fields.cookTime!=="")updated.cookTime=+fields.cookTime;
      toSave.push(updated);
      setDone(n=>n+1);
    }
    await onBulkSave(toSave);
    setSaving(false);
    setSelected(new Set());
    setFields({category:"",serves:"",prepTime:"",cookTime:""});
    setDone(0);
  };

  const CAT_NAMES=t.categories;
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
          <label style={{display:"block",fontSize:10,color:"#a07030",letterSpacing:2,marginBottom:5,textTransform:"uppercase"}}>Category</label>
          <select value={fields.category} onChange={e=>setFields(f=>({...f,category:e.target.value}))} style={inputSm}>
            <option value="">— no change —</option>
            {CAT_NAMES.map((c,i)=><option key={i} value={i}>{c}</option>)}
          </select>
        </div>
        {[["Serves","serves"],["Prep (min)","prepTime"],["Cook (min)","cookTime"]].map(([l,k])=>(
          <div key={k}>
            <label style={{display:"block",fontSize:10,color:"#a07030",letterSpacing:2,marginBottom:5,textTransform:"uppercase"}}>{l}</label>
            <input type="number" min="1" placeholder="no change" value={fields[k]}
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
        const col=t.catColors[r.category]||C.gold;
        return <div key={r.id} onClick={()=>toggle(r.id)}
          style={{background:isSel?"rgba(200,146,42,.08)":"#fff",borderRadius:10,
            padding:"11px 14px",border:`1.5px solid ${isSel?C.gold:C.border}`,
            cursor:"pointer",display:"flex",alignItems:"center",gap:12,transition:"all .15s"}}>
          <div style={{width:20,height:20,borderRadius:4,border:`2px solid ${isSel?C.gold:"#ccc"}`,
            background:isSel?C.gold:"transparent",display:"flex",alignItems:"center",justifyContent:"center",
            flexShrink:0,transition:"all .15s"}}>
            {isSel&&<span style={{color:"#fff",fontSize:13,lineHeight:1}}>✓</span>}
          </div>
          <span style={{padding:"2px 8px",borderRadius:8,fontSize:10,background:`${col}22`,
            color:col,fontWeight:"bold",flexShrink:0}}>{t.catLabels[r.category]}</span>
          <span style={{fontWeight:"bold",color:C.text,fontSize:13,flex:1,
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{getName(r)}</span>
          {lang==="en"&&r.huName&&<span style={{fontSize:11,color:C.muted,
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:180}}>{r.huName}</span>}
          <span style={{fontSize:11,color:C.muted,flexShrink:0}}>
            👥{r.serves} ⏱{(r.prepTime||0)+(r.cookTime||0)}min
          </span>
        </div>;
      })}
    </div>
  </div>;
}

// ── Bulk Import ───────────────────────────────────────────────────────────────
function BulkImport({t,lang,onBulkImport}){
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

  const CAT_COL=t.catColors;

  return <div style={{maxWidth:900,margin:"0 auto",padding:"24px 16px"}}>
    {/* Format guide */}
    <div style={{background:"rgba(200,146,42,.07)",border:`1px solid rgba(200,146,42,.25)`,
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
      <label style={{display:"block",fontSize:10,color:"#a07030",letterSpacing:2,marginBottom:6,textTransform:"uppercase"}}>
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
              background:`${CAT_COL[r.category]}22`,color:CAT_COL[r.category]}}>
              {t.catLabels[r.category]}
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

