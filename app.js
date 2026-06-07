const defaultModules = [
  {id:"planning",name:"需求与规划",desc:"目标、范围、里程碑与资源安排",progress:72,color:"#327b5d"},
  {id:"design",name:"方案设计",desc:"方案制定、评审与关键决策",progress:58,color:"#a1b66c"},
  {id:"execution",name:"执行制作",desc:"核心任务实施与成果产出",progress:64,color:"#f0a85b"},
  {id:"testing",name:"测试与验收",desc:"质量检查、验证与验收闭环",progress:46,color:"#6a9fb5"},
  {id:"collaboration",name:"沟通与协作",desc:"跨团队同步、依赖与反馈管理",progress:55,color:"#9c7ab4"},
  {id:"delivery",name:"交付与复盘",desc:"成果交付、总结与经验沉淀",progress:35,color:"#dc6b62"}
];
let modules=structuredClone(defaultModules);

const seed = {
  logs:[
    {date:"2026-06-06",module:"execution",hours:3,focus:4,done:"完成核心方案第一版，并整理本阶段主要成果与待确认事项。",problem:"部分需求边界尚未明确，可能影响后续执行排期。",next:"与相关负责人确认需求范围，并更新里程碑计划。"},
    {date:"2026-06-05",module:"collaboration",hours:2.5,focus:3,done:"完成项目进展同步，收集各协作方反馈并形成行动清单。",problem:"信息分散在多个沟通渠道，整理与追踪成本较高。",next:"建立统一的问题与决策记录，明确责任人和截止时间。"},
    {date:"2026-06-04",module:"design",hours:4,focus:5,done:"完成方案结构梳理，对比两种执行路径并形成评审材料。",problem:"当前缺少统一验收标准，方案取舍依据不够清晰。",next:"补充验收指标，并基于成本、质量和周期完成方案选择。"}
  ],
  issues:[
    {id:1,title:"部分需求边界尚未确认",detail:"关键需求存在不同理解，可能影响后续执行范围和排期。",module:"planning",priority:"high",status:"open"},
    {id:2,title:"验收标准需要进一步量化",detail:"当前标准偏主观，难以在交付前快速判断完成质量。",module:"testing",priority:"high",status:"watch"},
    {id:3,title:"跨团队信息同步效率偏低",detail:"问题、反馈和决策分散，容易遗漏后续行动。",module:"collaboration",priority:"medium",status:"open"},
    {id:4,title:"阶段汇报模板已统一",detail:"项目成员已使用统一结构汇报成果、问题和下一步。",module:"delivery",priority:"low",status:"solved"}
  ],
  progress:Object.fromEntries(modules.map(m=>[m.id,m.progress]))
};

const blankData=()=>({logs:[],issues:[],progress:Object.fromEntries(defaultModules.map(m=>[m.id,0])),modules:structuredClone(defaultModules)});
const blankWorkspace=()=>{
  const id=`project-${Date.now()}`;
  return {activeProjectId:id,projects:[{id,name:"我的第一个项目",category:"通用项目",description:"从这里开始整理项目周期内的进展、问题与工作记录。",startDate:new Date().toISOString().slice(0,10),endDate:"",status:"active",data:blankData()}]};
};
const legacyData=JSON.parse(localStorage.getItem("project-progress-data") || "null");
let workspace=JSON.parse(localStorage.getItem("project-guest-workspace-v1") || localStorage.getItem("project-workspace-data-v1") || "null");
if(!workspace){
  const firstId=`project-${Date.now()}`;
  workspace={activeProjectId:firstId,projects:[{id:firstId,name:"我的第一个项目",category:"通用项目",description:"从这里开始整理项目周期内的进展、问题与工作记录。",startDate:"2026-06-01",endDate:"",status:"active",data:legacyData||structuredClone(seed)}]};
}
workspace.projects.forEach(project=>{project.category=project.category||"未分类";project.data.modules=project.data.modules||structuredClone(defaultModules);project.data.logs=project.data.logs.map((log,index)=>({...log,id:log.id||`log-${log.date}-${index}`}))});
localStorage.setItem("project-guest-workspace-v1",JSON.stringify(workspace));
let activeProject=workspace.projects.find(project=>project.id===workspace.activeProjectId)||workspace.projects[0];
let data=activeProject.data;
modules=data.modules;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const mod=id=>modules.find(m=>m.id===id) || modules[0];
const fmt=d=>new Intl.DateTimeFormat("zh-CN",{month:"long",day:"numeric",weekday:"short"}).format(new Date(d));
const statusName={open:"待解决",watch:"观察中",solved:"已解决"};
const priorityName={high:"高优先",medium:"中优先",low:"低优先"};
const projectStatusName={planning:"规划中",active:"进行中",paused:"已暂停",completed:"已完成"};
let projectCategoryFilter="all";
let supabaseClient=null;
let currentUser=null;
let currentProfile=null;
let syncTimer=null;
let gateAuthMode="signin";
let dialogAuthMode="signin";

