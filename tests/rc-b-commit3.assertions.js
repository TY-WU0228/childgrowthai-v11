'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const server=require(path.join(root,'netlify/functions/analyze-homework.js')).__rcbTest;
const clone=value=>JSON.parse(JSON.stringify(value));
function section(start,end){const a=html.indexOf(start),b=html.indexOf(end,a);assert(a>=0&&b>a,`missing ${start}`);return html.slice(a,b)}
function secondSection(start,end){const hits=[...html.matchAll(new RegExp(start.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))].map(x=>x.index);assert.equal(hits.length,2);const b=html.indexOf(end,hits[1]);assert(b>hits[1]);return html.slice(hits[1],b)}

const stubs=`
var app={profile:{childName:'Student',year:'Year 2'},homeworkReports:[],emotions:[],teacherComments:[],schoolNotices:[],activityReports:[],todayTasks:[],routines:[]};
var DAYS=['Monday'],DAY_LABEL={Monday:'Monday'},persistence={save:0,storage:0,cache:0,history:0},builderCalls=0,elements={analytics:{innerHTML:''}};
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function v70SanitizeHomeworkReport(r){r.strengths=Array.isArray(r.strengths)?r.strengths.slice():[];r.checkPoints=Array.isArray(r.checkPoints)?r.checkPoints.slice():[];return r}
function v76HardGuardHomeworkReport(r){r.checkPoints=(r.checkPoints||[]).slice();return r}
function v74TextOfReport(r){return [r.summary,...(r.strengths||[]),...(r.checkPoints||[])].filter(Boolean).join(' ')}
function v74DetectConfidence(){return 'High'} function v74QualityScore(){return 80} function v80QualityScore(){return 90}
function v74DetectSubject(){return 'Maths'} function v74DetectWorksheetLevel(){return 'Year 2'}
function v80IsGenericTag(x){return /general/i.test(String(x||''))}
function v79SkillInterpretation(row){return row.status} function v79StatusClass(s){return s}
function v82CleanEvidence(rows){return (rows||[]).map(x=>({...x}))}
function v79BuildEngineFromReport(){builderCalls++;return {evidence:[{question:'fabricated',status:'wrong',skill:'Fabricated'}]}}
function v9611ApplyHomeworkCanonical(r){r.renderOnlyCanonical=true;r.growth=r.growth||{};return r}
function v93SanitizeReport(r){r.renderOnlySanitized=true;return r}
function v93CleanArray(a,n=6){return (a||[]).slice(0,n)}
function v93IsIncompleteReport(){return false} function v93IncompleteReportHTML(){return '<div>incomplete</div>'}
function v85AdminMode(){return false} function v84ReportQA(){return {score:90,label:'Parent-ready',incomplete:false}}
function v82ReviewList(r){return (r.engineV2?.evidence||[]).filter(x=>x.status!=='correct').map(x=>x.question)}
function v84WowSummary(r){return 'Verified evidence summary'} function v96HeroSub(){return ''}
function v93ParentCleanText(s){return String(s||'')} function v85ConcreteNextStep(r){return r.engineV2?.evidence?.[0]?.question?'Review '+r.engineV2.evidence[0].question:'Review the worksheet'}
function v85ParentModeTags(){return ''} function v82TagHTML(){return ''} function v80ReadingTableHTML(){return ''}
function v78SummaryHTML(s){return esc(s)} function compactList(a,f=''){return (a||[]).length?'<ul>'+a.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':f}
function v85ParentStrengths(r){return (r.engineV2?.evidence||[]).filter(x=>x.status==='correct').map(x=>x.question)}
function v93ReviewDetailHTML(r){return '<div>FACTUAL:'+(r.engineV2?.evidence||[]).map(x=>esc(x.question)).join('|')+'</div>'}
function v85ParentInsight(){return 'Review verified worksheet evidence.'} function v84QAHTML(){return ''} function v82EvidenceCardsHTML(){return ''}
function v9611NormalizedReport(r){const ev=r.engineV2?.evidence||[];return {counts:{stable:ev.filter(x=>x.status==='correct').length,wrong:ev.filter(x=>x.status==='wrong').length,review:0,missing:0},isMath:true}}
function v93IsIncompleteReport(){return false} function v92ChildLabel(){return 'Student'}
function routinesForDay(){return []} function todayISO(){return '2026-07-18'} function moodIcon(){return ''}
function v74TagHTML(items){return (items||[]).join(',')} function v74FrameworkHTML(){return ''}
function v74ReportEngineSnapshotHTML(){return v79SkillTrendDashboardHTML()} function $(id){return elements[id]||(elements[id]={innerHTML:''})}
function save(){persistence.save++} var localStorage={setItem(){persistence.storage++},removeItem(){persistence.storage++}};
this.api={setApp(v){app=v},getApp(){return app},homeworkReportHTML,renderAnalytics,weeklyReportHTML,v74GrowthStats,v74AllHomeworkReports,
 vRCBPrepareHomeworkReportView,v79MergeSkillTrends,v79SkillTrendDashboardHTML,v79AnalyticsEligibility,validateServerEvidenceAuthorityV2,
 trend:v79SkillTrend,html(){return elements.analytics.innerHTML},reset(){persistence={save:0,storage:0,cache:0,history:0};builderCalls=0;elements.analytics={innerHTML:''}},
 counters(){return {...persistence,builder:builderCalls}},serialize(){return JSON.stringify(app)}};
`;
const source=[
  section('function rcBSha256Hex','function v81MergeHomeworkReports'),
  section('function v79SkillTrendHTML','function v78ChoiceStatus'),
  secondSection('function v79SkillTrend(evidence)','function v82ReadingRows'),
  section('function vRCBRenderClone','function v74TagHTML'),
  section('function v74Count','function v74ReportEngineSnapshotHTML'),
  section('function homeworkReportHTML','function renderAnalytics'),
  section('function renderAnalytics','/* V88 Dynamic child + school routine labels */'),
  stubs
].join('\n');
const context=vm.createContext({TextEncoder,JSON,Set,Map,WeakMap,Reflect,Date,Number,String,Array,Object,Math,RegExp,console});
vm.runInContext(source,context,{filename:'index.html#rc-b-commit3'});
const api=context.api;

