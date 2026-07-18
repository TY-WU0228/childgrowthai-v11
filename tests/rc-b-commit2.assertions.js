'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const server = require(path.join(root, 'netlify/functions/analyze-homework.js')).__rcbTest;

function section(start, end) {
  const from = html.indexOf(start);
  const to = html.indexOf(end, from);
  assert(from >= 0 && to > from, `missing source section: ${start}`);
  return html.slice(from, to);
}

const clientSource = [
  section('function v81UniqueLines', 'function rcBCreateReportLineageId'),
  section('function rcBSha256Hex', 'function v81MergeHomeworkReports'),
  section('function v81MergeHomeworkReports', 'function v83IsTimeoutError'),
  `function v70SanitizeHomeworkReport(r){return r||{}}
   function v76HardGuardHomeworkReport(r){return r||{}}
   function v74TextOfReport(r){return [r.summary,...(r.strengths||[]),...(r.checkPoints||[]),...(r.reasons||[]),r.parentInterpretation,r.rawAnalysis].filter(Boolean).join(' ')}
   function v74DetectSkillsFromText(){return ['PROSE_SKILL']}
   function v74DetectErrorTypes(){return ['PROSE_ERROR']}
   function v74DetectConfidence(){return 'High'}
   function v74QualityScore(){return 100}
   function v74DetectSubject(){return 'Maths'}
   function v74DetectWorksheetLevel(){return 'Year 2'}
   function v80IsGenericTag(){return false}
   function v80QualityScore(){return 100}
   function v96VisibleRows(r){return (r.engineV2?.evidence||[]).filter(e=>e.status!=='correct')}
   function v82CleanEvidence(rows){return (rows||[]).slice()}
   function v96StableCount(r){return (r.engineV2?.evidence||[]).filter(e=>e.status==='correct').length}
   function v96DisplayStatus(e){return e.status==='correct'?'ok':e.status==='wrong'?'wrong':e.status==='missing'?'missing':'review'}
   function v9611SkillsFromEvidence(){return {strong:[],review:[]}}
   function v96QType(){return 'arith'}
   function v96CleanParentQuestion(x){return String(x||'')}
   function v9615PickTonightRow(rows){return rows[0]||null}
   function v92ChildLabel(){return 'Child'}
   function v9610EvidenceSignature(e){return e.sourceRowId||''}
   function v967HashString(x){return String(x).length.toString(16)}
   const app={profile:{year:'2'}};`,
  section('function v74EnrichHomeworkReport', 'function v74TagHTML'),
  `const _v9611Cache=new WeakMap();`,
  section('function v9611NormalizedReport', '// V96.11: get counts'),
  `this.rcBApi={validateServerEvidenceAuthorityV2,v74EnrichHomeworkReport,v81MergeHomeworkReports,v9611NormalizedReport,rcBSha256Hex};`
].join('\n');

const context = vm.createContext({TextEncoder, JSON, Set, Map, Number, String, Array, Object, Math, RegExp});
vm.runInContext(clientSource, context, {filename:'index.html#rc-b-commit2'});
const api = context.rcBApi;
const clone = value => JSON.parse(JSON.stringify(value));
const row = (n, status='correct') => `Page: 1 | Q${n}: ${n} + 1 | Student: ${n+1} | Correct: ${n+1} | Status: ${status} | Skill: Addition`;
const makeReport = (lineage, imageOrder=0, submittedImageCount=1, rows=[row(1)]) => {
  const report={extractedEvidence:rows,summary:'prose summary',strengths:['prose strength'],checkPoints:['prose checkpoint'],reasons:['prose reason'],parentInterpretation:'prose parent',rawAnalysis:'prose raw'};
  return server.applyCanonicalEvidenceAuthorityV2(report,{reportLineageId:lineage,imageOrder,submittedImageCount,validationErrors:[]});
};
const processing = (submitted, acceptedOrders, failedOrders=[]) => {
  const accepted=new Set(acceptedOrders), failed=new Set(failedOrders);
  const p={processingCoverage:'unknown',submittedImageCount:submitted,attemptedRequestCount:submitted,successfulResponseCount:accepted.size,acceptedResponseCount:accepted.size,failedResponseCount:failed.size,includedResponseCount:accepted.size,perImage:[]};
  for(let i=0;i<submitted;i++) p.perImage.push(accepted.has(i)?{imageOrder:i,status:'accepted',includedInMerge:true,canonicalRowCount:1,blockingErrorCode:null}:{imageOrder:i,status:'failed',includedInMerge:false,canonicalRowCount:0,blockingErrorCode:'REQUEST_FAILED'});
  p.processingCoverage=server.deriveProcessingCoverageV2(p);
  return p;
};
const wrap = report => {
  const snapshot={...clone(report),imageOrder:report.evidenceAuthority.imageOrder};
  return {...clone(report),rcBServerAuthority:snapshot};
};
const results=[];
function test(name, fn){fn();results.push({name,status:'PASS'});}