function setGateMessage(message,error=false){
  $("#gateMessage").textContent=message;
  $("#gateMessage").classList.toggle("error",error);
}

function lockApp(message="请登录后使用"){
  $("#authGate").classList.remove("unlocked");
  setGateMessage(message);
}

function unlockApp(){
  $("#authGate").classList.add("unlocked");
  setGateMessage("");
}

function setSyncState(text,type=""){
  $("#syncState").textContent=text;
  $("#syncState").className=`sync-state ${type}`;
}

function describeSyncError(error){
  if(!error)return "";
  const raw=[error.message,error.details,error.hint,error.code].filter(Boolean).join(" · ");
  if(error.code==="42P01"||raw.includes("user_workspaces"))return `云端数据表不可用：${raw}。请在 Supabase SQL Editor 执行 supabase-schema.sql。`;
  if(error.code==="42501"||raw.toLowerCase().includes("row-level security"))return `数据库权限被拒绝：${raw}。请检查 user_workspaces 表的 RLS 策略。`;
  if(raw.toLowerCase().includes("failed to fetch")||raw.toLowerCase().includes("network"))return `无法连接 Supabase：${raw}。请检查网络、Project URL 和 Publishable key。`;
  return raw||"未知同步错误";
}

function showSyncError(error){
  const message=describeSyncError(error);
  $("#syncErrorDetail").textContent=message;
  $("#syncErrorDetail").classList.toggle("show",Boolean(message));
  if(message)console.error(error);
  return message;
}

async function pushWorkspace(){
  if(!supabaseClient||!currentUser)return;
  setSyncState("正在同步...");
  try{
    const {error}=await supabaseClient.from("user_workspaces").upsert({user_id:currentUser.id,workspace,updated_at:new Date().toISOString()},{onConflict:"user_id"});
    setSyncState(error?"同步失败":"已云端同步",error?"error":"online");
    showSyncError(error);
    return !error;
  }catch(error){
    setSyncState("同步失败","error");showSyncError(error);return false;
  }
}

function scheduleCloudSave(){
  if(!currentUser)return;
  clearTimeout(syncTimer);
  syncTimer=setTimeout(pushWorkspace,700);
}

const save=()=>{
  const key=currentUser?`project-user-workspace-v1:${currentUser.id}`:"project-guest-workspace-v1";
  localStorage.setItem(key,JSON.stringify(workspace));
  scheduleCloudSave();
};

function updateAccountUI(){
  const displayName=currentProfile?.username||currentUser?.email||"用户";
  $("#accountBtn").textContent=currentUser?displayName:"登录并云端同步";
  if(currentUser){
    $("#accountUsername").textContent=displayName;
    $("#accountEmail").textContent=currentUser.email;
    $("#profileUsername").textContent=displayName;
    $("#profileEmail").textContent=currentUser.email;
    $("#profileAvatar").textContent=displayName.slice(0,1).toUpperCase();
  }
}

async function loadProfile(){
  if(!currentUser)return;
  const {data:profile,error}=await supabaseClient.from("user_profiles").select("username").eq("user_id",currentUser.id).maybeSingle();
  if(error){showSyncError(error);return false}
  currentProfile=profile;
  updateAccountUI();
  return true;
}

function renderMine(){
  if(!currentUser)return;
  updateAccountUI();
  const allLogs=workspace.projects.flatMap(project=>project.data.logs);
  const allIssues=workspace.projects.flatMap(project=>project.data.issues);
  const totalHours=allLogs.reduce((sum,log)=>sum+Number(log.hours),0);
  $("#profileStats").innerHTML=[
    [workspace.projects.length,"项目总数"],
    [allLogs.length,"工作记录"],
    [`${totalHours}h`,"累计投入"],
    [allIssues.filter(issue=>issue.status!=="solved").length,"待解决问题"]
  ].map(item=>`<div><strong>${item[0]}</strong><span>${item[1]}</span></div>`).join("");
  $("#profileSyncStatus").textContent=$("#syncState").textContent;
}