const row=(n,status='correct')=>`Page: 1 | Q${n}: ${n} + 1 | Student: ${n+1} | Correct: ${n+1} | Status: ${status} | Skill: Addition`;
function trusted(lineage='lineage_commit3_valid001',rows=[row(1)],order=0,count=1){
  const report={extractedEvidence:rows,summary:'summary prose',strengths:['strength prose'],checkPoints:['checkpoint prose'],reasons:['reason prose'],parentInterpretation:'parent prose',rawAnalysis:'raw prose',pages:[{id:1}],quality:{raw:true},metadata:{nested:{value:1}}};
  return server.applyCanonicalEvidenceAuthorityV2(report,{reportLineageId:lineage,imageOrder:order,submittedImageCount:count,validationErrors:[]});
}
function partial(){const r=trusted('lineage_commit3_partial01',[row(1),row(2,'wrong')],0,2);r.processing={processingCoverage:'partial',submittedImageCount:2,attemptedRequestCount:2,successfulResponseCount:1,acceptedResponseCount:1,failedResponseCount:1,includedResponseCount:1,perImage:[{imageOrder:0,status:'accepted',includedInMerge:true,canonicalRowCount:2,blockingErrorCode:null},{imageOrder:1,status:'failed',includedInMerge:false,canonicalRowCount:0,blockingErrorCode:'REQUEST_FAILED'}]};return r}
function legacy(){return {summary:'fabricated prose',strengths:['fabricated'],checkPoints:['fabricated'],rawAnalysis:'fabricated',engineV2:{evidence:[{question:'fabricated',status:'wrong',skill:'Fake'}]}}}
function invalid(kind='fingerprint'){const r=trusted('lineage_commit3_invalid01');if(kind==='fingerprint')r.evidenceAuthority.canonicalEvidenceFingerprint='0'.repeat(64);if(kind==='count')r.evidenceAuthority.canonicalEvidenceCount++;if(kind==='lineage')r.canonicalEvidence[0].reportLineageId='lineage_commit3_other000';if(kind==='binding')r.engineV2.evidence[0].sourceRowId='0'.repeat(64);return r}
function failed(){const r=trusted('lineage_commit3_failed001');r.processing={processingCoverage:'failed',submittedImageCount:1,attemptedRequestCount:1,successfulResponseCount:0,acceptedResponseCount:0,failedResponseCount:1,includedResponseCount:0,perImage:[{imageOrder:0,status:'failed',includedInMerge:false,canonicalRowCount:0,blockingErrorCode:'REQUEST_FAILED'}]};return r}
function unknown(){const r=trusted('lineage_commit3_unknown01');r.processing={processingCoverage:'unknown'};return r}
function emptyCanonical(){return trusted('lineage_commit3_emptycan1',[])}
function emptyEngine(){const r=trusted('lineage_commit3_emptyeng1');r.engineV2.evidence=[];return r}
function stale(){const r=invalid();r.publishable=true;return r}
function appFor(reports){return {profile:{childName:'Student',year:'Year 2'},homeworkReports:reports.map((report,i)=>({id:'r'+i,date:'2026-07-18T00:00:00Z',imageCount:1,note:'',report})),emotions:[],teacherComments:[],schoolNotices:[],activityReports:[],todayTasks:[],routines:[]}}
function factual(html){return (String(html).match(/FACTUAL:[^<]*/g)||[]).join('|')}
function assertUnavailable(output){assert.match(output,/not available|Unavailable/i);assert.doesNotMatch(output,/engineMiniGrid|Skill Status Summary|FACTUAL:|0 wrong|0 needs attention|100% ready|all skills strong/i)}