test('A valid server authority preservation',()=>{
  const report=makeReport('lineage_commit2_valid_0001');
  const engine=report.engineV2, canonical=clone(report.canonicalEvidence), fingerprints=[report.evidenceAuthority.sourceEvidenceFingerprint,report.evidenceAuthority.canonicalEvidenceFingerprint];
  const beforeValidation=JSON.stringify(report);
  assert.equal(api.validateServerEvidenceAuthorityV2(report).trusted,true);
  assert.equal(JSON.stringify(report),beforeValidation);
  api.v74EnrichHomeworkReport(report);
  assert.equal(report.engineV2,engine);
  assert.deepEqual(report.canonicalEvidence,canonical);
  assert.deepEqual([report.evidenceAuthority.sourceEvidenceFingerprint,report.evidenceAuthority.canonicalEvidenceFingerprint],fingerprints);
  const beforeNormalization=JSON.stringify(report), normalized=api.v9611NormalizedReport(report);
  assert.equal(normalized.authorityValidation.trusted,true);assert.equal(JSON.stringify(report),beforeNormalization);
});

test('B mere engine presence is insufficient',()=>{
  const report={summary:'legacy prose',engineV2:{version:'v3',authority:'structured_evidence',evidence:[]}};
  const result=api.validateServerEvidenceAuthorityV2(report);
  assert.equal(result.trusted,false);assert.equal(result.authorityState,'legacy');
  api.v74EnrichHomeworkReport(report);assert.equal(report.engineV2,null);assert.notEqual(report.legacyEngineV2,undefined);
});

test('C fingerprint mismatch',()=>{
  const report=makeReport('lineage_commit2_fingerprint');report.evidenceAuthority.canonicalEvidenceFingerprint='0'.repeat(64);
  const result=api.validateServerEvidenceAuthorityV2(report);assert.equal(result.trusted,false);assert(result.blockingErrors.includes('AUTHORITY_FINGERPRINT_MISMATCH'));
  api.v74EnrichHomeworkReport(report);assert.equal(report.publishable,false);assert.equal(report.engineV2,null);
});

test('D count mismatch',()=>{
  const report=makeReport('lineage_commit2_count_0001');report.evidenceAuthority.canonicalEvidenceCount++;
  const result=api.validateServerEvidenceAuthorityV2(report);assert.equal(result.trusted,false);assert(result.blockingErrors.includes('CANONICAL_COUNT_MISMATCH'));
});

test('E missing row binding',()=>{
  const report=makeReport('lineage_commit2_binding_01');delete report.engineV2.evidence[0].sourceRowId;
  const result=api.validateServerEvidenceAuthorityV2(report);assert.equal(result.trusted,false);assert(result.blockingErrors.includes('ENGINE_SOURCE_ROW_BINDING_MISSING'));
});

test('F duplicate row binding',()=>{
  const report=makeReport('lineage_commit2_duplicate1',0,1,[row(1),row(2)]);
  report.canonicalEvidence[1].sourceRowId=report.canonicalEvidence[0].sourceRowId;
  report.engineV2.evidence[1].sourceRowId=report.engineV2.evidence[0].sourceRowId;
  const result=api.validateServerEvidenceAuthorityV2(report);assert.equal(result.trusted,false);assert(result.blockingErrors.includes('CANONICAL_SOURCE_ROW_BINDING_DUPLICATE'));assert(result.blockingErrors.includes('ENGINE_SOURCE_ROW_BINDING_DUPLICATE'));
});