async function loadCloudWorkspace(){
  let cloud,error;
  try{
    const result=await supabaseClient.from("user_workspaces").select("workspace").eq("user_id",currentUser.id).maybeSingle();
    cloud=result.data;error=result.error;
  }catch(caught){error=caught}
  if(error){setSyncState("读取云端失败","error");const message=showSyncError(error);lockApp(`云端数据读取失败：${message}`);return false}
  showSyncError(null);
  if(cloud?.workspace?.projects?.length){
    workspace=cloud.workspace;
    workspace.projects.forEach(project=>{project.category=project.category||"未分类";project.data.modules=project.data.modules||structuredClone(defaultModules);project.data.logs=project.data.logs.map((log,index)=>({...log,id:log.id||`log-${log.date}-${index}`}))});
    localStorage.setItem(`project-user-workspace-v1:${currentUser.id}`,JSON.stringify(workspace));
    render();
    renderMine();
    setSyncState("已读取云端数据","online");
    unlockApp();
  }else{
    workspace=blankWorkspace();
    render();
    renderMine();
    const saved=await pushWorkspace();
    if(!saved){lockApp("首次创建云端数据失败，请检查数据库配置。");return false}
    unlockApp();
  }
  return true;
}

async function initSupabase(){
  const config=window.SUPABASE_CONFIG||{};
  lockApp("正在检查登录状态...");
  if(!config.url||!config.publishableKey||!window.supabase){setSyncState("未配置云端","error");setGateMessage("网站尚未配置 Supabase，暂时无法登录使用。",true);return}
  try{new URL(config.url)}catch{setSyncState("Supabase 地址无效","error");showSyncError({message:"supabase-config.js 中的 Project URL 无效"});setGateMessage("Supabase 地址无效，请联系管理员。",true);return}
  supabaseClient=window.supabase.createClient(config.url,config.publishableKey);
  const {data:{session},error}=await supabaseClient.auth.getSession();
  if(error){setSyncState("登录状态读取失败","error");setGateMessage(describeSyncError(error),true)}
  currentUser=session?.user||null;
  updateAccountUI();
  if(currentUser){await loadProfile();await loadCloudWorkspace()}
  else lockApp("请登录或注册后使用项目进展台。");
  supabaseClient.auth.onAuthStateChange(async(event,session)=>{
    currentUser=session?.user||null;
    updateAccountUI();
    if(event==="SIGNED_IN"){setGateMessage("登录成功，正在读取云端数据...");setTimeout(async()=>{await loadProfile();await loadCloudWorkspace()},0)}
    if(event==="SIGNED_OUT"){
      currentProfile=null;
      workspace=blankWorkspace();
      setSyncState("请登录");
      lockApp("已退出登录，请重新登录后使用。");
    }
  });
}

function render(){
  activeProject=workspace.projects.find(project=>project.id===workspace.activeProjectId)||workspace.projects[0];
  data=activeProject.data;
  modules=data.modules;
  refreshModuleOptions();
  $("#activeProjectName").textContent=activeProject.name;
  $("#activeProjectMeta").textContent=`${projectStatusName[activeProject.status]} · ${activeProject.startDate}${activeProject.endDate?` 至 ${activeProject.endDate}`:""}`;
  const totalHours=data.logs.reduce((a,b)=>a+Number(b.hours),0);
  const avgProgress=Math.round(Object.values(data.progress).reduce((a,b)=>a+b,0)/modules.length);
  const open=data.issues.filter(i=>i.status!=="solved").length;
  const avgFocus=data.logs.length?(data.logs.reduce((a,b)=>a+Number(b.focus),0)/data.logs.length).toFixed(1):"0.0";
  const fastest=[...modules].sort((a,b)=>data.progress[b.id]-data.progress[a.id])[0];
  $("#heroSummary").textContent=`当前项目整体完成度 ${avgProgress}%。${fastest.name}推进最快，下一阶段建议优先处理高影响问题，并明确每项工作的责任人与验收标准。`;
  $("#metrics").innerHTML=[
    ["◴","本周投入",`${totalHours}h`,"持续推进中"],
    ["✓","整体进度",`${avgProgress}%`,"进展清晰可见"],
    ["!","待解决问题",open,"优先处理高影响项"],
    ["◎","平均专注度",`${avgFocus}/5`,"保持深度工作"]
  ].map(x=>`<div class="metric"><div class="metric-top"><span>${x[1]}</span><span class="metric-icon">${x[0]}</span></div><strong>${x[2]}</strong><small class="positive">${x[3]}</small></div>`).join("");
  $("#progressList").innerHTML=modules.slice(0,5).map(m=>progressRow(m)).join("");
  const focusItems=[
    ["明确本阶段验收标准","将目标转化为清晰、可检查的完成条件"],
    ["优先解决关键阻塞","集中处理影响范围、质量或排期的问题"],
    ["同步进展与下一步","明确责任人、截止时间和需要的支持"]
  ];
  $("#focusScore").textContent=`${avgFocus}/5`;
  $("#focusList").innerHTML=focusItems.map((x,i)=>`<div class="focus-item"><span class="number">0${i+1}</span><div><strong>${x[0]}</strong><small>${x[1]}</small></div></div>`).join("");
  $("#recentLogs").innerHTML=data.logs.slice(0,3).map(l=>`<div class="recent-item"><span class="number">${new Date(l.date).getDate()}</span><div><strong>${l.done}</strong><small>${mod(l.module).name} · ${l.hours} 小时</small></div></div>`).join("");
  $("#issueRadar").innerHTML=data.issues.filter(i=>i.status!=="solved").slice(0,4).map(i=>`<div class="radar-item"><span class="dot ${i.priority}"></span><div><strong>${i.title}</strong><small>${mod(i.module).name} · ${statusName[i.status]}</small></div></div>`).join("");
  renderProjects();renderDaily();renderProject();renderIssues();renderInsights();renderMine();
}