const results=[];
function test(name,expected,fn){fn();results.push({name,expected,actual:'requirements satisfied',status:'PASS'})}

test('A Trusted Homework Report purity','trusted rows display; source and persistence unchanged',()=>{const r=trusted(),before=clone(r);api.reset();const out=api.homeworkReportHTML(r,{imageCount:1});assert.match(out,/FACTUAL:1 \+ 1/);assert.deepEqual(r,before);assert.equal(api.counters().save,0)});
test('B Legacy Homework Report fail-closed purity','no prose-derived facts and source unchanged',()=>{const r=legacy(),before=clone(r),out=api.homeworkReportHTML(r,{});assertUnavailable(out);assert.deepEqual(r,before)});
test('C Missing-authority Homework Report purity','neutral unavailable state and source unchanged',()=>{const r={},before=clone(r);assertUnavailable(api.homeworkReportHTML(r,{}));assert.deepEqual(r,before)});
test('D Invalid Homework Report purity','fingerprint/count/lineage/binding failures suppress facts without repair',()=>{for(const kind of ['fingerprint','count','lineage','binding']){const r=invalid(kind),before=clone(r);assertUnavailable(api.homeworkReportHTML(r,{}));assert.deepEqual(r,before)}});
test('E Stale publishable regression','stale true cannot bypass any protected view',()=>{const r=stale(),before=clone(r);assertUnavailable(api.homeworkReportHTML(r,{}));api.setApp(appFor([r]));assertUnavailable(api.v79SkillTrendDashboardHTML());assertUnavailable(api.weeklyReportHTML());assert.deepEqual(r,before);assert.equal(r.publishable,true)});
test('F Unknown processing regression','unknown processing fails closed and remains unchanged',()=>{const r=unknown(),before=clone(r);assertUnavailable(api.homeworkReportHTML(r,{}));api.setApp(appFor([r]));assert.equal(api.v74GrowthStats().trustedReportCount,0);assert.deepEqual(r,before)});
test('G Partial Homework Report purity','trusted included rows display with partial and coverage limitations',()=>{const r=partial(),before=clone(r),out=api.homeworkReportHTML(r,{});assert.match(out,/FACTUAL:/);assert.match(out,/Only successfully processed work is included/);assert.match(out,/not confirmed that every question/);assert.deepEqual(r,before);assert.equal(r.contentCoverage,'unverified')});
test('H Analytics full-state purity','trusted metrics render with exact collection equality',()=>{const state=appFor([trusted(),legacy()]),before=clone(state.homeworkReports);api.setApp(state);api.renderAnalytics();assert.match(api.html(),/Skill Status Summary/);assert.deepEqual(state.homeworkReports,before)});
test('I Weekly Report full-state purity','no shared growth/quality/publishability or order mutation',()=>{const state=appFor([trusted(),legacy()]),before=clone(state.homeworkReports);api.setApp(state);const out=api.weeklyReportHTML();assert.match(out,/已驗證功課分析：1/);assert.deepEqual(state.homeworkReports,before)});
test('J v74GrowthStats purity','actual preparation returns trusted local output without source mutation',()=>{const state=appFor([trusted(),legacy()]),before=clone(state.homeworkReports);api.setApp(state);const st=api.v74GrowthStats();assert.equal(st.trustedReportCount,1);assert.equal(st.excludedReportCount,1);assert.deepEqual(state.homeworkReports,before)});
test('K v74AllHomeworkReports purity','returned reports are usable independent views',()=>{const state=appFor([trusted()]),before=clone(state.homeworkReports);api.setApp(state);const all=api.v74AllHomeworkReports();assert.equal(all[0].eligibility.trusted,true);assert.notEqual(all[0].record,state.homeworkReports[0]);assert.notEqual(all[0].report,state.homeworkReports[0].report);assert.deepEqual(state.homeworkReports,before)});
test('L Nested-reference independence','all protected nested structures are independent',()=>{const r=trusted(),view=api.vRCBPrepareHomeworkReportView(r,'',1).report;for(const key of ['engineV2','canonicalEvidence','evidenceAuthority','processing','growth','quality','reportQuality','pages'])if(r[key]&&view[key])assert.notEqual(view[key],r[key],key);assert.notEqual(view.engineV2.evidence,r.engineV2.evidence);view.engineV2.evidence[0].question='changed';view.metadata.nested.value=9;assert.notEqual(r.engineV2.evidence[0].question,'changed');assert.equal(r.metadata.nested.value,1)});
test('M Repeated Report Detail','identical output and source across five renders',()=>{const r=trusted(),before=clone(r),outs=Array.from({length:5},()=>api.homeworkReportHTML(r,{}));assert.equal(new Set(outs).size,1);assert.deepEqual(r,before)});
test('N Repeated Analytics','identical metrics/limitations without duplicate trends',()=>{const state=appFor([trusted(),legacy()]),before=api.setApp(state)||api.serialize(),outs=Array.from({length:5},()=>api.v79SkillTrendDashboardHTML());assert.equal(new Set(outs).size,1);assert.equal(api.serialize(),before)});
test('O Repeated Weekly Report','identical output without accumulated metadata',()=>{const state=appFor([trusted(),legacy()]);api.setApp(state);const before=api.serialize(),outs=Array.from({length:5},()=>api.weeklyReportHTML());assert.equal(new Set(outs).size,1);assert.equal(api.serialize(),before)});
test('P Cross-view order independence','all four navigation sequences preserve identical state and view semantics',()=>{const sequences=[['a','w','d'],['d','w','a'],['w','a','d'],[...Array(5).fill('a'),...Array(5).fill('w'),...Array(5).fill('d')]];let reference;for(const seq of sequences){const report=trusted(),state=appFor([report,legacy()]);api.setApp(state);const before=api.serialize(),outputs=[];for(const x of seq)outputs.push(x==='a'?api.v79SkillTrendDashboardHTML():x==='w'?api.weeklyReportHTML():api.homeworkReportHTML(report,{}));assert.equal(api.serialize(),before);const snapshot={a:api.v79SkillTrendDashboardHTML(),w:api.weeklyReportHTML(),d:api.homeworkReportHTML(report,{})};if(reference)assert.deepEqual(snapshot,reference);else reference=snapshot}});
test('Q Later-save simulation','save serialization before/after is byte-identical',()=>{const report=trusted(),state=appFor([report,legacy()]);api.setApp(state);const before=api.serialize();api.homeworkReportHTML(report,{});api.renderAnalytics();api.weeklyReportHTML();assert.equal(api.serialize(),before)});
test('R No render-time persistence','zero save/storage/cache/history writes',()=>{const report=trusted();api.setApp(appFor([report]));api.reset();api.homeworkReportHTML(report,{});api.renderAnalytics();api.weeklyReportHTML();assert.deepEqual(clone(api.counters()),{save:0,storage:0,cache:0,history:0,builder:0})});
test('S Trusted prose independence','factual outputs are invariant under prose-only changes',()=>{const a=trusted(),b=clone(a);Object.assign(b,{summary:'changed',reasons:['changed'],strengths:['changed'],checkPoints:['changed'],parentInterpretation:'changed',rawAnalysis:'changed'});assert.equal(factual(api.homeworkReportHTML(a,{})),factual(api.homeworkReportHTML(b,{})));assert.deepEqual(clone(api.v79MergeSkillTrends([a])),clone(api.v79MergeSkillTrends([b])));api.setApp(appFor([a]));const wa=api.weeklyReportHTML();api.setApp(appFor([b]));assert.equal(api.weeklyReportHTML(),wa)});
test('T Individual no-data HTML states','all eight production HTML states are neutral and fact-free',()=>{const states=[[legacy()],[{}],[invalid()],[failed()],[emptyCanonical()],[emptyEngine()],[unknown()],[legacy(),invalid(),failed()]];for(const reports of states){for(const r of reports){const before=clone(r);assertUnavailable(api.homeworkReportHTML(r,{}));assert.deepEqual(r,before)}api.setApp(appFor(reports));assertUnavailable(api.v79SkillTrendDashboardHTML());const weekly=api.weeklyReportHTML();assertUnavailable(weekly);assert.doesNotMatch(weekly,/readiness/i);api.renderAnalytics();assert.doesNotMatch(api.html(),/Growth Memory \/100|Engine readiness/i)}});
test('U Mixed history','trusted complete/partial only with both limitations and no source mutation',()=>{const reports=[trusted(),partial(),legacy(),invalid(),failed(),emptyEngine()],state=appFor(reports),before=clone(state.homeworkReports);api.setApp(state);const st=api.v74GrowthStats(),out=api.weeklyReportHTML();assert.equal(st.trustedReportCount,2);assert.equal(st.partialReportCount,1);assert.equal(st.excludedReportCount,4);assert.match(out,/Only successfully processed work is included/);assert.match(out,/could not be verified/);assert.deepEqual(state.homeworkReports,before)});
test('V contentCoverage integrity','coverage remains unverified and limitation makes no completeness claim',()=>{const r=trusted(),before=clone(r),out=api.homeworkReportHTML(r,{});assert.equal(r.contentCoverage,'unverified');assert.match(out,/not confirmed that every question/);assert.doesNotMatch(out,/every question was captured[^.]*confirmed/i);assert.deepEqual(r,before)});
test('W Residual prose-builder instrumentation','zero calls from every protected view and state',()=>{const reports=[trusted(),legacy(),{},invalid(),partial(),failed(),unknown()];api.reset();for(const r of reports)api.homeworkReportHTML(r,{});api.setApp(appFor(reports));api.renderAnalytics();api.weeklyReportHTML();assert.equal(api.counters().builder,0);assert.equal([...html.matchAll(/v79BuildEngineFromReport\s*\(/g)].length,1)});
test('X Runtime declaration alignment','browser and tests select the same later v79SkillTrend declaration',()=>{const declarations=[...html.matchAll(/function v79SkillTrend\(evidence\)/g)];assert.equal(declarations.length,2);assert.match(api.trend.toString(),/Observed Strong/);assert.doesNotMatch(api.trend.toString(),/Generally Strong/)});
test('Y Commit 1 regression','SHA-256 vector and QA-068 16-row authority fixture pass',()=>{assert.equal(server.sha256Hex('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');const counts=[4,3,2,2,3,2],reports=counts.map((n,i)=>trusted('lineage_commit3_qa068001',Array.from({length:n},(_,j)=>row(i*10+j+1)),i,6));assert.equal(reports.flatMap(x=>x.canonicalEvidence).length,16);assert.equal(new Set(reports.flatMap(x=>x.canonicalEvidence).map(x=>x.sourceRowId)).size,16)});
test('Z Commit 2 regression','all 15 Commit 2 assertions pass',()=>{const r=JSON.parse(execFileSync(process.execPath,[path.join(__dirname,'rc-b-commit2.assertions.js')],{encoding:'utf8'}));assert.deepEqual({passed:r.passed,failed:r.failed},{passed:15,failed:0})});
test('AA Commit 2.5 regression','all 21 Commit 2.5 assertions pass',()=>{const r=JSON.parse(execFileSync(process.execPath,[path.join(__dirname,'rc-b-commit2-5.assertions.js')],{encoding:'utf8'}));assert.deepEqual({passed:r.passed,failed:r.failed},{passed:21,failed:0})});
test('AB Client syntax and global safety','all scripts parse and expected duplicate order remains stable',()=>{const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]);assert(scripts.length);scripts.forEach(x=>new Function(x));assert.equal(typeof api.homeworkReportHTML,'function');assert.equal(typeof api.weeklyReportHTML,'function');assert.equal([...html.matchAll(/function v79SkillTrend\(evidence\)/g)].length,2)});

process.stdout.write(JSON.stringify({passed:results.length,failed:0,results},null,2)+'\n');
