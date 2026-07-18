'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const server=require(path.join(root,'netlify/functions/analyze-homework.js')).__rcbTest;
const clone=value=>JSON.parse(JSON.stringify(value));

function section(start,end){
  const from=html.indexOf(start),to=html.indexOf(end,from);
  assert(from>=0&&to>from,`missing source section: ${start}`);
  return html.slice(from,to);
}
function secondFunctionSection(start,end){
  const starts=[...html.matchAll(new RegExp(start.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))].map(x=>x.index);
  assert(starts.length===2,`expected two declarations: ${start}`);
  const to=html.indexOf(end,starts[1]);
  assert(to>starts[1],`missing second declaration end: ${end}`);
  return html.slice(starts[1],to);
}

const clientSource=[
  section('function rcBSha256Hex','function v81MergeHomeworkReports'),
  section('function v79SkillTrendHTML','function v78ChoiceStatus'),
  secondFunctionSection('function v79SkillTrend(evidence)','function v82ReadingRows'),
  `var builderCallCount=0;
   function v79BuildEngineFromReport(){builderCallCount++;return {evidence:[{question:'fabricated',status:'wrong',skill:'Fabricated'}]}}
   function v82CleanEvidence(rows){return (rows||[]).slice()}
   function v79SkillInterpretation(row){return row.status}
   function v79StatusClass(status){return status}
   function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
   var app={homeworkReports:[],emotions:[],teacherComments:[]};
   this.rcB25={v79AnalyticsEligibility,v79MergeSkillTrends,v79SkillTrendDashboardHTML,validateServerEvidenceAuthorityV2,
     setApp(value){app=value},resetBuilder(){builderCallCount=0},builderCalls(){return builderCallCount}};`
].join('\n');

const context=vm.createContext({TextEncoder,JSON,Set,Map,Number,String,Array,Object,Math,RegExp});
vm.runInContext(clientSource,context,{filename:'index.html#rc-b-commit2-5'});
const api=context.rcB25;
const row=(n,status='correct')=>`Page: 1 | Q${n}: ${n} + 1 | Student: ${n+1} | Correct: ${n+1} | Status: ${status} | Skill: Addition`;
function makeReport(lineage='lineage_commit25_valid_01',rows=[row(1)],imageOrder=0,submittedImageCount=1){
  const report={extractedEvidence:rows,summary:'summary prose',strengths:['strength prose'],checkPoints:['checkpoint prose'],reasons:['reason prose'],parentInterpretation:'parent prose',rawAnalysis:'raw prose'};
  return server.applyCanonicalEvidenceAuthorityV2(report,{reportLineageId:lineage,imageOrder,submittedImageCount,validationErrors:[]});
}
function makePartial(){
  const report=makeReport('lineage_commit25_partial1',[row(1),row(2,'wrong')],0,2);
  report.processing={processingCoverage:'partial',submittedImageCount:2,attemptedRequestCount:2,successfulResponseCount:1,acceptedResponseCount:1,failedResponseCount:1,includedResponseCount:1,perImage:[
    {imageOrder:0,status:'accepted',includedInMerge:true,canonicalRowCount:2,blockingErrorCode:null},
    {imageOrder:1,status:'failed',includedInMerge:false,canonicalRowCount:0,blockingErrorCode:'REQUEST_FAILED'}
  ]};
  return report;
}
function legacy(){return {summary:'Q: fabricated | Student: 9 | Correct: 1 | Status: wrong | Skill: Algebra',strengths:['fabricated correct skill'],checkPoints:['fabricated wrong skill'],reasons:['fabricated'],parentInterpretation:'fabricated',rawAnalysis:'fabricated',engineV2:{version:'v2.1',evidence:[{question:'fabricated',status:'wrong',skill:'Algebra'}]}}}
function invalidFingerprint(){const report=makeReport('lineage_commit25_bad_fp01');report.evidenceAuthority.canonicalEvidenceFingerprint='0'.repeat(64);return report}
function analytics(reports){api.resetBuilder();return api.v79MergeSkillTrends(reports)}

const results=[];
function test(name,fn){fn();results.push({name,status:'PASS'})}