function renderProjects(){
  const categories=[...new Set(workspace.projects.map(project=>project.category))];
  $("#projectCategoryFilter").innerHTML=`<option value="all">全部分类</option>${categories.map(category=>`<option value="${category}" ${projectCategoryFilter===category?"selected":""}>${category}</option>`).join("")}`;
  const visibleProjects=workspace.projects.filter(project=>projectCategoryFilter==="all"||project.category===projectCategoryFilter);
  $("#projectList").innerHTML=visibleProjects.map(project=>{
    const projectData=project.data;
    const progress=Math.round(Object.values(projectData.progress).reduce((a,b)=>a+b,0)/(projectData.modules||defaultModules).length);
    const hours=projectData.logs.reduce((a,b)=>a+Number(b.hours),0);
    const open=projectData.issues.filter(issue=>issue.status!=="solved").length;
    return `<article class="project-list-card ${project.id===workspace.activeProjectId?"active":""}"><div class="entry-head"><span class="status-pill ${project.status}">${projectStatusName[project.status]}</span>${project.id===workspace.activeProjectId?'<span class="tag">当前项目</span>':""}</div><h3>${project.name}</h3><span class="tag">${project.category}</span><p>${project.description||"暂无项目说明"}</p><div class="project-period">${project.startDate||"未设置开始日期"}${project.endDate?` 至 ${project.endDate}`:" · 长期项目"}</div><div class="project-stats"><div><strong>${progress}%</strong><span>整体进度</span></div><div><strong>${hours}h</strong><span>工作投入</span></div><div><strong>${open}</strong><span>待解决</span></div></div><select class="project-status-select" data-id="${project.id}">${Object.entries(projectStatusName).map(([key,value])=>`<option value="${key}" ${project.status===key?"selected":""}>${value}</option>`).join("")}</select><div class="project-list-actions"><button class="ghost switch-project" data-id="${project.id}" ${project.id===workspace.activeProjectId?"disabled":""}>${project.id===workspace.activeProjectId?"查看中":"切换项目"}</button><button class="ghost edit-project" data-id="${project.id}">编辑</button><button class="delete-btn delete-project" data-id="${project.id}">删除</button></div></article>`;
  }).join("")||`<article class="card"><p>该分类下暂无项目。</p></article>`;
  $$(".project-status-select").forEach(select=>select.onchange=()=>{workspace.projects.find(project=>project.id===select.dataset.id).status=select.value;save();render();toast("项目状态已更新")});
  $$(".edit-project").forEach(button=>button.onclick=()=>openProjectEditor(workspace.projects.find(project=>project.id===button.dataset.id)));
  $$(".switch-project").forEach(button=>button.onclick=()=>{
    workspace.activeProjectId=button.dataset.id;save();render();showView("dashboard");toast("已切换项目");
  });
  $$(".delete-project").forEach(button=>button.onclick=()=>{
    if(workspace.projects.length===1){toast("至少需要保留一个项目");return}
    const project=workspace.projects.find(item=>item.id===button.dataset.id);
    if(!confirm(`确定删除项目“${project.name}”吗？项目内全部记录和问题都会删除。`))return;
    workspace.projects=workspace.projects.filter(item=>item.id!==button.dataset.id);
    if(workspace.activeProjectId===button.dataset.id)workspace.activeProjectId=workspace.projects[0].id;
    save();render();toast("项目已删除");
  });
}