test('G lineage mismatch',()=>{
  const report=makeReport('lineage_commit2_original1');report.canonicalEvidence[0].reportLineageId='lineage_commit2_different';
  const result=api.validateServerEvidenceAuthorityV2(report);assert.equal(result.trusted,false);assert(result.blockingErrors.includes('LINEAGE_MISMATCH'));
});

test('H prose mutation cannot change trusted authority',()=>{
  const report=makeReport('lineage_commit2_prose_0001'), engine=report.engineV2, canonical=clone(report.canonicalEvidence), hashes=clone(report.evidenceAuthority);
  ['summary','parentInterpretation','rawAnalysis'].forEach(key=>report[key]='completely different prose');report.reasons=['different'];report.strengths=['different'];report.checkPoints=['different'];
  assert.equal(api.validateServerEvidenceAuthorityV2(report).trusted,true);api.v74EnrichHomeworkReport(report);
  assert.equal(report.engineV2,engine);assert.deepEqual(report.canonicalEvidence,canonical);assert.deepEqual(report.evidenceAuthority,hashes);
});

test('I legacy report fails closed and is preserved separately',()=>{
  const report={summary:'legacy prose',rawAnalysis:'legacy raw',engineV2:{version:'v2.1',evidence:[{question:'invented'}]}};
  api.v74EnrichHomeworkReport(report);assert.equal(report.authorityState,'legacy');assert.equal(report.publishable,false);assert.equal(report.engineV2,null);assert.equal(report.legacyEngineV2.evidence[0].question,'invented');
});

test('J merge preservation',()=>{
  const lineage='lineage_commit2_merge_0001', a=makeReport(lineage,0,2,[row(1)]), b=makeReport(lineage,1,2,[row(2)]), p=processing(2,[0,1]);
  const expected=[...a.canonicalEvidence,...b.canonicalEvidence], merged=api.v81MergeHomeworkReports([wrap(a),wrap(b)],2,{reportLineageId:lineage,processing:p});
  const validation=api.validateServerEvidenceAuthorityV2(merged);
  assert.equal(validation.trusted,true,JSON.stringify(validation));assert.deepEqual(merged.canonicalEvidence,expected);assert.deepEqual(merged.engineV2.evidence,[...a.engineV2.evidence,...b.engineV2.evidence]);
});

test('K merge lineage disagreement',()=>{
  const a=makeReport('lineage_commit2_merge_a001',0,2), b=makeReport('lineage_commit2_merge_b001',1,2), p=processing(2,[0,1]);
  const merged=api.v81MergeHomeworkReports([wrap(a),wrap(b)],2,{reportLineageId:a.reportLineageId,processing:p});
  assert.equal(merged.authorityValidation.trusted,false);assert.equal(merged.engineV2,null);assert(merged.evidenceAuthority.validationErrors.some(x=>x.code==='LINEAGE_MISMATCH'));
});

test('L partial processing remains partial and trusted only for included rows',()=>{
  const lineage='lineage_commit2_partial_001', a=makeReport(lineage,0,2), p=processing(2,[0],[1]);
  const merged=api.v81MergeHomeworkReports([wrap(a)],2,{reportLineageId:lineage,processing:p});
  assert.equal(merged.processing.processingCoverage,'partial');assert.equal(merged.authorityValidation.trusted,true);assert.equal(merged.publishable,false);assert.equal(merged.contentCoverage,'unverified');
});

test('M empty canonical evidence fails closed',()=>{
  const report=makeReport('lineage_commit2_empty_0001',0,1,[]), result=api.validateServerEvidenceAuthorityV2(report);
  assert.equal(result.trusted,false);assert(result.blockingErrors.includes('CANONICAL_EVIDENCE_EMPTY'));api.v74EnrichHomeworkReport(report);assert.equal(report.publishable,false);assert.equal(report.engineV2,null);
});

test('N client scripts parse without collisions',()=>{
  const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]);assert(scripts.length>0);scripts.forEach(source=>new Function(source));
});

