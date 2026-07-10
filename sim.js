(function(){
"use strict";
const SP=["Trees","Insects","Rabbits","Wolves","Fungi","Parasites"];
const SC=["#2e7d32","#b8860b","#795548","#455a64","#6a1b9a","#bf360c"];
const INIT=[36,25,20,7,5,11];
const CAP=[80,60,42,15,28,24];
const PI2=Math.PI*2;
const $=id=>document.getElementById(id);

// Build UI
const sbar=$("sbar"),leg=$("legend");
SP.forEach((n,i)=>{
sbar.innerHTML+=`<div class="sp"><div class="sp-r"><div class="sp-d" style="background:${SC[i]}"></div><span class="sp-n">${n}</span></div><div class="sp-c" style="color:${SC[i]}" id="sc${i}">0</div><div class="sp-t f" id="st${i}">—</div></div>`;
leg.innerHTML+=`<div class="lg" data-i="${i}"><div class="lg-d" style="background:${SC[i]}"></div>${n}</div>`;
});

const cv=$("world"),cx=cv.getContext("2d");
const gpc=$("g-pop"),gpx=gpc.getContext("2d");
const gbc=$("g-bar"),gbx=gbc.getContext("2d");

let S,hid=new Set(),tD=0,tB=0,pk=0,evN=0;

function mkS(){return{
paused:false,speed:1,rain:600,temp:20,sun:70,decomp:50,poll:20,
vt:0,yr:1,mo:1,ent:[[],[],[],[],[],[]],corpses:[],parts:[],birds:[],
soil:80,waterLvl:85,o2:21,hist:[],
ev:null,evT:0,evCD:3,nextEv:8+Math.random()*10,
over:false,fires:[],prev:[...INIT],tick:0
};}

function resize(){
const w=cv.parentElement;cv.width=w.clientWidth;cv.height=w.clientHeight;
[gpc,gbc].forEach(c=>{const h=c.parentElement.querySelector(".gc-h");c.width=c.parentElement.clientWidth;c.height=Math.max(20,c.parentElement.clientHeight-(h?h.offsetHeight:14));});
if(S&&!S.birds.length)for(let i=0;i<10;i++)S.birds.push({x:Math.random()*cv.width,y:cv.height*(.06+Math.random()*.18),vx:.3+Math.random()*1,ph:Math.random()*PI2,fl:Math.floor(i/3)});
}

// Terrain - varied across full width
function hillY(x,layer){
const H=cv.height,b=[.56,.66,.76][layer]||.76;
return H*b+Math.sin(x*.003+layer*2.5)*H*.03+Math.sin(x*.008+layer*4.5)*H*.016+Math.sin(x*.016+layer*1.2)*H*.008;
}
function gndY(x){return hillY(x,2);}

// AQI label
function aqiLbl(v){
if(v<=50)return v+" · Good";
if(v<=100)return v+" · Moderate";
if(v<=150)return v+" · Unhealthy*";
if(v<=200)return v+" · Unhealthy";
if(v<=300)return v+" · Hazardous";
return v+" · LETHAL";
}

// ===== ENTITY =====
function E(type,x){
const W=cv.width;
this.type=type;
this.x=x??Math.random()*(W-40)+20;
this.y=gndY(this.x);
this.vx=(Math.random()-.5)*.1;
this.hp=80+Math.random()*20;
this.age=0;this.alive=true;
this.hunger=Math.random();this.thirst=Math.random();
this.fcd=0;this.rcd=Math.random()*2;
this.ph=Math.random()*PI2;
this.dir=Math.random()>.5?1:-1;
this.walk=Math.random()*PI2;
this.sz=[8,2,3.5,5,3,1.5][type]+Math.random()*[3,.6,1,1.5,1.5,.5][type];
this.maxAge=[60,16,30,40,15,20][type]+Math.random()*[20,8,12,15,8,10][type];
this.biomass=type===0?55+Math.random()*35:0;
this.sight=type===3?100+Math.random()*30:0;
this.state=type===3?"search":"";
this.target=null;this.stateT=0;this.host=null;this.panic=0;
}
E.prototype.dist=function(o){return Math.abs(this.x-o.x);};
E.prototype.toward=function(t,s){if(t.x>this.x){this.vx+=s*.05;this.dir=1;}else{this.vx-=s*.05;this.dir=-1;}};
E.prototype.away=function(t,s){if(t.x>this.x){this.vx-=s*.05;this.dir=-1;}else{this.vx+=s*.05;this.dir=1;}};
E.prototype.wander=function(s){this.vx+=(Math.random()-.5)*s*.04;if(Math.random()<.004)this.dir*=-1;};
E.prototype.move=function(dt){
const W=cv.width,cap=[0,1.4,1.3,2.2,.01,1.1][this.type];
this.vx=Math.max(-cap,Math.min(cap,this.vx));
this.x+=this.vx*dt*24;this.vx*=.85;
if(this.x<8){this.x=8;this.vx=Math.abs(this.vx)*.3;this.dir=1;}
if(this.x>W-8){this.x=W-8;this.vx=-Math.abs(this.vx)*.3;this.dir=-1;}
this.y=gndY(this.x);
this.walk+=Math.abs(this.vx)*dt*6;
};

function near(x,ti,r){let b=null,bd=r;for(const e of S.ent[ti]){if(!e.alive)continue;const d=Math.abs(e.x-x);if(d<bd){bd=d;b=e;}}return b?{e:b,d:bd}:null;}
function pt(x,y,c,n){for(let i=0;i<(n||2);i++)S.parts.push({x:x+(Math.random()-.5)*4,y:y-Math.random()*3,c,vx:(Math.random()-.5)*.8,vy:-Math.random()*1.2-.2,l:1,d:.025+Math.random()*.03,s:1+Math.random()*1.2});}

// ===== DAMAGE FUNCTIONS (realistic) =====
function tDmg(t){
if(t>=15&&t<=28)return 0; // perfect
if(t>28&&t<=35)return(t-28)*.015;
if(t>35&&t<=42)return(t-28)*.06;
if(t>42&&t<=50)return(t-28)*.2;
if(t>50)return 6+((t-50)*.5); // rapid death
if(t<15&&t>=5)return(15-t)*.01;
if(t<5&&t>=0)return(15-t)*.03;
if(t<0&&t>=-15)return(15-t)*.08;
if(t<-15&&t>=-30)return(15-t)*.16;
return 5+((Math.abs(t)-30)*.3); // extreme cold
}
function rDmg(r){
if(r>=400&&r<=900)return 0;
if(r>900&&r<=1400)return(r-900)*.0003;
if(r>1400&&r<=2000)return(r-900)*.001;
if(r>2000)return(r-900)*.003;
if(r<400&&r>=200)return(400-r)*.0008;
if(r<200&&r>=50)return(400-r)*.003;
return(400-r)*.008;
}
function pDmg(aqi){
if(aqi<=50)return 0;
if(aqi<=100)return(aqi-50)*.002;
if(aqi<=200)return(aqi-50)*.01;
if(aqi<=300)return(aqi-50)*.035;
if(aqi<=400)return(aqi-50)*.1;
return(aqi-50)*.25;
}

// ===== EVENTS — context-aware! =====
function pickEvent(){
// Only pick events that make sense with current conditions
const possible=[];
if(S.rain<400)possible.push("drought"); // can only drought if rain is lowish
if(S.rain>800)possible.push("flood"); // can only flood if rain is high
if(S.temp>25&&S.rain<800)possible.push("fire"); // fire needs warmth+dryish
if(S.temp<15)possible.push("blizzard"); // blizzard only if cold
possible.push("plague"); // plague can happen anytime
if(S.temp>10&&S.temp<35&&S.rain>300)possible.push("bloom"); // bloom in good conditions
if(!possible.length)possible.push("plague"); // fallback
return possible[Math.floor(Math.random()*possible.length)];
}

// ===== TICK =====
function tick(dt){
if(S.paused||S.over)return;
const a=dt*S.speed;S.vt+=a;S.tick++;
const tm=Math.floor(S.vt/.5);S.mo=(tm%12)+1;S.yr=Math.floor(tm/12)+1;
const W=cv.width;

const td=tDmg(S.temp),rd=rDmg(S.rain),pd=pDmg(S.poll);
const sunP=Math.max(.05,S.sun/70);
const dR=.3+S.decomp*.014;
const envDmg=(td+rd+pd)*a;

let mv=1;
if(S.temp>38)mv*=.5;if(S.temp<0)mv*=.3;if(S.temp<-15)mv*=.1;
const drought=S.ev==="drought",flood=S.ev==="flood",fire=S.ev==="fire";
const bliz=S.ev==="blizzard",plague=S.ev==="plague",bloom=S.ev==="bloom";
if(flood)mv*=.3;if(bliz)mv*=.15;

// Resources
S.o2=Math.max(0,Math.min(21,S.o2+S.ent[0].length*.003*a-(S.ent[1].length+S.ent[2].length+S.ent[3].length+S.ent[5].length)*.001*a-S.poll*.002*a));
S.waterLvl=Math.max(0,Math.min(100,S.waterLvl+(S.rain-500)*.00008*a-(drought?.8:0)*a));
S.soil=Math.max(0,Math.min(150,S.soil+S.ent[4].length*dR*.05*a-S.ent[0].length*.012*a));

// Birds
for(const b of S.birds){b.ph+=.1;b.x+=b.vx;b.y+=Math.sin(b.ph*.3+b.fl)*.2;if(b.x>W+25){b.x=-15;b.y=cv.height*(.05+Math.random()*.16);}}

// Species
for(let ti=0;ti<6;ti++){
for(const e of S.ent[ti]){
if(!e.alive)continue;
e.age+=a;e.fcd=Math.max(0,e.fcd-a);e.rcd=Math.max(0,e.rcd-a);

// Environmental damage - NO base drain in perfect conditions
const sens=[1.3,1.5,1.2,1,.8,1.1][ti];
e.hp-=envDmg*sens;

// O2 for animals
if(ti>=1&&ti<=3&&S.o2<18)e.hp-=(18-S.o2)*.15*a;
if(ti>=1&&ti<=3&&S.o2<12)e.hp-=(12-S.o2)*.5*a;

// Aging only near maxAge
if(e.age>e.maxAge*.9)e.hp-=((e.age-e.maxAge*.9)/(e.maxAge*.1))*2*a;

switch(ti){
case 0:{ // Trees - only drain from environment, not base
const photo=sunP*Math.max(.1,S.waterLvl/80)*Math.max(.1,S.soil/80);
e.biomass=Math.min(100,e.biomass+photo*.08*a);
e.hp=Math.min(100,e.hp+photo*.04*a); // net positive in good conditions
if(drought){e.hp-=1*a;e.biomass-=.6*a;}
if(flood)e.hp-=.8*a;
if(bliz)e.hp-=.7*a;
if(S.sun<10)e.hp-=(10-S.sun)*.06*a;
if(S.temp<-5)e.hp-=Math.abs(S.temp+5)*.04*a;
if(e.biomass<0)e.hp-=3*a;
// Reproduce only in viable conditions
if(!drought&&!flood&&e.rcd<=0&&e.hp>55&&e.biomass>40&&S.ent[0].length<CAP[0]&&S.soil>10&&S.temp>5&&S.temp<38){
if(Math.random()<.005*photo*(bloom?5:1)*a){
const nx=e.x+(Math.random()-.5)*120;
if(nx>10&&nx<W-10){S.ent[0].push(new E(0,nx));e.rcd=8;e.hp-=8;S.soil-=3;tB++;pt(nx,gndY(nx),"#4caf50");}
}}
break;}
case 1:{ // Insects
e.hunger+=.15*a;e.thirst+=.12*a;
if(plague)e.hp-=1.2*a;if(drought)e.thirst+=.3*a;
if(e.thirst>6)e.hp-=.8*a;if(e.hunger>7)e.hp-=.6*a;
if(S.ent[1].length>CAP[1]*.6)e.hp-=.3*a;
const nt=near(e.x,0,60);
if(nt){e.toward(nt.e,1.2*mv);if(nt.d<10&&e.fcd<=0){e.hp=Math.min(90,e.hp+8);e.hunger=Math.max(0,e.hunger-3);nt.e.biomass-=1.5;nt.e.hp-=.8;e.fcd=3;}}
else e.wander(mv);
if(S.waterLvl>25)e.thirst=Math.max(0,e.thirst-.08*a);
e.move(a);
if(e.rcd<=0&&e.hp>45&&e.hunger<3&&S.ent[1].length<CAP[1]&&S.temp>5&&S.temp<40){if(Math.random()<.008*a){S.ent[1].push(new E(1,e.x+(Math.random()-.5)*16));e.hp-=14;e.rcd=4;tB++;}}
break;}
case 2:{ // Rabbits
e.hunger+=.12*a;e.thirst+=.1*a;e.panic=Math.max(0,e.panic-.3*a);
if(drought)e.thirst+=.25*a;if(bliz)e.hp-=.5*a;
if(e.thirst>6)e.hp-=.7*a;if(e.hunger>8)e.hp-=.6*a;
if(S.ent[2].length>CAP[2]*.6)e.hp-=.3*a;
const np=near(e.x,3,55);
if(np){e.away(np.e,3*mv);e.panic=3;}
else{const nt2=near(e.x,0,85);if(nt2){e.toward(nt2.e,(e.hunger>4?1.2:.7)*mv);if(nt2.d<12&&e.fcd<=0){e.hp=Math.min(90,e.hp+10);e.hunger=Math.max(0,e.hunger-4);nt2.e.biomass-=3.5;nt2.e.hp-=2;e.fcd=5;}}else e.wander(.5*mv);}
if(S.waterLvl>20)e.thirst=Math.max(0,e.thirst-.06*a);
e.move(a);
if(e.rcd<=0&&e.hp>52&&e.hunger<3&&S.ent[2].length<CAP[2]&&S.temp>3&&S.temp<38){if(Math.random()<.004*a){S.ent[2].push(new E(2,e.x+(Math.random()-.5)*20));e.hp-=18;e.rcd=8;tB++;pt(e.x,e.y,"#a1887f");}}
break;}
case 3:{ // Wolves
e.hunger+=.1*a;e.thirst+=.07*a;e.stateT+=a;
if(drought)e.thirst+=.2*a;if(bliz)e.hp-=.4*a;
if(e.thirst>8)e.hp-=.5*a;if(e.hunger>10)e.hp-=.8*a;
if(S.ent[3].length>CAP[3]*.7)e.hp-=.3*a;
switch(e.state){
case"search":e.wander(.35*mv);{let pr=near(e.x,2,e.sight);if(!pr&&e.hunger>6)pr=near(e.x,1,e.sight*.5);if(pr){e.target=pr.e;e.state="stalk";e.stateT=0;}}break;
case"stalk":if(!e.target||!e.target.alive||e.stateT>12||e.dist(e.target)>e.sight*2){e.state="search";e.target=null;break;}e.toward(e.target,.7*mv);if(e.dist(e.target)<35){e.state="chase";e.stateT=0;}break;
case"chase":if(!e.target||!e.target.alive||e.stateT>10||e.dist(e.target)>e.sight*3){e.state="search";e.target=null;break;}e.toward(e.target,2.5*mv);e.hp-=.04*a;if(e.dist(e.target)<10){e.target.alive=false;e.hp=Math.min(100,e.hp+(e.target.type===2?30:10));e.hunger=Math.max(0,e.hunger-10);e.state="rest";e.stateT=0;e.target=null;S.corpses.push({x:e.x,y:e.y,t:12});pt(e.x,e.y,SC[3],3);}break;
case"rest":e.wander(.08*mv);if(e.stateT>5)e.state="search";break;
}
if(S.waterLvl>15)e.thirst=Math.max(0,e.thirst-.03*a);
e.move(a);
if(e.rcd<=0&&e.hp>60&&e.hunger<4&&S.ent[3].length<CAP[3]&&S.temp>0&&S.temp<40){if(Math.random()<.002*a){S.ent[3].push(new E(3,e.x+(Math.random()-.5)*35));e.hp-=24;e.rcd=12;tB++;}}
break;}
case 4:{ // Fungi
e.hp-=(.15+pDmg(S.poll)*.2)*a;
let fed=false;for(const c of S.corpses){if(Math.abs(e.x-c.x)<20){e.hp=Math.min(90,e.hp+4*a);c.t-=1.5*dR*a;fed=true;}}
if(!fed)e.hp-=.3*a;
if(e.rcd<=0&&e.hp>33&&S.corpses.length>0&&S.ent[4].length<CAP[4]){if(Math.random()<.004*dR*a){S.ent[4].push(new E(4,e.x+(Math.random()-.5)*20));e.hp-=8;e.rcd=5;tB++;}}
break;}
case 5:{ // Parasites
e.hunger+=.1*a;if(plague)e.hp=Math.min(90,e.hp+.15*a);if(e.hunger>6)e.hp-=.4*a;if(S.ent[5].length>CAP[5]*.5)e.hp-=.3*a;
if(!e.host||!e.host.alive){e.host=null;let b=near(e.x,0,40);if(!b)b=near(e.x,2,30);if(b){e.toward(b.e,.8*mv);if(b.d<8)e.host=b.e;}else e.wander(.5*mv);e.move(a);}
else{e.x=e.host.x+Math.sin(e.age*2+e.ph)*5;e.y=e.host.y-e.host.sz+Math.cos(e.age*2+e.ph)*2.5;e.hp=Math.min(80,e.hp+.25*a);e.hunger=Math.max(0,e.hunger-.08*a);e.host.hp-=.25*a;if(e.host.biomass!==undefined)e.host.biomass-=.12*a;}
if(e.rcd<=0&&e.hp>36&&S.ent[5].length<CAP[5]){if(Math.random()<.005*a){S.ent[5].push(new E(5,e.x+(Math.random()-.5)*14));e.hp-=12;e.rcd=5;tB++;}}
break;}
}
if(e.hp<=0)e.alive=false;
}}

// Corpses
for(let i=S.corpses.length-1;i>=0;i--){S.corpses[i].t-=a*dR;if(S.ent[4].length<CAP[4]&&Math.random()<.012*dR*a)S.ent[4].push(new E(4,S.corpses[i].x+(Math.random()-.5)*10));if(S.corpses[i].t<=0){S.soil=Math.min(150,S.soil+3*dR);S.corpses.splice(i,1);}}
if(flood&&S.ent[4].length<CAP[4]&&Math.random()<.008*a)S.ent[4].push(new E(4));

// Fire
if(fire){
if(!S.fires.length&&S.ent[0].length){const t=S.ent[0][Math.floor(Math.random()*S.ent[0].length)];S.fires.push({x:t.x,r:10});}
for(const f of S.fires){f.r+=Math.log(f.r+2)*.4*a;if(S.rain>1000)f.r=Math.max(0,f.r-3*a);for(const t of S.ent[0])if(t.alive&&Math.abs(t.x-f.x)<f.r)t.hp-=3.5*a;for(let i=1;i<=3;i++)for(const ent of S.ent[i])if(ent.alive&&Math.abs(ent.x-f.x)<f.r*1.3){ent.away(f,2);ent.hp-=.4*a;}}
S.fires=S.fires.filter(f=>f.r>1);
}

// Remove dead
for(let ti=0;ti<6;ti++){for(let i=S.ent[ti].length-1;i>=0;i--){if(!S.ent[ti][i].alive){S.corpses.push({x:S.ent[ti][i].x,y:S.ent[ti][i].y,t:12});pt(S.ent[ti][i].x,S.ent[ti][i].y,"#8d6e63");S.ent[ti].splice(i,1);tD++;}}}

// Events - context-aware
S.evCD-=a;
if(S.ev){S.evT-=a;if(S.evT<=0){addLog(eI(S.ev)+" "+uc(S.ev)+" ended.",S.ev);S.ev=null;S.fires=[];$("banner").style.display="none";S.evCD=3;evN++;}}
else if(S.evCD<=0&&S.vt>S.nextEv){trigEv();S.nextEv=S.vt+8+Math.random()*10;}

// History - graph uses SAME numbers as bottom bar
const cm=Math.floor(S.vt/.4);
if(S.hist.length<=cm){const sn={t:cm};let tot=0;for(let i=0;i<6;i++){sn[i]=S.ent[i].length;tot+=sn[i];}S.hist.push(sn);pk=Math.max(pk,tot);}

// Extinction
if(S.vt>3){for(let i=0;i<6;i++){if(S.ent[i].length===0){S.over=true;$("go-msg").textContent=SP[i]+" went extinct (Year "+S.yr+", Month "+S.mo+").";$("go-yr").textContent=S.yr;$("go-pk").textContent=pk;$("go-ev").textContent=evN;$("go-de").textContent=tD;$("gameover").style.display="flex";addLog("💀 "+SP[i]+" EXTINCT!","dead");return;}}}

// Particles
for(let i=S.parts.length-1;i>=0;i--){const p=S.parts[i];p.x+=p.vx*a*12;p.y+=p.vy*a*12;p.vy-=.005;p.l-=p.d;if(p.l<=0)S.parts.splice(i,1);}
updUI();
}

function eI(e){return{drought:"☀️",flood:"🌊",fire:"🔥",blizzard:"❄️",plague:"🦠",bloom:"🌸"}[e]||"⚡";}
function uc(s){return s[0].toUpperCase()+s.slice(1);}
function trigEv(){
const ev=pickEvent();S.ev=ev;S.evT=4+Math.random()*5;
const bn=$("banner");bn.style.display="block";
const cfg={drought:{t:"☀️ DROUGHT",bg:"#ef6c00",m:"Drought! Raise rainfall!"},flood:{t:"🌊 FLOOD",bg:"#1565c0",m:"Flood! Lower rainfall!"},fire:{t:"🔥 WILDFIRE",bg:"#c62828",m:"Wildfire! Max rainfall!"},blizzard:{t:"❄️ BLIZZARD",bg:"#5c6bc0",m:"Blizzard! Raise temp!"},plague:{t:"🦠 PLAGUE",bg:"#6a1b9a",m:"Plague spreading!"},bloom:{t:"🌸 BLOOM",bg:"#2e7d32",m:"Super bloom!"}};
const c=cfg[ev];bn.textContent=c.t;bn.style.background=c.bg;bn.style.color="#fff";
addLog(eI(ev)+" "+c.m,ev);
}
function addLog(text,cls){const el=$("log"),d=document.createElement("div");d.className="le "+(cls||"");d.innerHTML='<span class="lt">Y'+S.yr+".M"+S.mo+"</span>"+text;el.appendChild(d);el.scrollTop=el.scrollHeight;while(el.children.length>50)el.removeChild(el.children[0]);}

// Slider warnings
function updateWarnings(){
const rw=$("w-rain"),tw=$("w-temp"),pw=$("w-poll");
rw.className="sg-warn";tw.className="sg-warn";pw.className="sg-warn";
// Rain
if(S.rain<150){rw.textContent="🏜️ Severe drought — vegetation dying";rw.className="sg-warn warn-red";}
else if(S.rain<250){rw.textContent="⚠ Low rainfall — stress on plants";rw.className="sg-warn warn-yellow";}
else if(S.rain>1800){rw.textContent="🌊 Severe flooding!";rw.className="sg-warn warn-red";}
else if(S.rain>1200){rw.textContent="⚠ Heavy rain — flooding risk";rw.className="sg-warn warn-yellow";}
// Temp
if(S.temp>45){tw.textContent="☠ Lethal heat — rapid death!";tw.className="sg-warn warn-red";}
else if(S.temp>35){tw.textContent="🌡️ Dangerous heat";tw.className="sg-warn warn-yellow";}
else if(S.temp<-15){tw.textContent="☠ Extreme cold — rapid death!";tw.className="sg-warn warn-red";}
else if(S.temp<0){tw.textContent="❄️ Below freezing — frost damage";tw.className="sg-warn warn-yellow";}
// Poll
if(S.poll>300){pw.textContent="☠ Hazardous air — mass death!";pw.className="sg-warn warn-red";}
else if(S.poll>150){pw.textContent="⚠ Unhealthy air quality";pw.className="sg-warn warn-yellow";}
else if(S.poll>100){pw.textContent="⚠ Moderate pollution";pw.className="sg-warn warn-yellow";}
}

function updUI(){
$("el-yr").textContent=S.yr;$("el-mo").textContent=S.mo;
let tot=0;
for(let i=0;i<6;i++){const n=S.ent[i].length;tot+=n;$("sc"+i).textContent=n;const p=S.prev[i],te=$("st"+i);if(n>p+1){te.textContent="▲";te.className="sp-t u";}else if(n<p-1){te.textContent="▼";te.className="sp-t d";}else{te.textContent="—";te.className="sp-t f";}}
if(S.tick%8===0)for(let i=0;i<6;i++)S.prev[i]=S.ent[i].length;
$("el-pop").textContent=tot;
$("x-soil").textContent=Math.round(S.soil);$("x-o2").textContent=S.o2.toFixed(1)+"%";
$("x-water").textContent=S.waterLvl>70?"Good":S.waterLvl>40?"Low":"Critical";
$("x-de").textContent=tD;$("x-bi").textContent=tB;
let alive=0;for(let i=0;i<6;i++)if(S.ent[i].length)alive++;$("x-spp").textContent=alive+"/6";

// Health - factor based, 0 damage in perfect conditions = 100%
let hp=100;const factors=[];
const td=tDmg(S.temp),rd=rDmg(S.rain),pd=pDmg(S.poll);
if(td>0){const l=Math.min(40,td*10);hp-=l;factors.push(`<span class="bad">Temp: -${Math.round(l)}</span>`);}else factors.push(`<span class="ok">Temp ✓</span>`);
if(rd>0){const l=Math.min(30,rd*12);hp-=l;factors.push(`<span class="bad">Rain: -${Math.round(l)}</span>`);}else factors.push(`<span class="ok">Rain ✓</span>`);
if(pd>0){const l=Math.min(50,pd*8);hp-=l;factors.push(`<span class="bad">AQI: -${Math.round(l)}</span>`);}else factors.push(`<span class="ok">Air ✓</span>`);
if(S.o2<18){const l=Math.min(20,(18-S.o2)*3);hp-=l;factors.push(`<span class="bad">O₂: -${Math.round(l)}</span>`);}
for(let i=0;i<6;i++){const r=S.ent[i].length/INIT[i];if(r<.15){hp-=15;factors.push(`<span class="bad">${SP[i]}!</span>`);}else if(r<.3)hp-=5;}

hp=Math.max(0,Math.min(100,hp));
const hb=$("hp-b"),hv=$("hp-v"),bdg=$("badge");
hb.style.width=hp+"%";hv.textContent=Math.round(hp)+"%";
if(hp>65){hb.style.background="#43a047";hv.style.color="#2e7d32";bdg.textContent="STABLE";bdg.className="badge ok";}
else if(hp>35){hb.style.background="#ef6c00";hv.style.color="#d84315";bdg.textContent="WARNING";bdg.className="badge warn";}
else{hb.style.background="#c62828";hv.style.color="#b71c1c";bdg.textContent="CRITICAL";bdg.className="badge crit";}
$("hp-det").innerHTML=factors.join("");
updateWarnings();
}

// ===== RENDER =====
function render(t){
const c=cx,W=cv.width,H=cv.height;
if(W<2)return;
const temp=S.temp,sun=S.sun,poll=S.poll,rain=S.rain;

// Sky reacts properly
const skyHue=poll>150?45:temp<0?215:205;
const skySat=Math.max(8,55-poll*.12);
const skyLit=Math.min(92,55+sun*.38-poll*.06);
const sky=c.createLinearGradient(0,0,0,H*.7);
sky.addColorStop(0,`hsl(${skyHue},${skySat}%,${skyLit}%)`);
sky.addColorStop(1,`hsl(110,${25+sun*.12}%,${68+sun*.08}%)`);
c.fillStyle=sky;c.fillRect(0,0,W,H);

// Pollution haze
if(poll>40){const a=Math.min(.45,(poll-40)*.001);c.fillStyle=`rgba(${100+poll*.15},${90+poll*.08},55,${a})`;c.fillRect(0,0,W,H);}

// Sun
if(sun>15&&poll<400){
const sx=W*.83,sy=H*(.06+(100-sun)*.0015),sr=10+sun*.15;
const sg=c.createRadialGradient(sx,sy,0,sx,sy,sr*3.5);
sg.addColorStop(0,`rgba(255,250,200,${sun*.006})`);sg.addColorStop(1,"rgba(255,220,100,0)");
c.fillStyle=sg;c.beginPath();c.arc(sx,sy,sr*3.5,0,PI2);c.fill();
c.beginPath();c.arc(sx,sy,sr,0,PI2);c.fillStyle=`rgba(255,240,180,${.2+sun*.005})`;c.fill();
if(sun>60){c.strokeStyle=`rgba(255,245,200,${(sun-60)*.005})`;c.lineWidth=1;for(let i=0;i<8;i++){const a=i*Math.PI/4+t*.12;c.beginPath();c.moveTo(sx+Math.cos(a)*sr*1.5,sy+Math.sin(a)*sr*1.5);c.lineTo(sx+Math.cos(a)*sr*2.8,sy+Math.sin(a)*sr*2.8);c.stroke();}}
}

// Clouds
const cloudN=Math.floor(2+rain/350);
for(let i=0;i<cloudN;i++){
const cx2=((i*W/(cloudN+1)+t*(3+i*1.2))%(W+250))-120;
const cy2=H*(.03+i*.022);
const grey=Math.max(150,240-poll*.6-rain*.005);
const alpha=Math.min(.5,.1+rain*.00015+poll*.0003);
c.fillStyle=`rgba(${grey},${grey},${grey+3},${alpha})`;
for(let j=0;j<5;j++){c.beginPath();c.arc(cx2+j*15,cy2+Math.sin(j+i)*2,9+j*3+rain*.002,0,PI2);c.fill();}
}

// Birds
for(const b of S.birds){const wing=Math.sin(b.ph)*3;c.strokeStyle=poll>250?"#aaa":"#555";c.lineWidth=1;c.lineCap="round";c.beginPath();c.moveTo(b.x-3.5,b.y+wing*.35);c.quadraticCurveTo(b.x-1,b.y-Math.abs(wing)*.8,b.x,b.y);c.moveTo(b.x,b.y);c.quadraticCurveTo(b.x+1,b.y-Math.abs(wing)*.8,b.x+3.5,b.y+wing*.35);c.stroke();}

// Mountains
c.beginPath();c.moveTo(0,H);for(let x=0;x<=W;x+=2)c.lineTo(x,hillY(x,0));c.lineTo(W,H);c.closePath();
c.fillStyle=`hsl(${118+poll*.15},${20-poll*.06}%,${63-poll*.04}%)`;c.fill();
c.beginPath();c.moveTo(0,H);for(let x=0;x<=W;x+=2)c.lineTo(x,hillY(x,1));c.lineTo(W,H);c.closePath();
c.fillStyle=`hsl(${112+poll*.1},${26-poll*.05}%,${53-poll*.04}%)`;c.fill();

// Ground
c.beginPath();c.moveTo(0,H);for(let x=0;x<=W;x+=2)c.lineTo(x,gndY(x));c.lineTo(W,H);c.closePath();
const grd=c.createLinearGradient(0,H*.74,0,H);
grd.addColorStop(0,`hsl(${106-poll*.15},${36-poll*.08}%,${38-poll*.04}%)`);
grd.addColorStop(1,`hsl(${96-poll*.2},${40-poll*.1}%,${28-poll*.03}%)`);
c.fillStyle=grd;c.fill();

// Underground
c.fillStyle=`hsl(30,${25-poll*.08}%,${30-poll*.04}%)`;c.fillRect(0,H*.94,W,H*.06);

// Snow on ground when temp < 2
if(temp<2){const sd=Math.min(6,(2-temp)*.3);c.fillStyle=`rgba(255,255,255,${Math.min(.3,(2-temp)*.012)})`;c.beginPath();c.moveTo(0,H);for(let x=0;x<=W;x+=2)c.lineTo(x,gndY(x)-sd);c.lineTo(W,H);c.closePath();c.fill();}

// Grass (hide in cold/polluted)
if(temp>2&&poll<300){c.globalAlpha=Math.max(.04,.15-poll*.0003);c.strokeStyle=`hsl(${106-poll*.15},35%,34%)`;c.lineWidth=.6;
for(let i=0;i<45;i++){const gx=(i*W/45+i*5)%W,gy=gndY(gx);for(let j=0;j<2;j++){const ang=-Math.PI/2+(Math.random()-.5)*.35+Math.sin(t*1.3+i+j)*.05;c.beginPath();c.moveTo(gx+j*1.5,gy);c.lineTo(gx+j*1.5+Math.cos(ang)*3.5,gy+Math.sin(ang)*3.5);c.stroke();}}c.globalAlpha=1;}

// Event overlays
if(S.ev==="drought"){c.fillStyle="rgba(255,190,60,.05)";c.fillRect(0,0,W,H);}
if(S.ev==="flood"){const wy=H*.87;c.fillStyle="rgba(33,150,243,.1)";c.fillRect(0,wy,W,H-wy);}

// Fire
for(const f of S.fires){const fy=gndY(f.x);const gr=c.createRadialGradient(f.x,fy-6,0,f.x,fy-6,f.r);gr.addColorStop(0,"rgba(255,140,30,.14)");gr.addColorStop(.5,"rgba(255,50,0,.06)");gr.addColorStop(1,"rgba(180,0,0,0)");c.beginPath();c.arc(f.x,fy-6,f.r,0,PI2);c.fillStyle=gr;c.fill();}

// Corpses
for(const co of S.corpses){const a=Math.min(.2,co.t/8);c.beginPath();c.arc(co.x,co.y+1,1.5,0,PI2);c.fillStyle=`rgba(120,85,72,${a})`;c.fill();}

// ===== ENTITIES =====
// Trees
for(const tr of S.ent[0]){
const hp=Math.max(.1,tr.hp/100),s=tr.sz*(.5+hp*.5),sw=Math.sin(t*.9+tr.ph)*1;
c.save();c.translate(tr.x,tr.y);
const h=s*2;
c.fillStyle=`hsl(25,${25+hp*15}%,${28+hp*7}%)`;
c.beginPath();c.moveTo(-1.8,0);c.quadraticCurveTo(-1.2,-h*.5,-.6,-h*.8+sw*.2);c.lineTo(.6,-h*.8+sw*.2);c.quadraticCurveTo(1.2,-h*.5,1.8,0);c.closePath();c.fill();
for(let l=2;l>=0;l--){const ls=s*(1-l*.1),ly=-h*.8-l*s*.32+sw*l*.06,lx=sw*(.06+l*.02);
const g=Math.floor(68+hp*95-l*12),r=Math.floor(30+(1-hp)*60+l*6);
c.beginPath();c.arc(lx,ly,ls,0,PI2);c.fillStyle=`rgba(${r},${g},${26+l*7},.78)`;c.fill();}
c.restore();
}

// Fungi
for(const f of S.ent[4]){const fs=f.sz*(1+Math.sin(t*2.5+f.ph)*.06);c.save();c.translate(f.x,f.y);c.fillStyle="rgba(180,170,180,.4)";c.fillRect(-.6,0,1.2,-fs);c.beginPath();c.arc(0,-fs,fs*.8,Math.PI,0);c.fillStyle="rgba(106,27,154,.5)";c.fill();c.restore();}

// Insects - small, hover above ground
for(const ins of S.ent[1]){const iy=ins.y-3-Math.sin(t*3.5+ins.ph)*2,wf=Math.sin(t*22+ins.ph)*1.5;c.save();c.translate(ins.x,iy);
c.globalAlpha=.2;c.beginPath();c.ellipse(-1.2,0,1.8,.6+Math.abs(wf)*.15,0,0,PI2);c.fillStyle="#fff8c0";c.fill();c.beginPath();c.ellipse(1.2,0,1.8,.6+Math.abs(wf)*.15,0,0,PI2);c.fill();c.globalAlpha=1;
c.beginPath();c.ellipse(0,0,ins.sz*.8,ins.sz*.4,0,0,PI2);c.fillStyle="#b8860b";c.fill();c.restore();}

// Rabbits - compact, realistic
for(const h of S.ent[2]){
const hop=Math.abs(Math.sin(h.walk))*2*(Math.abs(h.vx)>.05?1:0),s=h.sz;
c.save();c.translate(h.x,h.y-hop);c.scale(h.dir,1);
// Body - elongated oval
c.beginPath();c.ellipse(0,0,s*1,s*.55,0,0,PI2);c.fillStyle=h.panic>0?"#a1887f":"#795548";c.fill();
// Head
c.beginPath();c.arc(s*.7,-.3,s*.35,0,PI2);c.fillStyle="#8d6e63";c.fill();
// Ear
c.beginPath();c.ellipse(s*.6,-s*.8,.8,s*.4,-.1,0,PI2);c.fillStyle="#a1887f";c.fill();
// Eye
c.beginPath();c.arc(s*.9,-.5,.6,0,PI2);c.fillStyle="#222";c.fill();
// Nose
c.beginPath();c.arc(s*1,-.1,.3,0,PI2);c.fillStyle="#d4a0a0";c.fill();
// Tail
c.beginPath();c.arc(-s*.85,0,1.2,0,PI2);c.fillStyle="#d7ccc8";c.fill();
// Legs
const lp=h.walk;c.strokeStyle="#5d4037";c.lineWidth=.9;c.lineCap="round";
c.beginPath();c.moveTo(s*.3,s*.4);c.lineTo(s*.3+Math.sin(lp)*1.2,s*.4+2.5);c.stroke();
c.beginPath();c.moveTo(-s*.25,s*.35);c.lineTo(-s*.25+Math.sin(lp+1.57)*1.5,s*.35+3);c.stroke();
c.restore();
}

// Wolves - sleek, proportional
for(const p of S.ent[3]){
const ch=p.state==="chase",s=p.sz;
c.save();c.translate(p.x,p.y);c.scale(p.dir,1);
// Tail
const tw=Math.sin(t*4.5+p.ph)*3;
c.beginPath();c.moveTo(-s*1.1,-.2);c.quadraticCurveTo(-s*1.5,tw-1,-s*1.8,tw*.5);c.strokeStyle=ch?"#455a64":"#607d8b";c.lineWidth=1.8;c.lineCap="round";c.stroke();
// Body
c.beginPath();c.ellipse(0,0,s*1.2,s*.5,0,0,PI2);c.fillStyle=ch?"#37474f":"#607d8b";c.fill();
// Head
c.beginPath();c.arc(s*.9,-.15,s*.38,0,PI2);c.fillStyle=ch?"#455a64":"#78909c";c.fill();
// Snout
c.beginPath();c.ellipse(s*1.25,0,s*.18,s*.1,0,0,PI2);c.fillStyle="#90a4ae";c.fill();
// Nose
c.beginPath();c.arc(s*1.38,0,.9,0,PI2);c.fillStyle="#263238";c.fill();
// Eye
c.beginPath();c.arc(s*.98,-.8,1,0,PI2);c.fillStyle=ch?"#fff9c4":"#eceff1";c.fill();
c.beginPath();c.arc(s*1.02,-.8,.4,0,PI2);c.fillStyle="#111";c.fill();
// Ear
c.beginPath();c.moveTo(s*.65,-.3);c.lineTo(s*.85,-.85);c.lineTo(s*1.05,-.2);c.closePath();c.fillStyle=ch?"#37474f":"#546e7a";c.fill();
// Legs
const lp=t*(ch?11:6);c.strokeStyle=ch?"#263238":"#37474f";c.lineWidth=1.3;
c.beginPath();c.moveTo(s*.35,s*.38);c.lineTo(s*.35+Math.sin(lp)*2,s*.38+3.5);c.stroke();
c.beginPath();c.moveTo(s*.7,s*.38);c.lineTo(s*.7+Math.sin(lp+Math.PI)*2,s*.38+3.5);c.stroke();
c.beginPath();c.moveTo(-s*.3,s*.32);c.lineTo(-s*.3+Math.sin(lp+Math.PI/2)*2,s*.32+3.8);c.stroke();
c.restore();
}

// Parasites
for(const pa of S.ent[5]){c.beginPath();c.arc(pa.x,pa.host?pa.y:pa.y-1.5,pa.sz,0,PI2);c.fillStyle="#bf360c";c.fill();}

// Particles
for(const p of S.parts){c.globalAlpha=p.l;c.beginPath();c.arc(p.x,p.y,p.s*p.l,0,PI2);c.fillStyle=p.c;c.fill();}c.globalAlpha=1;

// RAIN
if(rain>200){const int=Math.min(1,(rain-200)/1800);const drops=Math.floor(int*100);c.strokeStyle=`rgba(70,130,200,${.06+int*.25})`;c.lineWidth=.6+int*.6;
for(let i=0;i<drops;i++){const rx=Math.random()*W,ry=Math.random()*H*.86,len=3+int*12;c.beginPath();c.moveTo(rx,ry);c.lineTo(rx-.2,ry+len);c.stroke();}}

// SNOW (only temp < 2!)
if(temp<2){const int=Math.min(1,(2-temp)/22);const flakes=Math.floor(int*100);c.fillStyle=`rgba(255,255,255,${.25+int*.45})`;
for(let i=0;i<flakes;i++){const sx=(i*59.3+t*(12+i*1.2))%W,sy=(i*103.7+t*(8+i*.7))%(H*.86);c.beginPath();c.arc(sx,sy,.3+Math.random()*1.3*int,0,PI2);c.fill();}}

// Heat shimmer
if(temp>35){c.fillStyle=`rgba(200,80,0,${(temp-35)*.0025})`;c.fillRect(0,0,W,H);}
}

// ===== GRAPHS =====
function drawPop(){
const c=gpx,w=gpc.width,h=gpc.height;if(w<2||h<2)return;
c.fillStyle="#fbfbf8";c.fillRect(0,0,w,h);
const p={t:8,r:6,b:14,l:24},gw=w-p.l-p.r,gh=h-p.t-p.b;if(gw<2||gh<2)return;
c.strokeStyle="#eef0ec";c.lineWidth=.5;
for(let i=0;i<=4;i++){const y=p.t+gh*i/4;c.beginPath();c.moveTo(p.l,y);c.lineTo(w-p.r,y);c.stroke();}
const data=S.hist;if(data.length<2)return;
const vis=data.slice(-80);
let mx=10;for(const d of vis)for(let i=0;i<6;i++){if(!hid.has(i))mx=Math.max(mx,d[i]||0);}
mx=Math.ceil(mx*1.15/5)*5;
c.fillStyle="#aaa";c.font="6.5px sans-serif";c.textAlign="right";
for(let i=0;i<=4;i++)c.fillText(Math.round(mx*(1-i/4)),p.l-2,p.t+gh*i/4+3);
for(let ti=0;ti<6;ti++){
if(hid.has(ti))continue;
c.beginPath();for(let i=0;i<vis.length;i++){const x=p.l+(i/Math.max(1,vis.length-1))*gw;const y=p.t+gh-((vis[i][ti]||0)/mx)*gh;i===0?c.moveTo(x,y):c.lineTo(x,y);}
c.strokeStyle=SC[ti];c.lineWidth=1.6;c.lineJoin="round";c.stroke();
c.lineTo(p.l+gw,p.t+gh);c.lineTo(p.l,p.t+gh);c.closePath();c.fillStyle=SC[ti]+"08";c.fill();
if(vis.length){const last=vis[vis.length-1];const lx=p.l+gw,ly=p.t+gh-((last[ti]||0)/mx)*gh;c.beginPath();c.arc(lx,ly,2,0,PI2);c.fillStyle=SC[ti];c.fill();}
}
c.strokeStyle="#ddd";c.lineWidth=.7;c.beginPath();c.moveTo(p.l,p.t);c.lineTo(p.l,p.t+gh);c.lineTo(p.l+gw,p.t+gh);c.stroke();
}

function drawBar(){
const c=gbx,w=gbc.width,h=gbc.height;if(w<2||h<2)return;
c.fillStyle="#fbfbf8";c.fillRect(0,0,w,h);
const pd={t:4,r:4,b:14,l:4},gw=w-pd.l-pd.r,gh=h-pd.t-pd.b;if(gw<2||gh<2)return;
const bw=gw/6-2;c.font="6px sans-serif";c.textAlign="center";
for(let i=0;i<6;i++){
const x=pd.l+(gw/6)*i+1,n=S.ent[i].length,pct=Math.min(1,n/CAP[i]);
c.fillStyle="#eef0ec";c.fillRect(x,pd.t,bw,gh);
const col=n===0?"#c62828":pct>.85?"#ef6c00":pct<.18&&n>0?"#ef6c00":SC[i];
c.fillStyle=col+"cc";c.fillRect(x,pd.t+gh*(1-pct),bw,gh*pct);
c.strokeStyle=SC[i];c.lineWidth=.6;c.strokeRect(x,pd.t,bw,gh);
c.fillStyle="#888";c.fillText(SP[i].slice(0,3),x+bw/2,h-pd.b+8);
c.fillStyle="#333";c.font="bold 7px sans-serif";c.fillText(n,x+bw/2,pd.t+gh*(1-pct)-2);c.font="6px sans-serif";
}}

// LOOP
let lt=performance.now(),acc=0;
function loop(now){const dt=Math.min(50,now-lt);lt=now;if(!S.over){acc+=dt;while(acc>=100){tick(.1);acc-=100;}}render(now*.001);drawPop();drawBar();requestAnimationFrame(loop);}

// CONTROLS
$("s-rain").addEventListener("input",e=>{S.rain=+e.target.value;$("v-rain").textContent=S.rain+" mm";});
$("s-temp").addEventListener("input",e=>{S.temp=+e.target.value;$("v-temp").textContent=S.temp+" °C";});
$("s-sun").addEventListener("input",e=>{S.sun=+e.target.value;$("v-sun").textContent=S.sun+"%";});
$("s-decomp").addEventListener("input",e=>{S.decomp=+e.target.value;$("v-decomp").textContent=S.decomp+"%";});
$("s-poll").addEventListener("input",e=>{S.poll=+e.target.value;$("v-poll").textContent=aqiLbl(S.poll);});

$("btn-pause").addEventListener("click",()=>{S.paused=!S.paused;$("btn-pause").textContent=S.paused?"▶ Play":"⏸ Pause";$("btn-pause").classList.toggle("on",S.paused);});
$("btn-speed").addEventListener("click",()=>{const sp=[1,2,4];S.speed=sp[(sp.indexOf(S.speed)+1)%sp.length];$("btn-speed").textContent="▶ "+S.speed+"×";});
$("btn-reset").addEventListener("click",start);
$("go-btn").addEventListener("click",start);
$("btn-aid").addEventListener("click",()=>{for(let i=0;i<6;i++){if(S.ent[i].length<3&&S.ent[i].length>0){for(let j=0;j<2;j++){S.ent[i].push(new E(i,S.ent[i][0].x+(Math.random()-.5)*40));tB++;}}for(const e of S.ent[i])e.hp=Math.min(100,e.hp+20);}S.soil=Math.min(150,S.soil+20);S.waterLvl=Math.min(100,S.waterLvl+15);addLog("💊 Emergency aid!","");});
document.querySelectorAll(".lg").forEach(el=>{el.addEventListener("click",()=>{const i=+el.dataset.i;if(hid.has(i)){hid.delete(i);el.classList.remove("off");}else{hid.add(i);el.classList.add("off");}});});

function start(){
S=mkS();tD=0;tB=0;pk=0;evN=0;resize();
for(let i=0;i<6;i++)for(let j=0;j<INIT[i];j++)S.ent[i].push(new E(i));
for(let i=0;i<6;i++)S.prev[i]=INIT[i];
$("s-rain").value=600;$("v-rain").textContent="600 mm";
$("s-temp").value=20;$("v-temp").textContent="20 °C";
$("s-sun").value=70;$("v-sun").textContent="70%";
$("s-decomp").value=50;$("v-decomp").textContent="50%";
$("s-poll").value=20;$("v-poll").textContent=aqiLbl(20);
$("gameover").style.display="none";$("banner").style.display="none";$("log").innerHTML="";
$("btn-pause").textContent="⏸ Pause";$("btn-pause").classList.remove("on");$("btn-speed").textContent="▶ 1×";
addLog("🌍 Ecosystem initialized — keep everything alive!","");
}

window.addEventListener("resize",resize);
start();requestAnimationFrame(loop);
})();