function progressRow(m){const p=data.progress[m.id];return `<div class="progress-row"><span>${m.name}</span><div class="bar"><i style="width:${p}%;background:${m.color}"></i></div><b>${p}%</b></div>`}

function renderDaily(){
  $("#dailyTimeline").innerHTML=data.logs.map(l=>`<article class="day-card"><div class="day-date"><strong>${fmt(l.date).split("星期")[0]}</strong><span>${fmt(l.date).includes("星期")?"星期"+fmt(l.date).split("星期")[1]:"工作记录"}</span></div><div class="day-main"><div class="entry-head"><div class="day-meta"><span class="tag">${mod(l.module).name}</span><span class="tag">${l.hours} 小时</span><span class="tag">专注 ${l.focus}/5</span></div><button class="delete-btn delete-log" data-id="${l.id}" title="删除这条记录">删除</button></div><h3>${l.done}</h3><div class="reflection"><div><b>遇到的问题</b>${l.problem||"今日暂无明显阻塞"}</div><div><b>下一步行动</b>${l.next}</div></div></div></article>`).join("") || `<article class="card"><p>还没有每日记录，点击“新建记录”开始复盘。</p></article>`;
  $$(".delete-log").forEach(button=>button.onclick=()=>{
    if(!confirm("确定删除这条每日记录吗？删除后无法恢复。"))return;
    data.logs=data.logs.filter(log=>String(log.id)!==button.dataset.id);
    save();render();toast("每日记录已删除");
  });
}

function renderProject(){
  $("#projectGrid").innerHTML=modules.map((m,i)=>`<article class="project-card" style="--accent:${m.color}"><div class="entry-head"><span class="code">MODULE 0${i+1}</span><button class="text-btn edit-module" data-id="${m.id}">编辑</button></div><h3>${m.name}</h3><p>${m.desc}</p><div class="ring" style="--p:${data.progress[m.id]};--accent:${m.color}"><strong>${data.progress[m.id]}%</strong></div><div class="card-actions"><span>${data.logs.filter(l=>l.module===m.id).length} 条工作记录</span><select class="mini-select progress-select" data-id="${m.id}">${[0,20,35,50,65,80,100].map(v=>`<option ${Math.abs(v-data.progress[m.id])<8?"selected":""} value="${v}">${v}%</option>`).join("")}</select></div></article>`).join("");
  $$(".progress-select").forEach(s=>s.onchange=()=>{data.progress[s.dataset.id]=Number(s.value);save();render();toast("项目进度已更新")});
  $$(".edit-module").forEach(button=>button.onclick=()=>openModuleEditor(button.dataset.id));
}

let issueFilter="all";
function renderIssues(){
  const items=data.issues.filter(i=>issueFilter==="all"||i.status===issueFilter);
  $("#issueBoard").innerHTML=items.map(i=>`<article class="issue-card" style="--accent:${i.priority==="high"?"#dc6b62":i.priority==="medium"?"#f0a85b":"#6a9fb5"}"><div class="entry-head"><span class="tag">${priorityName[i.priority]} · ${mod(i.module).name}</span><button class="delete-btn delete-issue" data-id="${i.id}" title="删除这个问题">删除</button></div><h3>${i.title}</h3><p>${i.detail}</p><div class="issue-foot"><span class="kicker">${statusName[i.status]}</span><select class="status-select" data-id="${i.id}">${Object.entries(statusName).map(([k,v])=>`<option value="${k}" ${i.status===k?"selected":""}>${v}</option>`).join("")}</select></div></article>`).join("") || `<article class="card"><p>这个分类暂时没有问题。</p></article>`;
  $$(".status-select").forEach(s=>s.onchange=()=>{data.issues.find(i=>i.id==s.dataset.id).status=s.value;save();render();toast("问题状态已更新")});
  $$(".delete-issue").forEach(button=>button.onclick=()=>{
    if(!confirm("确定删除这个问题吗？删除后无法恢复。"))return;
    data.issues=data.issues.filter(issue=>String(issue.id)!==button.dataset.id);
    save();render();toast("问题已删除");
  });
}