test('O Commit 1 canonical authority regression',()=>{
  assert.equal(server.sha256Hex('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(api.rcBSha256Hex('abc'),server.sha256Hex('abc'));
  ['功課','é','Page: 1 | Q1: 2 + 2'].forEach(value=>assert.equal(api.rcBSha256Hex(value),server.sha256Hex(value)));
  const valid=server.normalizeAuthorityRequestContext({reportLineageId:'lineage_commit1_regression',imageOrder:0,submittedImageCount:1});assert.deepEqual(valid.validationErrors,[]);
  const invalid=server.normalizeAuthorityRequestContext({});assert(invalid.validationErrors.length>=3);
  const canonical=server.canonicalizeExtractedEvidenceV2([row(1),row(2)],valid);assert.equal(canonical.validationErrors.length,0);assert.equal(canonical.canonicalEvidence.length,2);assert.notEqual(canonical.canonicalEvidence[0].sourceRowId,canonical.canonicalEvidence[1].sourceRowId);
  const report=makeReport('lineage_commit1_regression');assert.equal(report.engineV2.version,'v3');assert.equal(report.engineV2.evidence[0].sourceRowId,report.canonicalEvidence[0].sourceRowId);assert.equal(report.publishable,true);
  const lineage='lineage_commit1_qa068_rows', counts=[4,3,2,2,3,2], qaReports=counts.map((count,imageOrder)=>makeReport(lineage,imageOrder,6,Array.from({length:count},(_,i)=>row(imageOrder*10+i+1))));
  assert.equal(qaReports.flatMap(x=>x.extractedEvidence).length,16);assert.equal(qaReports.flatMap(x=>x.canonicalEvidence).length,16);assert.equal(qaReports.flatMap(x=>x.engineV2.evidence).length,16);
  assert.equal(new Set(qaReports.flatMap(x=>x.canonicalEvidence).map(x=>x.sourceRowId)).size,16);
  qaReports.forEach((r,imageOrder)=>r.canonicalEvidence.forEach((e,sourceRowIndex)=>{assert.equal(e.imageOrder,imageOrder);assert.equal(e.sourceRowIndex,sourceRowIndex);assert.equal(r.engineV2.evidence[sourceRowIndex].sourceRowId,e.sourceRowId);}));
  const proseA=makeReport('lineage_commit1_prose_independence'), proseB=clone(proseA);proseB.summary='changed';proseB.reasons=['changed'];proseB.strengths=['changed'];proseB.checkPoints=['changed'];proseB.parentInterpretation='changed';proseB.rawAnalysis='changed';
  assert.deepEqual(proseB.canonicalEvidence,proseA.canonicalEvidence);assert.deepEqual(proseB.evidenceAuthority,proseA.evidenceAuthority);assert.deepEqual(proseB.engineV2,proseA.engineV2);
  const empty=makeReport('lineage_commit1_empty_rows',0,1,[]);assert.equal(empty.canonicalEvidence.length,0);assert.equal(empty.engineV2.evidence.length,0);assert.equal(empty.publishable,false);assert(empty.evidenceAuthority.validationErrors.length>0);
  const duplicatePayload=row(7), duplicateA=makeReport('lineage_commit1_duplicate',0,2,[duplicatePayload]), duplicateB=makeReport('lineage_commit1_duplicate',1,2,[duplicatePayload]);assert.notEqual(duplicateA.canonicalEvidence[0].sourceRowId,duplicateB.canonicalEvidence[0].sourceRowId);assert.equal(duplicateA.canonicalEvidence[0].contentFingerprint,duplicateB.canonicalEvidence[0].contentFingerprint);
  const repeatA=server.canonicalizeExtractedEvidenceV2([row(1),row(2)],valid), repeatB=server.canonicalizeExtractedEvidenceV2([row(1),row(2)],valid);assert.deepEqual(repeatA,repeatB);
  const invalidRow=server.canonicalizeExtractedEvidenceV2(['Q1: 2 + 2 | Student: 4 | Correct: 4 | Status: correct'],valid);assert.equal(invalidRow.canonicalEvidence.length,0);assert(invalidRow.validationErrors.some(x=>x.code==='CANONICAL_PAGE_MISSING'));
  assert.equal(server.deriveProcessingCoverageV2(processing(2,[0],[1])),'partial');assert.equal(server.deriveProcessingCoverageV2(processing(2,[0,1])),'complete');
  assert.equal(server.deriveProcessingCoverageV2({submittedImageCount:2,acceptedResponseCount:0,includedResponseCount:0,failedResponseCount:2,perImage:[{status:'failed'},{status:'failed'}]}),'failed');assert.equal(server.deriveProcessingCoverageV2({}),'unknown');
});

process.stdout.write(JSON.stringify({passed:results.length,failed:0,results},null,2)+'\n');
