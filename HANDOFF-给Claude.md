# 美化我的餐厅菜谱 App —— 给 Claude 的执行指令

我有一个 React + Vite + Supabase 的餐厅菜谱 App(`hankzhao54/restaurant-recipes`)。请帮我按下面的规格做**纯视觉美化**,只改这两个文件:`index.html` 和 `src/App.jsx`。

**铁律:只改视觉,绝不改动任何逻辑、数据结构、状态、Supabase 调用、组件 props、事件处理。改完 `npm run dev` 必须照常运行,EN/HU 语言切换、收藏、分类筛选、配料缩放、版本历史、管理后台等功能全部不受影响。**

设计方向:**高级 fine-dining 质感**——深墨绿黑顶栏 + 暖象牙白底 + 黄铜金点缀;衬线字体做标题(Cormorant Garamond),无衬线做正文(Hanken Grotesk);去掉所有随机 emoji 占位图,换成优雅的「首字母 + Photo」占位。

---

## 文件 1:`index.html`

**(a)** 把 `theme-color` 改成深墨绿:
```diff
- <meta name="theme-color" content="#1a1208" />
+ <meta name="theme-color" content="#1d2722" />
```

**(b)** 在 `<title>` 之后、`<style>` 之前,加入字体引入:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Hanken+Grotesk:wght@400;500;600;700&family=Noto+Serif+SC:wght@400;500;600&display=swap" rel="stylesheet" />
```

**(c)** `<style>` 里 body 的字体与背景改成:
```diff
- font-family: 'Georgia', 'Noto Serif SC', serif; background:#fdf8f0;
+ font-family: 'Hanken Grotesk', 'Noto Serif SC', sans-serif; background:#f2ede1;
```

**(d)** 在 `<style>` 里 `input,textarea,select{font-size:16px}` 那行之后,加入全局交互态:
```css
button { transition: transform .12s ease, filter .15s ease, box-shadow .2s ease; }
button:hover { filter: brightness(1.05); }
button:active { transform: scale(.96); }
input, textarea, select { transition: border-color .15s ease, box-shadow .15s ease; }
input:focus, textarea:focus, select:focus { outline: none; border-color: #a8833f !important; box-shadow: 0 0 0 3px rgba(168,131,63,.16) !important; }
::selection { background: rgba(168,131,63,.24); }
::-webkit-scrollbar { width: 9px; height: 9px; }
::-webkit-scrollbar-thumb { background: rgba(140,110,70,.32); border-radius: 10px; border: 2px solid transparent; background-clip: padding-box; }
::-webkit-scrollbar-thumb:hover { background: rgba(140,110,70,.5); }
::-webkit-scrollbar-track { background: transparent; }
```

---

## 文件 2:`src/App.jsx`

**(a) 调色板 + 双字体常量**
文件顶部找到 `const C={...};` 那一行,**整行替换**,并在其后**新增两行字体常量**(如果已有 `const FONT=...` 就替换它):
```js
const C={bg:"#f2ede1",card:"#fbf9f3",dark:"#1d2722",gold:"#a8833f",goldL:"#c6a45c",goldD:"#7c5f2a",text:"#20211c",muted:"#8b8576",border:"#e6dfce",danger:"#b0473f"};
const FONT="'Hanken Grotesk','Noto Serif SC',sans-serif";
const FONTH="'Cormorant Garamond','Noto Serif SC',serif";
```
> `gold` 字段名保持不变(全项目都引用它),只是值变成黄铜金。`FONTH` 是新增的衬线标题字体。

**(b) 统一分类色(去彩虹)**
找到 `catColors:[...]`(EN 段和 HU 段各一处,内容相同),两处都**整行替换**为同明度的暖大地色系:
```js
catColors:["#a8833f","#7d9b6a","#b5703a","#a86a85","#5b9189","#9c7a3c"]
```

**(c) 衬线标题**
给以下几处 inline style 加上 `fontFamily:FONTH` 并放大字号:
- 顶栏 App 名(`{t.appName}`):字号 → `36`
- 列表里菜谱卡标题(菜名 `name`):字号 → `19`
- 详情页大标题 `<h1>`(菜名):字号 → `36`
- 通用区块标题组件里的 `<h2>{title}`:字号 → `21`

**(d) 去掉随机 emoji 占位,换成「首字母 + Photo」—— 共 3 处**

1. 菜谱卡封面里渲染 `{emo}` 的那个 div → 换成:
```jsx
<div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3}}>
  <span style={{fontFamily:FONTH,fontSize:42,fontWeight:"bold",color:col,opacity:.42,lineHeight:1}}>{(name||"·")[0]}</span>
  <span style={{fontSize:8,letterSpacing:2,textTransform:"uppercase",color:col,opacity:.42,fontWeight:"bold"}}>Photo</span>
</div>
```

2. 详情页大图里的 `:<span>{emo}</span>` → 换成:
```jsx
<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
  <span style={{fontFamily:FONTH,fontSize:74,fontWeight:"bold",color:col,opacity:.38,lineHeight:1}}>{(name||"·")[0]}</span>
  <span style={{fontSize:10,letterSpacing:3,textTransform:"uppercase",color:col,opacity:.42,fontWeight:"bold"}}>Dish photo</span>
</div>
```

3. 配料卡里渲染勺子 emoji `🥄` 的那个 `height:62` 占位 div → 换成:
```jsx
<div style={{height:62,background:`${col}10`,display:"flex",alignItems:"center",justifyContent:"center"}}>
  <span style={{fontFamily:FONTH,fontSize:26,fontWeight:"bold",color:col,opacity:.4}}>{(ing.name||"·")[0]}</span>
</div>
```
> 旧的 `const EMOJIS=[...]` 不再被引用,可删可留。

**(e) 卡片阴影更精致**
找到 RecipeCard 里的 `boxShadow:hov?...` 那一段,替换为更柔的暖调双层阴影:
```js
boxShadow:hov?"0 14px 34px -10px rgba(168,131,63,.30)":"0 1px 3px rgba(40,30,15,.05),0 8px 22px -14px rgba(40,30,15,.18)",
```

---

## 完成后
```
npm run dev
```
确认:顶栏=深墨绿黑、底色=暖象牙白、点缀=黄铜金、标题=衬线、配料/封面无随机 emoji,且所有功能照常。确认无误后 `git commit` 并推送(Vercel 会自动部署)。