function renderInsights(){
  const byModule=modules.map(m=>({name:m.name,h:data.logs.filter(l=>l.module===m.id).reduce((a,b)=>a+Number(b.hours),0),color:m.color})).filter(x=>x.h);
  const total=byModule.reduce((a,b)=>a+b.h,0);
  $("#totalHours").textContent=total;
  let cursor=0; const segments=byModule.map(x=>{const start=cursor;cursor+=x.h/total*100;return `${x.color} ${start}% ${cursor}%`});
  $("#donut").style.background=segments.length?`conic-gradient(${segments.join(",")})`:"#edf1ee";
  $("#timeLegend").innerHTML=byModule.map(x=>`<div class="legend-item"><i style="background:${x.color}"></i><span>${x.name} · ${x.h}h</span></div>`).join("");
  const highOpen=data.issues.filter(i=>i.priority==="high"&&i.status!=="solved").length;
  $("#recommendations").innerHTML=[
    ["先定义验收标准，再推进执行","为关键成果建立可检查的完成标准，减少反复修改。"],
    ["将大问题拆成可验证的小任务",`当前有 ${highOpen} 个高优先问题，建议逐项明确负责人和解决时限。`],
    ["固定每日复盘与同步时间","每天记录成果、阻塞和明日第一步，降低重新进入工作的成本。"]
  ].map(x=>`<div class="recommendation"><strong>${x[0]}</strong><p>${x[1]}</p></div>`).join("");
  const counts=modules.map(m=>({name:m.name,n:data.issues.filter(i=>i.module===m.id&&i.status!=="solved").length})).filter(x=>x.n).sort((a,b)=>b.n-a.n);
  $("#blockers").innerHTML=counts.map(x=>`<div class="blocker-row"><div><span>${x.name}</span><b>${x.n} 个问题</b></div><div class="bar"><i style="width:${Math.min(x.n*35,100)}%;background:#dc6b62"></i></div></div>`).join("");
}

function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200)}
function showView(id){
  $$(".view").forEach(v=>v.classList.toggle("active",v.id===id));
  $$(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.view===id));
  $("#pageTitle").textContent={projects:"项目列表",dashboard:"项目总览",daily:"每日记录",project:"项目进度",issues:"问题中心",insights:"效率分析",mine:"我的"}[id];
}

function refreshModuleOptions(){
  const options=modules.map(m=>`<option value="${m.id}">${m.name}</option>`).join("");
  $("#moduleSelect").innerHTML=options;
  $$(".module-options").forEach(s=>s.innerHTML=options);
}

function openProjectEditor(project=null){
  const form=$("#projectForm");
  form.reset();
  form.elements.projectId.value=project?.id||"";
  form.elements.name.value=project?.name||"";
  form.elements.description.value=project?.description||"";
  form.elements.category.value=project?.category||"";
  form.elements.startDate.value=project?.startDate||new Date().toISOString().slice(0,10);
  form.elements.endDate.value=project?.endDate||"";
  form.elements.status.value=project?.status||"active";
  $("#projectDialogTitle").textContent=project?"编辑项目":"新建项目";
  $("#projectSubmitBtn").textContent=project?"保存项目修改":"创建项目";
  $("#projectDialog").showModal();
}

function openModuleEditor(moduleId){
  const module=mod(moduleId);
  const form=$("#moduleForm");
  form.elements.moduleId.value=module.id;
  form.elements.name.value=module.name;
  form.elements.description.value=module.desc;
  form.elements.progress.value=data.progress[module.id]||0;
  $("#moduleDialog").showModal();
}

