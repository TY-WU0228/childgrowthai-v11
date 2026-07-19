'use strict';

const assert = require('assert');
const { __rccTest: rcc } = require('../netlify/functions/rc-c-pilot.js');

function completeTrustedSelfReconciledBaseline() {
  return {
    contractVersion: 'rc-c-v1-frozen',
    schemaVersion: 1,
    reportLineageId: 'rcb-lineage-test-001',
    processingState: 'complete',
    evidenceAuthorityState: 'trusted',
    enumerationState: 'enumerated',
    pageTopologyState: 'resolved',
    sourceDomainAccountingState: 'accounted',
    reconciliationState: 'reconciliation_matched',
    coverageAssuranceLevel: 'self_reconciled',
    issuedAuthorityValidationState: 'valid',
    attemptStructureState: 'assessable_attempts',
    capacity: { result: 'compatible_and_sufficient' },
    lineageValid: true,
    fingerprintsValid: true,
    invariantsValid: true,
    blockingLimitations: [],
  };
}

function blankAssessableBaseline() {
  return {
    ...completeTrustedSelfReconciledBaseline(),
    attemptStructureState: 'blank_attempts',
    itemLedger: [],
  };
}

function storedPositiveRecomputedStaleBaseline() {
  return {
    ...completeTrustedSelfReconciledBaseline(),
    issuedAuthorityValidationState: 'stale',
    storedServerStructuralUseClass: 'trusted_self_reconciled',
  };
}

function partialPositiveAssuranceBaseline() {
  return {
    ...completeTrustedSelfReconciledBaseline(),
    processingState: 'partial',
    capacity: { result: 'compatible_and_sufficient_for_processed_scope_only' },
  };
}

function clientRejectedValidServerBaseline() {
  return {
    serverState: completeTrustedSelfReconciledBaseline(),
    localState: {
      clientLocalValidationResult: 'accepted',
      schemaSupported: true,
      payloadFresh: true,
      payloadIntegrityValid: true,
    },
  };
}

function unknownEnumBaseline() {
  return { ...completeTrustedSelfReconciledBaseline(), enumerationState: 'invented_positive_state' };
}