test('A trusted report contributes',()=>{
  const report=makeReport('lineage_commit25_metrics1',[row(1),row(2,'wrong'),row(3,'review')]);
  const result=analytics([report]);assert.equal(result.trustedReportCount,1);assert.deepEqual(clone(result.evidenceTotals),{total:3,correct:1,wrong:1,unclear:1});assert.equal(result.trends.length,1);api.setApp({homeworkReports:[{report}],emotions:[],teacherComments:[]});assert.match(api.v79SkillTrendDashboardHTML(),/Skill Status Summary/);assert.equal(api.builderCalls(),0);
});
test('B legacy report excluded',()=>{const result=analytics([legacy()]);assert.equal(result.evidenceTotals.total,0);assert.equal(result.trends.length,0);assert.equal(result.excludedByState.legacy,1);assert.equal(api.builderCalls(),0)});
test('C missing authority excluded',()=>{const result=analytics([{}]);assert.equal(result.evidenceTotals.total,0);assert.equal(result.excludedByState.missing,1);assert.equal(api.builderCalls(),0)});
test('D invalid fingerprint excluded',()=>{const result=analytics([invalidFingerprint()]);assert.equal(result.evidenceTotals.total,0);assert.equal(result.excludedByState.invalid,1);assert.equal(api.builderCalls(),0)});
test('E count mismatch excluded',()=>{const report=makeReport('lineage_commit25_count01');report.evidenceAuthority.canonicalEvidenceCount++;const result=analytics([report]);assert.equal(result.evidenceTotals.total,0);assert.equal(result.excludedReportCount,1);assert.equal(api.builderCalls(),0)});
test('F lineage mismatch excluded',()=>{const report=makeReport('lineage_commit25_lineage1');report.canonicalEvidence[0].reportLineageId='lineage_commit25_other01';const result=analytics([report]);assert.equal(result.evidenceTotals.total,0);assert.equal(result.excludedReportCount,1);assert.equal(api.builderCalls(),0)});
test('G empty canonical evidence excluded',()=>{const result=analytics([makeReport('lineage_commit25_emptycan1',[])]);assert.equal(result.evidenceTotals.total,0);assert.equal(result.trends.length,0);assert.equal(api.builderCalls(),0)});
test('H empty engine evidence excluded',()=>{const report=makeReport('lineage_commit25_emptyeng1');report.engineV2.evidence=[];const result=analytics([report]);assert.equal(result.evidenceTotals.total,0);assert.equal(result.trends.length,0);assert.equal(api.builderCalls(),0)});
test('I failed processing excluded',()=>{const report=makeReport('lineage_commit25_failed01');report.processing={processingCoverage:'failed',submittedImageCount:1,attemptedRequestCount:1,successfulResponseCount:0,acceptedResponseCount:0,failedResponseCount:1,includedResponseCount:0,perImage:[{imageOrder:0,status:'failed',includedInMerge:false,canonicalRowCount:0,blockingErrorCode:'REQUEST_FAILED'}]};const result=analytics([report]);assert.equal(result.evidenceTotals.total,0);assert.equal(result.excludedByState.failed,1);api.setApp({homeworkReports:[{report}],emotions:[],teacherComments:[]});assert.match(api.v79SkillTrendDashboardHTML(),/could not be analysed/);assert.equal(api.builderCalls(),0)});
test('J partial trusted processing included with limitation',()=>{const report=makePartial(),result=analytics([report]);assert.equal(result.trustedReportCount,1);assert.equal(result.partialReportCount,1);assert.equal(result.hasPartialData,true);assert.equal(result.contentCoverage,'unverified');assert.equal(result.evidenceTotals.total,2);api.setApp({homeworkReports:[{report}],emotions:[],teacherComments:[]});assert.match(api.v79SkillTrendDashboardHTML(),/Only successfully processed work is included/);assert.equal(api.builderCalls(),0)});
test('K mixed trusted and untrusted set',()=>{const trusted=makeReport('lineage_commit25_mixed001',[row(1),row(2,'wrong')]),result=analytics([trusted,legacy(),invalidFingerprint()]);assert.equal(result.trustedReportCount,1);assert.equal(result.excludedReportCount,2);assert.deepEqual(clone(result.evidenceTotals),{total:2,correct:1,wrong:1,unclear:0});assert.equal(result.hasExcludedData,true);assert.equal(api.builderCalls(),0)});
test('L trusted prose independence',()=>{const a=makeReport('lineage_commit25_prose001',[row(1),row(2,'wrong')]),b=clone(a);b.summary='changed';b.reasons=['changed'];b.strengths=['changed'];b.checkPoints=['changed'];b.parentInterpretation='changed';b.rawAnalysis='changed';const one=analytics([a]),two=analytics([b]);assert.deepEqual(two,one);assert.equal(api.builderCalls(),0)});
test('M legacy prose mutation independence',()=>{const a=legacy(),b=legacy();b.summary+=' '.repeat(10)+'Q: more fabricated evidence';b.rawAnalysis='wrong '.repeat(100);assert.deepEqual(analytics([a]).evidenceTotals,analytics([b]).evidenceTotals);assert.equal(api.builderCalls(),0)});
test('N engine truthiness is insufficient',()=>{const report=legacy();report.engineV2={version:'v3',authority:'structured_evidence',evidence:[{question:'truthy fake',status:'wrong',skill:'Fake'}]};const result=analytics([report]);assert.equal(result.trustedReportCount,0);assert.equal(result.evidenceTotals.total,0);assert.equal(api.builderCalls(),0)});
test('O repeated calculation is deterministic and non-mutating',()=>{const report=makeReport('lineage_commit25_repeat01',[row(1),row(2,'wrong')]),before=JSON.stringify(report),a=analytics([report]),b=analytics([report]);assert.deepEqual(b,a);assert.equal(JSON.stringify(report),before);assert.equal(new Set(a.trends.map(x=>x.skill+'|'+x.subSkill)).size,a.trends.length);assert.equal(api.builderCalls(),0)});
test('P parent-facing no-data state',()=>{const reports=[{report:legacy()},{report:invalidFingerprint()}],before=JSON.stringify(reports);api.setApp({homeworkReports:reports,emotions:[],teacherComments:[]});api.resetBuilder();const output=api.v79SkillTrendDashboardHTML();assert.match(output,/Verified learning insights are not available yet/);assert.doesNotMatch(output,/engineMiniGrid|0 wrong|0 needs attention|100% ready/);assert.equal(JSON.stringify(reports),before);assert.equal(api.builderCalls(),0)});
test('Q parent-facing mixed-data state',()=>{api.setApp({homeworkReports:[{report:makeReport('lineage_commit25_ui_mixed')},{report:legacy()}],emotions:[],teacherComments:[]});api.resetBuilder();const output=api.v79SkillTrendDashboardHTML();assert.match(output,/Some earlier reports could not be verified/);assert.match(output,/Skill Status Summary/);assert.equal(api.builderCalls(),0)});
test('R builder unreachable from Analytics',()=>{const callSites=[...html.matchAll(/v79BuildEngineFromReport\s*\(/g)].length,dashboardSource=section('function v79SkillTrendDashboardHTML','function v78ChoiceStatus');assert.equal(callSites,1,'only the function declaration may remain');assert.doesNotMatch(dashboardSource,/v74EnrichHomeworkReport|v79BuildEngineFromReport/);analytics([makeReport(),legacy(),invalidFingerprint()]);api.setApp({homeworkReports:[{report:legacy()}],emotions:[],teacherComments:[]});api.v79SkillTrendDashboardHTML();assert.equal(api.builderCalls(),0)});
test('S Commit 1 regression',()=>{assert.equal(server.sha256Hex('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');const counts=[4,3,2,2,3,2],reports=counts.map((n,i)=>makeReport('lineage_commit25_qa06801',Array.from({length:n},(_,j)=>row(i*10+j+1)),i,6));assert.equal(reports.flatMap(x=>x.canonicalEvidence).length,16);assert.equal(reports.flatMap(x=>x.engineV2.evidence).length,16);assert.equal(new Set(reports.flatMap(x=>x.canonicalEvidence).map(x=>x.sourceRowId)).size,16)});
test('T Commit 2 regression',()=>{const output=execFileSync(process.execPath,[path.join(__dirname,'rc-b-commit2.assertions.js')],{encoding:'utf8'}),result=JSON.parse(output);assert.equal(result.passed,15);assert.equal(result.failed,0)});
test('U client syntax',()=>{const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]);assert(scripts.length>0);scripts.forEach(source=>new Function(source));assert.equal(typeof api.v79MergeSkillTrends,'function')});

process.stdout.write(JSON.stringify({passed:results.length,failed:0,results},null,2)+'\n');