$("#todayLabel").textContent=new Intl.DateTimeFormat("zh-CN",{year:"numeric",month:"long",day:"numeric",weekday:"long"}).format(new Date());
refreshModuleOptions();
$("#nav").onclick=e=>e.target.dataset.view&&showView(e.target.dataset.view);
$$("[data-view-jump]").forEach(b=>b.onclick=()=>showView(b.dataset.viewJump));
$$("[data-open-log]").forEach(b=>b.onclick=()=>{$("#logForm [name=date]").value=new Date().toISOString().slice(0,10);$("#logDialog").showModal()});
$("#openIssue").onclick=()=>$("#issueDialog").showModal();
$("#projectCategoryFilter").onchange=e=>{projectCategoryFilter=e.target.value;renderProjects()};
$("#openProject").onclick=()=>openProjectEditor();
const closeDialog=dialog=>{
  dialog.close();
  const form=dialog.querySelector("form");
  if(form)form.reset();
  const focusLabel=dialog.querySelector(".range-label span");
  if(focusLabel)focusLabel.textContent="4 / 5";
};
$$("[data-close-dialog]").forEach(button=>button.onclick=()=>closeDialog(button.closest("dialog")));
$$("dialog").forEach(dialog=>{
  dialog.addEventListener("click",event=>{
    const box=dialog.getBoundingClientRect();
    const outside=event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom;
    if(outside)closeDialog(dialog);
  });
  dialog.addEventListener("cancel",event=>{
    event.preventDefault();
    closeDialog(dialog);
  });
});
$("#logForm input[type=range]").oninput=e=>e.target.nextElementSibling.textContent=`${e.target.value} / 5`;
$("#logForm").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);data.logs.unshift({id:`log-${Date.now()}`,date:f.get("date"),done:f.get("done"),module:f.get("module"),hours:Number(f.get("hours")),problem:f.get("problem"),next:f.get("next"),focus:Number(f.get("focus"))});data.logs.sort((a,b)=>b.date.localeCompare(a.date));save();render();closeDialog($("#logDialog"));toast("工作记录已保存")};
$("#issueForm").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);data.issues.unshift({id:Date.now(),title:f.get("title"),detail:f.get("detail"),module:f.get("module"),priority:f.get("priority"),status:"open"});save();render();closeDialog($("#issueDialog"));toast("问题已加入追踪")};
$("#projectForm").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);const projectId=f.get("projectId");if(projectId){const project=workspace.projects.find(item=>item.id===projectId);Object.assign(project,{name:f.get("name"),category:f.get("category")||"未分类",description:f.get("description"),startDate:f.get("startDate"),endDate:f.get("endDate"),status:f.get("status")});save();render();closeDialog($("#projectDialog"));toast("项目内容已更新");return}const id=`project-${Date.now()}`;workspace.projects.unshift({id,name:f.get("name"),category:f.get("category")||"未分类",description:f.get("description"),startDate:f.get("startDate"),endDate:f.get("endDate"),status:f.get("status"),data:blankData()});workspace.activeProjectId=id;projectCategoryFilter="all";save();render();closeDialog($("#projectDialog"));showView("dashboard");toast("新项目已创建并切换")};
$("#moduleForm").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);const module=mod(f.get("moduleId"));module.name=f.get("name");module.desc=f.get("description");data.progress[module.id]=Math.max(0,Math.min(100,Number(f.get("progress"))));save();render();closeDialog($("#moduleDialog"));toast("进度模块已更新")};
$("#accountBtn").onclick=()=>{
  $("#authMessage").textContent="";
  if(currentUser&&$("#syncState").classList.contains("error"))$("#syncErrorDetail").classList.add("show");
  (currentUser?$("#accountDialog"):$("#authDialog")).showModal();
};
async function signIn(email,password){
  if(!supabaseClient){setGateMessage("Supabase 尚未配置，无法登录。",true);return false}
  setGateMessage("正在登录并读取云端数据...");
  const {error}=await supabaseClient.auth.signInWithPassword({email,password});
  if(error){setGateMessage(error.message,true);return false}
  return true;
}

function validUsername(username){
  return /^[A-Za-z0-9_一-龥]{3,24}$/.test(username);
}

async function signUp(username,email,password){
  if(!supabaseClient){setGateMessage("Supabase 尚未配置，无法注册。",true);return false}
  if(!validUsername(username)){setGateMessage("用户名需为 3–24 位中文、字母、数字或下划线。",true);return false}
  setGateMessage("正在注册...");
  const redirectUrl=window.SUPABASE_CONFIG?.redirectUrl||location.href.split("#")[0];
  const {data:result,error}=await supabaseClient.auth.signUp({email,password,options:{emailRedirectTo:redirectUrl,data:{username}}});
  if(error){
    const message=error.message.toLowerCase().includes("database error")?"用户名可能已被使用，请更换后重试。":error.message;
    setGateMessage(message,true);return false
  }
  setGateMessage(result.session?"注册成功，正在创建云端数据...":"注册成功，请前往邮箱完成验证后再登录。");
  return true;
}

function setAuthMode(target,mode){
  const form=target==="gate"?$("#gateAuthForm"):$("#authForm");
  const toggle=target==="gate"?$("#gateSignUpBtn"):$("#signUpBtn");
  const usernameInput=form.elements.username;
  form.classList.toggle("signup-mode",mode==="signup");
  usernameInput.required=mode==="signup";
  toggle.textContent=mode==="signup"?"返回登录":"切换到注册";
  if(target==="gate"){
    gateAuthMode=mode;
    form.querySelector("button[type=submit]").textContent=mode==="signup"?"注册账户":"登录并读取数据";
  }else{
    dialogAuthMode=mode;
    form.querySelector("button.primary").textContent=mode==="signup"?"注册账户":"登录";
  }
}