function missingRequiredFieldBaseline() {
  const state = completeTrustedSelfReconciledBaseline();
  delete state.sourceDomainAccountingState;
  return state;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertClass(state, expectedClass, expectedDiagnostic) {
  const result = rcc.deriveServerStructuralUseClassV1(state);
  assert.strictEqual(result.serverClass, expectedClass);
  if (expectedDiagnostic) assert(result.diagnostics.includes(expectedDiagnostic));
  return result;
}

function assertExactServerResultShape(result) {
  assert.deepStrictEqual(Object.keys(result).sort(), [
    'diagnostics',
    'effectiveCoverageAssuranceLevel',
    'serverClass',
  ].sort());
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('1 - frozen constants and exact exhaustive enums', () => {
  assert.deepStrictEqual(
    [rcc.RC_C_CONTRACT_VERSION, rcc.RC_C_SCHEMA_VERSION, rcc.RC_C_ENUMERATION_METHOD_VERSION,
      rcc.RC_C_QUALITY_THRESHOLD_VERSION, rcc.RC_C_GEOMETRY_TOLERANCE_VERSION, rcc.RC_C_AUTHORITY_ISSUER],
    ['rc-c-v1-frozen', 1, 'pilot_numbered_bands_v1', 'rc-c-pilot-quality-v1',
      'rc-c-pilot-geometry-v1', 'coverage-authority-service'],
  );
  assert.deepStrictEqual(rcc.ENUMS.processingState, ['complete', 'partial', 'failed']);
  assert.deepStrictEqual(rcc.ENUMS.evidenceAuthorityState, ['trusted', 'missing', 'invalid']);
  assert.deepStrictEqual(rcc.ENUMS.enumerationState, ['enumerated', 'unresolved', 'failed', 'invalid', 'stale']);
  assert.deepStrictEqual(rcc.ENUMS.pageTopologyState, ['resolved', 'unsupported', 'invalid', 'stale']);
  assert.deepStrictEqual(rcc.ENUMS.sourceDomainAccountingState, ['accounted', 'unresolved', 'invalid', 'stale']);
  assert.deepStrictEqual(rcc.ENUMS.reconciliationState,
    ['not_available', 'reconciliation_matched', 'reconciliation_no_assessable_content',
      'reconciliation_mismatched', 'reconciliation_review_required', 'invalid', 'stale']);
  assert.deepStrictEqual(rcc.ENUMS.coverageAssuranceLevel, ['unknown', 'self_reconciled']);
  assert.deepStrictEqual(rcc.ENUMS.issuedAuthorityValidationState, ['valid', 'invalid', 'stale', 'schema_unsupported']);
  assert.deepStrictEqual(rcc.ENUMS.attemptStructureState,
    ['assessable_attempts', 'blank_attempts', 'no_assessable_content', 'unknown']);
  assert.deepStrictEqual(rcc.ENUMS.serverStructuralUseClass,
    ['trusted_self_reconciled', 'trusted_observed_only', 'legacy_observed_only', 'review_required',
      'structural_unknown', 'structurally_invalid', 'evidence_invalid', 'processing_failed',
      'validation_stale', 'reconciliation_mismatched', 'no_assessable_content', 'blank_attempts']);
  assert.deepStrictEqual(rcc.ENUMS.clientLocalValidationResult, ['accepted', 'rejected', 'stale', 'unsupported']);
  assert.deepStrictEqual(rcc.ENUMS.localEffectiveUseClassKind,
    ['use_server_class', 'local_use_blocked', 'local_schema_unsupported', 'local_payload_stale']);
  assert.deepStrictEqual(rcc.ENUMS.attemptDisposition, ['answered', 'blank']);
  assert.deepStrictEqual(rcc.ENUMS.sourceLeafClass,
    ['assessable_candidate', 'non_assessable', 'background_whitespace', 'excluded_outer_margin',
      'unsupported', 'unresolved']);
  assert.deepStrictEqual(rcc.ENUMS.capacityResult,
    ['compatible_and_sufficient', 'compatible_and_sufficient_for_processed_scope_only', 'unknown', 'exceeded', 'incompatible']);
  assert(!rcc.ENUMS.serverStructuralUseClass.includes('local_use_blocked'));
  assert(!Object.prototype.hasOwnProperty.call(rcc.ENUMS, 'structuralNoAnswer' + 'Disposition'));
});

test('2 - required fields and every server enum fail closed', () => {
  assertClass(missingRequiredFieldBaseline(), 'structurally_invalid',
    'REQUIRED_RCC_SERVER_FIELD_MISSING:sourceDomainAccountingState');
  const enumFields = {
    processingState: 'processingState', evidenceAuthorityState: 'evidenceAuthorityState',
    enumerationState: 'enumerationState', pageTopologyState: 'pageTopologyState',
    sourceDomainAccountingState: 'sourceDomainAccountingState', reconciliationState: 'reconciliationState',
    coverageAssuranceLevel: 'coverageAssuranceLevel', issuedAuthorityValidationState: 'issuedAuthorityValidationState',
    attemptStructureState: 'attemptStructureState', capacityResult: 'capacity.result',
  };
  for (const [enumName, field] of Object.entries(enumFields)) {
    const state = completeTrustedSelfReconciledBaseline();
    if (field === 'capacity.result') state.capacity.result = `unknown_${enumName}`;
    else state[field] = `unknown_${enumName}`;
    assertClass(state, 'structurally_invalid', `UNKNOWN_RCC_SERVER_ENUM_VALUE:${field}`);
  }
});

test('3 - unsupported versions and authority invariants fail closed', () => {
  assertClass({ ...completeTrustedSelfReconciledBaseline(), contractVersion: 'future' },
    'structurally_invalid', 'RCC_CONTRACT_VERSION_UNSUPPORTED');
  assertClass({ ...completeTrustedSelfReconciledBaseline(), schemaVersion: 2 },
    'structurally_invalid', 'RCC_SCHEMA_VERSION_UNSUPPORTED');
  assertClass({ ...completeTrustedSelfReconciledBaseline(), lineageValid: false },
    'structurally_invalid', 'SERVER_LINEAGE_INVALID');
  assertClass({ ...completeTrustedSelfReconciledBaseline(), fingerprintsValid: false },
    'structurally_invalid', 'SERVER_FINGERPRINT_INVALID');
  assertClass({ ...completeTrustedSelfReconciledBaseline(), invariantsValid: false },
    'structurally_invalid', 'SERVER_INVARIANT_INVALID');
});

test('4 - issued validation states fail closed', () => {
  assertClass({ ...completeTrustedSelfReconciledBaseline(), issuedAuthorityValidationState: 'invalid' },
    'validation_stale', 'ISSUED_AUTHORITY_VALIDATION_INVALID');
  assertClass({ ...completeTrustedSelfReconciledBaseline(), issuedAuthorityValidationState: 'stale' },
    'validation_stale', 'ISSUED_AUTHORITY_VALIDATION_STALE');
  assertClass({ ...completeTrustedSelfReconciledBaseline(), issuedAuthorityValidationState: 'schema_unsupported' },
    'structurally_invalid', 'ISSUED_AUTHORITY_SCHEMA_UNSUPPORTED');
});

test('5 - missing or invalid evidence and failed processing are exact', () => {
  assertClass({ ...completeTrustedSelfReconciledBaseline(), evidenceAuthorityState: 'missing' },
    'evidence_invalid', 'EVIDENCE_AUTHORITY_MISSING');
  assertClass({ ...completeTrustedSelfReconciledBaseline(), evidenceAuthorityState: 'invalid' },
    'evidence_invalid', 'EVIDENCE_AUTHORITY_INVALID');
  assertClass({ ...completeTrustedSelfReconciledBaseline(), processingState: 'failed' },
    'processing_failed', 'PROCESSING_FAILED');
});

test('6 - invalid, stale, and failed structural stages are exact', () => {
  const cases = [
    ['enumerationState', 'failed', 'structurally_invalid', 'ENUMERATION_FAILED'],
    ['enumerationState', 'invalid', 'structurally_invalid', 'ENUMERATION_INVALID'],
    ['enumerationState', 'stale', 'validation_stale', 'ENUMERATION_STALE'],
    ['pageTopologyState', 'invalid', 'structurally_invalid', 'PAGE_TOPOLOGY_INVALID'],
    ['pageTopologyState', 'stale', 'validation_stale', 'PAGE_TOPOLOGY_STALE'],
    ['sourceDomainAccountingState', 'invalid', 'structurally_invalid', 'SOURCE_DOMAIN_ACCOUNTING_INVALID'],
    ['sourceDomainAccountingState', 'stale', 'validation_stale', 'SOURCE_DOMAIN_ACCOUNTING_STALE'],
    ['reconciliationState', 'invalid', 'structurally_invalid', 'RECONCILIATION_INVALID'],
    ['reconciliationState', 'stale', 'validation_stale', 'RECONCILIATION_STALE'],
  ];
  for (const [field, value, expected, diagnostic] of cases) {
    assertClass({ ...completeTrustedSelfReconciledBaseline(), [field]: value }, expected, diagnostic);
  }
});

test('7 - reconciliation mismatch and review required are exact', () => {
  assertClass({ ...completeTrustedSelfReconciledBaseline(), reconciliationState: 'reconciliation_mismatched' },
    'reconciliation_mismatched', 'RECONCILIATION_MISMATCHED');
  assertClass({ ...completeTrustedSelfReconciledBaseline(), reconciliationState: 'reconciliation_review_required' },
    'review_required', 'RECONCILIATION_REVIEW_REQUIRED');
});

test('8 - exact no-assessable-content emits no learning inference', () => {
  const state = {
    ...completeTrustedSelfReconciledBaseline(),
    attemptStructureState: 'no_assessable_content',
    reconciliationState: 'reconciliation_no_assessable_content',
    coverageAssuranceLevel: 'unknown',
  };
  assertClass(state, 'no_assessable_content');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(state, 'learningClaim'), false);
});

test('9 - blank attempts have no mismatch, fabricated row, or weakness claim', () => {
  const state = blankAssessableBaseline();
  const result = assertClass(state, 'blank_attempts');
  assert.deepStrictEqual(result, {
    serverClass: 'blank_attempts',
    diagnostics: [],
    effectiveCoverageAssuranceLevel: 'unknown',
  });
  assertExactServerResultShape(result);
  for (const key of [
    'correctnessClaim', 'weaknessClaim', 'evidenceRows', 'canonicalEvidence', 'itemLedger',
    'fabricatedEvidence', 'learningClaim', 'metadata', 'claimMetadata', 'parentClaim', 'completenessClaim',
  ]) assert.strictEqual(Object.prototype.hasOwnProperty.call(result, key), false, key);
  assert.throws(() => assertExactServerResultShape({ ...result, metadata: {} }), assert.AssertionError);
  const comparison = rcc.compareStoredAndRecomputedServerClassV1({ ...state, storedServerStructuralUseClass: result.serverClass });
  assert.strictEqual(comparison.authoritySnapshotValid, true);
  assert(!comparison.diagnostics.includes('SERVER_STRUCTURAL_USE_CLASS_MISMATCH'));
  assert.deepStrictEqual(state.itemLedger, []);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(state, 'fabricatedEvidence'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(state, 'weaknessClaim'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(state, 'correctnessClaim'), false);
});

test('10 - stored positive cannot override recomputed stale', () => {
  const comparison = rcc.compareStoredAndRecomputedServerClassV1(storedPositiveRecomputedStaleBaseline());
  assert.strictEqual(comparison.storedServerStructuralUseClass, 'trusted_self_reconciled');
  assert.strictEqual(comparison.recomputedServerStructuralUseClass, 'validation_stale');
  assert.strictEqual(comparison.effectiveServerStructuralUseClass, 'validation_stale');
  assert(comparison.diagnostics.includes('SERVER_STRUCTURAL_USE_CLASS_MISMATCH'));
  assert.strictEqual(comparison.authoritySnapshotValid, false);
  assert.strictEqual(comparison.storedPositiveUseProhibited, true);
});

test('11 - exact positive and legacy classes are exhaustively reachable', () => {
  assertClass(completeTrustedSelfReconciledBaseline(), 'trusted_self_reconciled');
  assertClass({ ...completeTrustedSelfReconciledBaseline(), coverageAssuranceLevel: 'unknown' }, 'trusted_observed_only');
  assertClass({
    ...completeTrustedSelfReconciledBaseline(),
    enumerationState: 'unresolved', pageTopologyState: 'unsupported', sourceDomainAccountingState: 'unresolved',
    reconciliationState: 'not_available', coverageAssuranceLevel: 'unknown', capacity: { result: 'unknown' },
  }, 'legacy_observed_only');
});

test('12 - recognized incomplete and terminal invalid paths do not become positive', () => {
  assertClass({
    ...completeTrustedSelfReconciledBaseline(), processingState: 'partial', coverageAssuranceLevel: 'unknown',
    capacity: { result: 'compatible_and_sufficient_for_processed_scope_only' },
  }, 'structural_unknown', 'STRUCTURE_RECOGNIZED_INCOMPLETE');
  assertClass({ ...completeTrustedSelfReconciledBaseline(), capacity: { result: 'exceeded' } },
    'structurally_invalid', 'TERMINAL_STRUCTURAL_INVARIANT_FAILURE');
  assertClass({ ...completeTrustedSelfReconciledBaseline(), capacity: { result: 'incompatible' } },
    'structurally_invalid', 'TERMINAL_STRUCTURAL_INVARIANT_FAILURE');
});

test('13 - local accepted use preserves positive and non-positive server classes', () => {
  const accepted = { clientLocalValidationResult: 'accepted', schemaSupported: true, payloadFresh: true, payloadIntegrityValid: true };
  const serverOnly = rcc.deriveServerStructuralUseClassV1(completeTrustedSelfReconciledBaseline());
  const serverWithAdversarialLocalFields = rcc.deriveServerStructuralUseClassV1({
    ...completeTrustedSelfReconciledBaseline(),
    clientLocalValidationResult: 'rejected',
    schemaSupported: false,
    payloadFresh: false,
    payloadIntegrityValid: false,
    browserState: { rejected: true },
  });
  assert.deepStrictEqual(serverWithAdversarialLocalFields, serverOnly);
  const comparisonWithLocalFields = rcc.compareStoredAndRecomputedServerClassV1({
    ...completeTrustedSelfReconciledBaseline(),
    storedServerStructuralUseClass: 'trusted_self_reconciled',
    clientLocalValidationResult: 'rejected',
  });
  assert.strictEqual(comparisonWithLocalFields.authoritySnapshotValid, true);
  assert(!comparisonWithLocalFields.diagnostics.includes('SERVER_STRUCTURAL_USE_CLASS_MISMATCH'));
  for (const serverClass of rcc.ENUMS.serverStructuralUseClass) {
    const result = rcc.deriveLocalEffectiveUseClassV1(serverClass, accepted);
    assert.deepStrictEqual(result.localEffectiveUseClass, { kind: 'use_server_class', serverClass });
  }
  assert.deepStrictEqual(
    rcc.deriveLocalEffectiveUseClassV1('structural_unknown', accepted).localEffectiveUseClass,
    { kind: 'use_server_class', serverClass: 'structural_unknown' },
  );
});

test('14 - local rejection, stale, unsupported, integrity, and unknown fail closed locally', () => {
  const base = { clientLocalValidationResult: 'accepted', schemaSupported: true, payloadFresh: true, payloadIntegrityValid: true };
  assert.strictEqual(rcc.deriveLocalEffectiveUseClassV1('trusted_self_reconciled', { ...base, clientLocalValidationResult: 'rejected' })
    .localEffectiveUseClass.kind, 'local_use_blocked');
  assert.strictEqual(rcc.deriveLocalEffectiveUseClassV1('trusted_self_reconciled', { ...base, payloadFresh: false })
    .localEffectiveUseClass.kind, 'local_payload_stale');
  assert.strictEqual(rcc.deriveLocalEffectiveUseClassV1('trusted_self_reconciled', { ...base, schemaSupported: false })
    .localEffectiveUseClass.kind, 'local_schema_unsupported');
  assert.strictEqual(rcc.deriveLocalEffectiveUseClassV1('trusted_self_reconciled', { ...base, payloadIntegrityValid: false })
    .localEffectiveUseClass.kind, 'local_use_blocked');
  assert.strictEqual(rcc.deriveLocalEffectiveUseClassV1('trusted_self_reconciled', { ...base, clientLocalValidationResult: 'invented' })
    .localEffectiveUseClass.kind, 'local_use_blocked');
});

test('15 - canonical serialization and fingerprint key order are stable', () => {
  assert.strictEqual(rcc.rccCanonicalSerialize({ z: 1, a: { y: 2, x: 3 } }),
    rcc.rccCanonicalSerialize({ a: { x: 3, y: 2 }, z: 1 }));
  const left = { ...completeTrustedSelfReconciledBaseline(), nested: { z: 1, a: 2 } };
  const right = { nested: { a: 2, z: 1 }, ...completeTrustedSelfReconciledBaseline() };
  assert.strictEqual(rcc.computeAuthoritySnapshotFingerprintV1(left), rcc.computeAuthoritySnapshotFingerprintV1(right));
  assert.match(rcc.computeAuthoritySnapshotFingerprintV1(left), /^[0-9a-f]{64}$/);
});

test('16 - covered changes tamper the fingerprint while local and issued-time changes do not', () => {
  const snapshot = completeTrustedSelfReconciledBaseline();
  const fingerprint = rcc.computeAuthoritySnapshotFingerprintV1(snapshot);
  const issued = {
    ...snapshot,
    authoritySnapshotFingerprint: fingerprint,
    authorityRevisionId: rcc.buildAuthorityRevisionIdV1(fingerprint),
  };
  assert.strictEqual(rcc.verifyAuthoritySnapshotFingerprintV1(issued), true);
  assert.strictEqual(rcc.verifyAuthoritySnapshotFingerprintV1({ ...issued, reportLineageId: 'tampered' }), false);
  assert.notStrictEqual(fingerprint, rcc.computeAuthoritySnapshotFingerprintV1({ ...snapshot, reportLineageId: 'changed' }));
  assert.strictEqual(fingerprint, rcc.computeAuthoritySnapshotFingerprintV1({
    ...snapshot, issuedAt: '2099-01-01T00:00:00.000Z', clientLocalValidationResult: 'rejected',
    schemaSupported: false, payloadFresh: false, payloadIntegrityValid: false,
    localState: { payloadFresh: false }, browserState: { displayBlocked: true },
  }));
  assert.strictEqual(rcc.buildAuthorityRevisionIdV1(fingerprint), `rccar_${fingerprint}`);
});

test('17 - RC-C-FR-003 client rejection cannot mutate or invalidate server authority', () => {
  const fixture = clientRejectedValidServerBaseline();
  const derived = rcc.deriveServerStructuralUseClassV1(fixture.serverState);
  assert.strictEqual(derived.serverClass, 'trusted_self_reconciled');
  const immutableServerSnapshot = {
    ...clone(fixture.serverState),
    storedServerStructuralUseClass: derived.serverClass,
  };
  immutableServerSnapshot.authoritySnapshotFingerprint = rcc.computeAuthoritySnapshotFingerprintV1(immutableServerSnapshot);
  immutableServerSnapshot.authorityRevisionId = rcc.buildAuthorityRevisionIdV1(immutableServerSnapshot.authoritySnapshotFingerprint);
  const serverBytesBefore = JSON.stringify(immutableServerSnapshot);
  const clonedServerBytes = JSON.stringify(JSON.parse(serverBytesBefore));
  assert.strictEqual(clonedServerBytes, serverBytesBefore);
  const fingerprintBefore = immutableServerSnapshot.authoritySnapshotFingerprint;

  const localState = { ...fixture.localState, clientLocalValidationResult: 'rejected' };
  const local = rcc.deriveLocalEffectiveUseClassV1(derived.serverClass, localState);
  const comparison = rcc.compareStoredAndRecomputedServerClassV1(immutableServerSnapshot);

  assert.strictEqual(local.localEffectiveUseClass.kind, 'local_use_blocked');
  assert(local.localDiagnostics.includes('CLIENT_LOCAL_VALIDATION_REJECTED'));
  assert(!comparison.diagnostics.includes('SERVER_STRUCTURAL_USE_CLASS_MISMATCH'));
  assert.strictEqual(comparison.authoritySnapshotValid, true);
  assert.strictEqual(JSON.stringify(immutableServerSnapshot), serverBytesBefore);
  assert.strictEqual(immutableServerSnapshot.authoritySnapshotFingerprint, fingerprintBefore);
  assert.strictEqual(rcc.verifyAuthoritySnapshotFingerprintV1(immutableServerSnapshot), true);
});

test('18 - partial processing with positive assurance is structurally invalid', () => {
  const result = assertClass(partialPositiveAssuranceBaseline(), 'structurally_invalid',
    'PARTIAL_PROCESSING_WITH_POSITIVE_ASSURANCE');
  assert.strictEqual(result.effectiveCoverageAssuranceLevel, 'unknown');
});

test('19 - blank and no-content cannot bypass incomplete or terminal structural states', () => {
  const terminalCases = [
    ['capacity unknown', { capacity: { result: 'unknown' } }, 'structural_unknown', 'STRUCTURE_RECOGNIZED_INCOMPLETE'],
    ['capacity exceeded', { capacity: { result: 'exceeded' } }, 'structurally_invalid', 'TERMINAL_STRUCTURAL_INVARIANT_FAILURE'],
    ['capacity incompatible', { capacity: { result: 'incompatible' } }, 'structurally_invalid', 'TERMINAL_STRUCTURAL_INVARIANT_FAILURE'],
    ['enumeration unresolved', { enumerationState: 'unresolved' }, 'structural_unknown', 'STRUCTURE_RECOGNIZED_INCOMPLETE'],
    ['topology unsupported', { pageTopologyState: 'unsupported' }, 'structural_unknown', 'STRUCTURE_RECOGNIZED_INCOMPLETE'],
    ['source accounting unresolved', { sourceDomainAccountingState: 'unresolved' }, 'structural_unknown', 'STRUCTURE_RECOGNIZED_INCOMPLETE'],
    ['reconciliation not available', { reconciliationState: 'not_available' }, 'structural_unknown', 'STRUCTURE_RECOGNIZED_INCOMPLETE'],
    ['reconciliation mismatched', { reconciliationState: 'reconciliation_mismatched' },
      'reconciliation_mismatched', 'RECONCILIATION_MISMATCHED'],
  ];
  for (const attemptStructureState of ['blank_attempts', 'no_assessable_content']) {
    for (const [name, patch, expectedClass, expectedDiagnostic] of terminalCases) {
      const state = {
        ...completeTrustedSelfReconciledBaseline(),
        coverageAssuranceLevel: 'unknown',
        attemptStructureState,
        reconciliationState: attemptStructureState === 'no_assessable_content'
          ? 'reconciliation_no_assessable_content' : 'reconciliation_matched',
        ...patch,
      };
      const result = rcc.deriveServerStructuralUseClassV1(state);
      assert.strictEqual(result.serverClass, expectedClass, `${attemptStructureState} + ${name}`);
      assert.deepStrictEqual(result.diagnostics, [expectedDiagnostic], `${attemptStructureState} + ${name}`);
      assert.strictEqual(result.effectiveCoverageAssuranceLevel, 'unknown', `${attemptStructureState} + ${name}`);
      assert(!['trusted_self_reconciled', 'trusted_observed_only', 'legacy_observed_only'].includes(result.serverClass));
      assert.notStrictEqual(result.serverClass, attemptStructureState, `${attemptStructureState} + ${name}`);
    }
  }
  assertClass({ ...blankAssessableBaseline(), coverageAssuranceLevel: 'unknown' }, 'blank_attempts');
  assertClass({
    ...completeTrustedSelfReconciledBaseline(),
    attemptStructureState: 'no_assessable_content',
    reconciliationState: 'reconciliation_no_assessable_content',
    coverageAssuranceLevel: 'unknown',
  }, 'no_assessable_content');
});

test('20 - revision ID relation is mandatory and tamper-resistant without mutation', () => {
  const snapshot = completeTrustedSelfReconciledBaseline();
  const fingerprint = rcc.computeAuthoritySnapshotFingerprintV1(snapshot);
  const valid = {
    ...snapshot,
    authoritySnapshotFingerprint: fingerprint,
    authorityRevisionId: rcc.buildAuthorityRevisionIdV1(fingerprint),
  };
  const bytesBefore = JSON.stringify(valid);
  assert.strictEqual(rcc.verifyAuthoritySnapshotFingerprintV1(valid), true);
  assert.strictEqual(JSON.stringify(valid), bytesBefore);
  assert.strictEqual(rcc.verifyAuthoritySnapshotFingerprintV1({
    ...valid, authorityRevisionId: `rccar_${'0'.repeat(64)}`,
  }), false);
  const missing = { ...valid };
  delete missing.authorityRevisionId;
  assert.strictEqual(rcc.verifyAuthoritySnapshotFingerprintV1(missing), false);
  for (const authorityRevisionId of [
    'malformed',
    `wrong_${fingerprint}`,
    `rccar_${fingerprint.slice(1)}`,
    `rccar_${fingerprint.toUpperCase()}`,
    rcc.buildAuthorityRevisionIdV1(rcc.rccSha256Hex('another fingerprint')),
  ]) assert.strictEqual(rcc.verifyAuthoritySnapshotFingerprintV1({ ...valid, authorityRevisionId }), false);
  const tamperedFingerprint = rcc.rccSha256Hex('tampered fingerprint');
  assert.strictEqual(rcc.verifyAuthoritySnapshotFingerprintV1({
    ...valid,
    authoritySnapshotFingerprint: tamperedFingerprint,
    authorityRevisionId: rcc.buildAuthorityRevisionIdV1(tamperedFingerprint),
  }), false);
  assert.strictEqual(rcc.verifyAuthoritySnapshotFingerprintV1(valid), true);
});

test('21 - unsupported canonical values are rejected deterministically and verification fails closed', () => {
  class UnsupportedClass {}
  const cyclic = {};
  cyclic.self = cyclic;
  const cases = [
    [new Date('2020-01-01'), 'DATE'],
    [new Date('2030-01-01'), 'DATE'],
    [/abc/, 'REGEXP'],
    [new Map(), 'MAP'],
    [new Set(), 'SET'],
    [Object.create({ x: 1 }), 'OBJECT_PROTOTYPE'],
    [new UnsupportedClass(), 'OBJECT_PROTOTYPE'],
    [[,], 'SPARSE_ARRAY'],
    [[undefined], 'UNDEFINED'],
    [{ a: undefined }, 'UNDEFINED'],
    [NaN, 'NON_FINITE_NUMBER'],
    [Infinity, 'NON_FINITE_NUMBER'],
    [BigInt(1), 'BIGINT'],
    [function unsupported() {}, 'FUNCTION'],
    [Symbol('unsupported'), 'SYMBOL'],
    [cyclic, 'CYCLIC_REFERENCE'],
  ];
  for (const [value, code] of cases) {
    assert.throws(() => rcc.rccCanonicalize(value), {
      name: 'TypeError', message: `RCC_CANONICAL_UNSUPPORTED:${code}`,
    });
    assert.throws(() => rcc.rccCanonicalSerialize(value), {
      name: 'TypeError', message: `RCC_CANONICAL_UNSUPPORTED:${code}`,
    });
  }
  assert.throws(() => rcc.computeAuthoritySnapshotFingerprintV1({ covered: new Date('2020-01-01') }), {
    name: 'TypeError', message: 'RCC_CANONICAL_UNSUPPORTED:DATE',
  });
  assert.strictEqual(rcc.verifyAuthoritySnapshotFingerprintV1({
    covered: new Date('2020-01-01'),
    authoritySnapshotFingerprint: '0'.repeat(64),
    authorityRevisionId: `rccar_${'0'.repeat(64)}`,
  }), false);
});

test('22 - supported canonical values remain deterministic and collision-safe', () => {
  assert.strictEqual(rcc.rccCanonicalSerialize({}), '{}');
  assert.strictEqual(rcc.rccCanonicalSerialize([null]), '[null]');
  assert.notStrictEqual(rcc.rccCanonicalSerialize([1, 2]), rcc.rccCanonicalSerialize([2, 1]));
  assert.strictEqual(
    rcc.rccCanonicalSerialize({ z: { b: 2, a: 1 } }),
    rcc.rccCanonicalSerialize({ z: { a: 1, b: 2 } }),
  );
  const nullPrototype = Object.create(null);
  nullPrototype.valid = true;
  assert.strictEqual(rcc.rccCanonicalSerialize(nullPrototype), '{"valid":true}');
  assert.strictEqual(
    rcc.computeAuthoritySnapshotFingerprintV1(completeTrustedSelfReconciledBaseline()),
    'd2d66432a36863404786954b64239349e330d2ed2cc7dc8d6a1d943a659bbd1b',
  );
});

test('23 - descriptor-safe traversal rejects accessors without executing them', () => {
  const counterObject = { counter: 0 };
  Object.defineProperty(counterObject, 'danger', {
    enumerable: true,
    get() { counterObject.counter += 1; return 'unsafe'; },
  });
  const descriptorsBefore = Object.getOwnPropertyDescriptors(counterObject);
  assert.throws(() => rcc.rccCanonicalize(counterObject), {
    name: 'TypeError', message: 'RCC_CANONICAL_UNSUPPORTED:ACCESSOR_PROPERTY',
  });
  assert.strictEqual(counterObject.counter, 0);
  assert.deepStrictEqual(Object.getOwnPropertyDescriptors(counterObject), descriptorsBefore);

  const nonEnumerableGetter = {};
  Object.defineProperty(nonEnumerableGetter, 'hidden', {
    enumerable: false,
    get() { throw new Error('MUST_NOT_RUN'); },
  });
  assert.throws(() => rcc.rccCanonicalize(nonEnumerableGetter), {
    name: 'TypeError', message: 'RCC_CANONICAL_UNSUPPORTED:ACCESSOR_PROPERTY',
  });

  const setterOnly = {};
  Object.defineProperty(setterOnly, 'writeOnly', { enumerable: true, set(_value) {} });
  assert.throws(() => rcc.rccCanonicalize(setterOnly), {
    name: 'TypeError', message: 'RCC_CANONICAL_UNSUPPORTED:ACCESSOR_PROPERTY',
  });

  let throwingGetterCalls = 0;
  const throwingGetterSnapshot = {};
  Object.defineProperty(throwingGetterSnapshot, 'authoritySnapshotFingerprint', {
    enumerable: true,
    get() { throwingGetterCalls += 1; throw new Error('ARBITRARY_GETTER_ERROR'); },
  });
  assert.strictEqual(rcc.verifyAuthoritySnapshotFingerprintV1(throwingGetterSnapshot), false);
  assert.strictEqual(throwingGetterCalls, 0);

  const originalOwnKeys = Reflect.ownKeys;
  try {
    Reflect.ownKeys = () => { throw new Error('ARBITRARY_REFLECTION_ERROR'); };
    assert.throws(() => rcc.rccCanonicalize({ safe: true }), {
      name: 'TypeError', message: 'RCC_CANONICAL_UNSUPPORTED:TRAVERSAL_FAILURE',
    });
  } finally {
    Reflect.ownKeys = originalOwnKeys;
  }
  const originalDescriptor = Reflect.getOwnPropertyDescriptor;
  try {
    Reflect.getOwnPropertyDescriptor = () => undefined;
    assert.throws(() => rcc.rccCanonicalize({ safe: true }), {
      name: 'TypeError', message: 'RCC_CANONICAL_UNSUPPORTED:PROPERTY_DESCRIPTOR',
    });
  } finally {
    Reflect.getOwnPropertyDescriptor = originalDescriptor;
  }
});

test('24 - proxies are rejected before every trap and verification fails closed', () => {
  const makeProxy = (handler = {}) => new Proxy({ safe: true }, handler);
  const trapCounts = { ownKeys: 0, descriptor: 0, get: 0 };
  const proxies = [
    makeProxy(),
    makeProxy({ ownKeys() { trapCounts.ownKeys += 1; return ['safe']; } }),
    makeProxy({ getOwnPropertyDescriptor() { trapCounts.descriptor += 1; return undefined; } }),
    makeProxy({ get() { trapCounts.get += 1; return 'unsafe'; } }),
    makeProxy({ ownKeys() { throw new Error('ARBITRARY_PROXY_ERROR'); } }),
  ];
  for (const value of proxies) {
    assert.throws(() => rcc.rccCanonicalize(value), {
      name: 'TypeError', message: 'RCC_CANONICAL_UNSUPPORTED:PROXY',
    });
    assert.strictEqual(rcc.verifyAuthoritySnapshotFingerprintV1(value), false);
  }
  assert.deepStrictEqual(trapCounts, { ownKeys: 0, descriptor: 0, get: 0 });
  assert.throws(() => rcc.rccCanonicalize({ nested: makeProxy() }), {
    name: 'TypeError', message: 'RCC_CANONICAL_UNSUPPORTED:PROXY',
  });
  assert.throws(() => rcc.rccCanonicalize([makeProxy()]), {
    name: 'TypeError', message: 'RCC_CANONICAL_UNSUPPORTED:PROXY',
  });
});

test('25 - complete object and array own-property surfaces prevent silent collisions', () => {
  assert.strictEqual(rcc.rccCanonicalSerialize({ ordinary: true }), '{"ordinary":true}');
  const nullPrototype = Object.create(null);
  nullPrototype.ordinary = true;
  assert.strictEqual(rcc.rccCanonicalSerialize(nullPrototype), '{"ordinary":true}');
  assert.strictEqual(rcc.rccCanonicalSerialize(Object.freeze({ frozen: true })), '{"frozen":true}');
  assert.strictEqual(rcc.rccCanonicalSerialize(Object.seal({ sealed: true })), '{"sealed":true}');

  const ordinary = { a: 1 };
  const ordinaryFingerprint = rcc.computeAuthoritySnapshotFingerprintV1(ordinary);
  const hidden = { a: 1 };
  Object.defineProperty(hidden, 'hidden', { value: 2, enumerable: false });
  assert.throws(() => rcc.computeAuthoritySnapshotFingerprintV1(hidden), {
    name: 'TypeError', message: 'RCC_CANONICAL_UNSUPPORTED:PROPERTY_DESCRIPTOR',
  });
  assert.strictEqual(rcc.computeAuthoritySnapshotFingerprintV1(ordinary), ordinaryFingerprint);

  const symbolObject = { a: 1 };
  symbolObject[Symbol('hidden')] = 2;
  assert.throws(() => rcc.rccCanonicalize(symbolObject), {
    name: 'TypeError', message: 'RCC_CANONICAL_UNSUPPORTED:SYMBOL_KEY',
  });
  assert.throws(() => rcc.rccCanonicalize(Object.create({ inherited: true })), {
    name: 'TypeError', message: 'RCC_CANONICAL_UNSUPPORTED:OBJECT_PROTOTYPE',
  });

  assert.strictEqual(rcc.rccCanonicalSerialize([null]), '[null]');
  assert.notStrictEqual(rcc.rccCanonicalSerialize([1, 2]), rcc.rccCanonicalSerialize([2, 1]));
  assert.throws(() => rcc.rccCanonicalize([, 1]), {
    name: 'TypeError', message: 'RCC_CANONICAL_UNSUPPORTED:SPARSE_ARRAY',
  });
  assert.throws(() => rcc.rccCanonicalize([undefined]), {
    name: 'TypeError', message: 'RCC_CANONICAL_UNSUPPORTED:UNDEFINED',
  });

  const extraArray = [1];
  const plainArrayFingerprint = rcc.computeAuthoritySnapshotFingerprintV1([1]);
  extraArray.extra = 2;
  assert.throws(() => rcc.computeAuthoritySnapshotFingerprintV1(extraArray), {
    name: 'TypeError', message: 'RCC_CANONICAL_UNSUPPORTED:PROPERTY_DESCRIPTOR',
  });
  assert.strictEqual(rcc.computeAuthoritySnapshotFingerprintV1([1]), plainArrayFingerprint);

  const symbolArray = [1];
  symbolArray[Symbol('extra')] = 2;
  assert.throws(() => rcc.rccCanonicalize(symbolArray), {
    name: 'TypeError', message: 'RCC_CANONICAL_UNSUPPORTED:SYMBOL_KEY',
  });
  const hiddenArray = [1];
  Object.defineProperty(hiddenArray, 'hidden', { value: 2, enumerable: false });
  assert.throws(() => rcc.rccCanonicalize(hiddenArray), {
    name: 'TypeError', message: 'RCC_CANONICAL_UNSUPPORTED:PROPERTY_DESCRIPTOR',
  });
  const accessorArray = [1];
  Object.defineProperty(accessorArray, '0', { enumerable: true, get() { throw new Error('MUST_NOT_RUN'); } });
  assert.throws(() => rcc.rccCanonicalize(accessorArray), {
    name: 'TypeError', message: 'RCC_CANONICAL_UNSUPPORTED:ACCESSOR_PROPERTY',
  });
  const customPrototypeArray = [1];
  Object.setPrototypeOf(customPrototypeArray, {});
  assert.throws(() => rcc.rccCanonicalize(customPrototypeArray), {
    name: 'TypeError', message: 'RCC_CANONICAL_UNSUPPORTED:ARRAY_PROTOTYPE',
  });
});

test('26 - canonical maximum depth and scalar distinctions are deterministic', () => {
  function nestedDepth(depth) {
    let value = 'leaf';
    for (let index = 0; index < depth; index += 1) value = { child: value };
    return value;
  }
  assert.strictEqual(rcc.RC_C_CANONICAL_MAX_DEPTH, 128);
  const atLimit = nestedDepth(rcc.RC_C_CANONICAL_MAX_DEPTH);
  const overLimit = nestedDepth(rcc.RC_C_CANONICAL_MAX_DEPTH + 1);
  assert.doesNotThrow(() => rcc.rccCanonicalSerialize(atLimit));
  assert.doesNotThrow(() => rcc.computeAuthoritySnapshotFingerprintV1(atLimit));
  const overLimitBytes = JSON.stringify(overLimit);
  assert.throws(() => rcc.rccCanonicalize(overLimit), {
    name: 'TypeError', message: 'RCC_CANONICAL_UNSUPPORTED:MAX_DEPTH_EXCEEDED',
  });
  assert.throws(() => rcc.computeAuthoritySnapshotFingerprintV1(overLimit), {
    name: 'TypeError', message: 'RCC_CANONICAL_UNSUPPORTED:MAX_DEPTH_EXCEEDED',
  });
  assert.strictEqual(rcc.verifyAuthoritySnapshotFingerprintV1(overLimit), false);
  assert.strictEqual(JSON.stringify(overLimit), overLimitBytes);
  assert.strictEqual(rcc.rccCanonicalSerialize(-0), rcc.rccCanonicalSerialize(0));
  assert.notStrictEqual(rcc.rccCanonicalSerialize(''), rcc.rccCanonicalSerialize(0));
  assert.notStrictEqual(rcc.rccCanonicalSerialize(false), rcc.rccCanonicalSerialize(0));
  assert.notStrictEqual(rcc.rccCanonicalSerialize([1]), rcc.rccCanonicalSerialize({ 0: 1 }));
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}
console.log(`PASS rc-c-pilot-state: ${passed}/${tests.length} deterministic assertions`);

module.exports = {
  completeTrustedSelfReconciledBaseline,
  blankAssessableBaseline,
  storedPositiveRecomputedStaleBaseline,
  partialPositiveAssuranceBaseline,
  clientRejectedValidServerBaseline,
  unknownEnumBaseline,
  missingRequiredFieldBaseline,
};