$("#gateAuthForm").onsubmit=async e=>{
  e.preventDefault();
  const f=new FormData(e.target);
  if(gateAuthMode==="signup")await signUp(f.get("username"),f.get("email"),f.get("password"));
  else await signIn(f.get("email"),f.get("password"));
};
$("#gateSignUpBtn").onclick=()=>setAuthMode("gate",gateAuthMode==="signup"?"signin":"signup");
$("#signUpBtn").onclick=async()=>{
  if(dialogAuthMode!=="signup"){setAuthMode("dialog","signup");return}
  if(!supabaseClient){$("#authMessage").textContent="请先配置 supabase-config.js";return}
  const form=$("#authForm");
  if(!form.reportValidity())return;
  const f=new FormData(form);
  $("#authMessage").textContent="正在注册...";
  await signUp(f.get("username"),f.get("email"),f.get("password"));
  $("#authMessage").textContent=$("#gateMessage").textContent;
};
$("#authForm").onsubmit=async e=>{
  e.preventDefault();
  if(dialogAuthMode==="signup"){
    const f=new FormData(e.target);
    await signUp(f.get("username"),f.get("email"),f.get("password"));
    $("#authMessage").textContent=$("#gateMessage").textContent;
    return;
  }
  if(!supabaseClient){$("#authMessage").textContent="请先配置 supabase-config.js";return}
  const f=new FormData(e.target);
  $("#authMessage").textContent="正在登录...";
  const ok=await signIn(f.get("email"),f.get("password"));
  if(!ok){$("#authMessage").textContent=$("#gateMessage").textContent;return}
  closeDialog($("#authDialog"));toast("登录成功，正在同步数据");
};
$("#editProfileBtn").onclick=()=>{$("#profileForm [name=username]").value=currentProfile?.username||"";$("#profileMessage").textContent="";$("#profileDialog").showModal()};
$("#profileForm").onsubmit=async e=>{
  e.preventDefault();
  const username=new FormData(e.target).get("username").trim();
  if(!validUsername(username)){$("#profileMessage").textContent="用户名需为 3–24 位中文、字母、数字或下划线。";return}
  const {error}=await supabaseClient.from("user_profiles").upsert({user_id:currentUser.id,username,updated_at:new Date().toISOString()},{onConflict:"user_id"});
  if(error){$("#profileMessage").textContent=error.code==="23505"?"该用户名已被使用，请换一个。":error.message;return}
  currentProfile={username};updateAccountUI();renderMine();closeDialog($("#profileDialog"));toast("个人资料已更新");
};
$("#profileSyncBtn").onclick=async()=>{const ok=await pushWorkspace();toast(ok?"同步完成":"同步失败")};
$("#profileSignOutBtn").onclick=async()=>supabaseClient.auth.signOut();
$("#syncNowBtn").onclick=async()=>{const ok=await pushWorkspace();toast(ok?"同步完成":"同步失败，请查看错误详情")};
$("#signOutBtn").onclick=async()=>{await supabaseClient.auth.signOut();closeDialog($("#accountDialog"));toast("已退出登录")};
$("#issueFilters").onclick=e=>{if(!e.target.dataset.filter)return;issueFilter=e.target.dataset.filter;$$(".chip").forEach(c=>c.classList.toggle("active",c===e.target));renderIssues()};
$("#exportBtn").onclick=()=>{
  const lines=[`# ${activeProject.name} · 项目进展周报`,``,`项目周期：${activeProject.startDate}${activeProject.endDate?` 至 ${activeProject.endDate}`:""}`,`整体进度：${Math.round(Object.values(data.progress).reduce((a,b)=>a+b,0)/modules.length)}%`,``,`## 本周完成`,...data.logs.map(l=>`- ${l.done}（${mod(l.module).name}，${l.hours}h）`),``,`## 待解决问题`,...data.issues.filter(i=>i.status!=="solved").map(i=>`- [${priorityName[i.priority]}] ${i.title}`),``,`## 下一步`,...data.logs.slice(0,3).map(l=>`- ${l.next}`)];
  const blob=new Blob([lines.join("\n")],{type:"text/markdown;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`${activeProject.name}-项目进展周报.md`;a.click();URL.revokeObjectURL(a.href);toast("周报已导出");
};
render();
initSupabase();
