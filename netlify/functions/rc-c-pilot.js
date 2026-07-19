'use strict';

const crypto = require('crypto');

const RC_C_CONTRACT_VERSION = 'rc-c-v1-frozen';
const RC_C_SCHEMA_VERSION = 1;
const RC_C_ENUMERATION_METHOD_VERSION = 'pilot_numbered_bands_v1';
const RC_C_QUALITY_THRESHOLD_VERSION = 'rc-c-pilot-quality-v1';
const RC_C_GEOMETRY_TOLERANCE_VERSION = 'rc-c-pilot-geometry-v1';
const RC_C_AUTHORITY_ISSUER = 'coverage-authority-service';

const ENUMS = Object.freeze({
  processingState: Object.freeze(['complete', 'partial', 'failed']),
  evidenceAuthorityState: Object.freeze(['trusted', 'missing', 'invalid']),
  enumerationState: Object.freeze(['enumerated', 'unresolved', 'failed', 'invalid', 'stale']),
  pageTopologyState: Object.freeze(['resolved', 'unsupported', 'invalid', 'stale']),
  sourceDomainAccountingState: Object.freeze(['accounted', 'unresolved', 'invalid', 'stale']),
  reconciliationState: Object.freeze([
    'not_available',
    'reconciliation_matched',
    'reconciliation_no_assessable_content',
    'reconciliation_mismatched',
    'reconciliation_review_required',
    'invalid',
    'stale',
  ]),
  coverageAssuranceLevel: Object.freeze(['unknown', 'self_reconciled']),
  issuedAuthorityValidationState: Object.freeze(['valid', 'invalid', 'stale', 'schema_unsupported']),
  attemptStructureState: Object.freeze(['assessable_attempts', 'blank_attempts', 'no_assessable_content', 'unknown']),
  serverStructuralUseClass: Object.freeze([
    'trusted_self_reconciled',
    'trusted_observed_only',
    'legacy_observed_only',
    'review_required',
    'structural_unknown',
    'structurally_invalid',
    'evidence_invalid',
    'processing_failed',
    'validation_stale',
    'reconciliation_mismatched',
    'no_assessable_content',
    'blank_attempts',
  ]),
  clientLocalValidationResult: Object.freeze(['accepted', 'rejected', 'stale', 'unsupported']),
  localEffectiveUseClassKind: Object.freeze([
    'use_server_class',
    'local_use_blocked',
    'local_schema_unsupported',
    'local_payload_stale',
  ]),
  attemptDisposition: Object.freeze(['answered', 'blank']),
  sourceLeafClass: Object.freeze([
    'assessable_candidate',
    'non_assessable',
    'background_whitespace',
    'excluded_outer_margin',
    'unsupported',
    'unresolved',
  ]),
  capacityResult: Object.freeze([
    'compatible_and_sufficient',
    'compatible_and_sufficient_for_processed_scope_only',
    'unknown',
    'exceeded',
    'incompatible',
  ]),
});

const REQUIRED_SERVER_FIELDS = Object.freeze([
  'contractVersion',
  'schemaVersion',
  'reportLineageId',
  'processingState',
  'evidenceAuthorityState',
  'enumerationState',
  'pageTopologyState',
  'sourceDomainAccountingState',
  'reconciliationState',
  'coverageAssuranceLevel',
  'issuedAuthorityValidationState',
  'attemptStructureState',
  'capacity.result',
  'lineageValid',
  'fingerprintsValid',
  'invariantsValid',
  'blockingLimitations',
]);

const SERVER_ENUM_FIELDS = Object.freeze({
  processingState: ENUMS.processingState,
  evidenceAuthorityState: ENUMS.evidenceAuthorityState,
  enumerationState: ENUMS.enumerationState,
  pageTopologyState: ENUMS.pageTopologyState,
  sourceDomainAccountingState: ENUMS.sourceDomainAccountingState,
  reconciliationState: ENUMS.reconciliationState,
  coverageAssuranceLevel: ENUMS.coverageAssuranceLevel,
  issuedAuthorityValidationState: ENUMS.issuedAuthorityValidationState,
  attemptStructureState: ENUMS.attemptStructureState,
  'capacity.result': ENUMS.capacityResult,
});

const POSITIVE_SERVER_CLASSES = new Set([
  'trusted_self_reconciled',
  'trusted_observed_only',
  'legacy_observed_only',
]);

function getRCCPilotConfig(env = {}) {
  return Object.freeze({
    enabled: env.RC_C_PILOT_ENABLED === '1',
    contractVersion: RC_C_CONTRACT_VERSION,
    schemaVersion: RC_C_SCHEMA_VERSION,
    enumerationMethodVersion: RC_C_ENUMERATION_METHOD_VERSION,
    qualityThresholdVersion: RC_C_QUALITY_THRESHOLD_VERSION,
    geometryToleranceVersion: RC_C_GEOMETRY_TOLERANCE_VERSION,
    issuer: RC_C_AUTHORITY_ISSUER,
  });
}

function rccCanonicalError(code) {
  return new TypeError(`RCC_CANONICAL_UNSUPPORTED:${code}`);
}

function rccCanonicalize(value) {
  const active = new WeakSet();

  function canonicalize(current) {
    if (current === null || typeof current === 'string' || typeof current === 'boolean') return current;
    if (typeof current === 'number') {
      if (!Number.isFinite(current)) throw rccCanonicalError('NON_FINITE_NUMBER');
      return Object.is(current, -0) ? 0 : current;
    }
    if (current === undefined) throw rccCanonicalError('UNDEFINED');
    if (typeof current === 'function') throw rccCanonicalError('FUNCTION');
    if (typeof current === 'symbol') throw rccCanonicalError('SYMBOL');
    if (typeof current === 'bigint') throw rccCanonicalError('BIGINT');

    if (Array.isArray(current)) {
      if (Object.getPrototypeOf(current) !== Array.prototype) throw rccCanonicalError('ARRAY_PROTOTYPE');
      if (active.has(current)) throw rccCanonicalError('CYCLIC_REFERENCE');
      active.add(current);
      try {
        const result = [];
        for (let index = 0; index < current.length; index += 1) {
          if (!Object.prototype.hasOwnProperty.call(current, index)) throw rccCanonicalError('SPARSE_ARRAY');
          result.push(canonicalize(current[index]));
        }
        return result;
      } finally {
        active.delete(current);
      }
    }

    if (current instanceof Date) throw rccCanonicalError('DATE');
    if (current instanceof RegExp) throw rccCanonicalError('REGEXP');
    if (current instanceof Map) throw rccCanonicalError('MAP');
    if (current instanceof Set) throw rccCanonicalError('SET');
    if (Buffer.isBuffer(current) || ArrayBuffer.isView(current)) throw rccCanonicalError('BUFFER_OR_TYPED_ARRAY');
    if (typeof current === 'object') {
      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) throw rccCanonicalError('OBJECT_PROTOTYPE');
      if (active.has(current)) throw rccCanonicalError('CYCLIC_REFERENCE');
      active.add(current);
      try {
        const ownKeys = Reflect.ownKeys(current);
        if (ownKeys.some((key) => typeof key !== 'string')) throw rccCanonicalError('SYMBOL_KEY');
        const result = {};
        for (const key of ownKeys.sort()) {
          const descriptor = Object.getOwnPropertyDescriptor(current, key);
          if (!descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
            throw rccCanonicalError('PROPERTY_DESCRIPTOR');
          }
          result[key] = canonicalize(descriptor.value);
        }
        return result;
      } finally {
        active.delete(current);
      }
    }
    throw rccCanonicalError('UNKNOWN_TYPE');
  }

  return canonicalize(value);
}

function rccCanonicalSerialize(value) {
  return JSON.stringify(rccCanonicalize(value));
}

function rccSha256Hex(value) {
  const bytes = typeof value === 'string' ? value : rccCanonicalSerialize(value);
  return crypto.createHash('sha256').update(bytes, 'utf8').digest('hex');
}

function valueAtPath(object, path) {
  return path.split('.').reduce((current, key) => (
    current !== null && typeof current === 'object' ? current[key] : undefined
  ), object);
}

function requiredRCCServerFieldMissing(state) {
  if (state === null || typeof state !== 'object' || Array.isArray(state)) return 'state';
  for (const field of REQUIRED_SERVER_FIELDS) {
    const value = valueAtPath(state, field);
    if (value === undefined || value === null || (field === 'reportLineageId' && value === '')) return field;
  }
  if (typeof state.reportLineageId !== 'string') return 'reportLineageId';
  if (!state.capacity || typeof state.capacity !== 'object' || Array.isArray(state.capacity)) return 'capacity.result';
  if (!Array.isArray(state.blockingLimitations)) return 'blockingLimitations';
  for (const field of ['lineageValid', 'fingerprintsValid', 'invariantsValid']) {
    if (typeof state[field] !== 'boolean') return field;
  }
  return null;
}

function unknownRCCServerEnumValue(state) {
  if (state === null || typeof state !== 'object') return null;
  for (const [field, allowed] of Object.entries(SERVER_ENUM_FIELDS)) {
    const value = valueAtPath(state, field);
    if (value !== undefined && value !== null && !allowed.includes(value)) return { field, value };
  }
  return null;
}

function validateRCCServerStateV1(state) {
  const diagnostics = [];
  const missingField = requiredRCCServerFieldMissing(state);
  if (missingField) diagnostics.push(`REQUIRED_RCC_SERVER_FIELD_MISSING:${missingField}`);
  const unknownEnum = unknownRCCServerEnumValue(state);
  if (unknownEnum) diagnostics.push(`UNKNOWN_RCC_SERVER_ENUM_VALUE:${unknownEnum.field}`);
  if (!missingField && state.contractVersion !== RC_C_CONTRACT_VERSION) diagnostics.push('RCC_CONTRACT_VERSION_UNSUPPORTED');
  if (!missingField && state.schemaVersion !== RC_C_SCHEMA_VERSION) diagnostics.push('RCC_SCHEMA_VERSION_UNSUPPORTED');
  return { valid: diagnostics.length === 0, diagnostics, missingField, unknownEnum };
}

function serverResult(serverClass, diagnostics = [], effectiveCoverageAssuranceLevel = 'unknown') {
  return { serverClass, diagnostics, effectiveCoverageAssuranceLevel };
}

function deriveServerStructuralUseClassV1(state) {
  const validation = validateRCCServerStateV1(state);
  if (!validation.valid) return serverResult('structurally_invalid', validation.diagnostics);

  if (!state.lineageValid) return serverResult('structurally_invalid', ['SERVER_LINEAGE_INVALID']);
  if (!state.fingerprintsValid) return serverResult('structurally_invalid', ['SERVER_FINGERPRINT_INVALID']);
  if (!state.invariantsValid) return serverResult('structurally_invalid', ['SERVER_INVARIANT_INVALID']);

  if (state.issuedAuthorityValidationState === 'schema_unsupported') {
    return serverResult('structurally_invalid', ['ISSUED_AUTHORITY_SCHEMA_UNSUPPORTED']);
  }
  if (state.issuedAuthorityValidationState === 'invalid') {
    return serverResult('validation_stale', ['ISSUED_AUTHORITY_VALIDATION_INVALID']);
  }
  if (state.issuedAuthorityValidationState === 'stale') {
    return serverResult('validation_stale', ['ISSUED_AUTHORITY_VALIDATION_STALE']);
  }

  if (state.evidenceAuthorityState !== 'trusted') {
    return serverResult('evidence_invalid', [
      state.evidenceAuthorityState === 'missing' ? 'EVIDENCE_AUTHORITY_MISSING' : 'EVIDENCE_AUTHORITY_INVALID',
    ]);
  }

  if (state.processingState === 'failed') return serverResult('processing_failed', ['PROCESSING_FAILED']);
  if (state.processingState === 'partial' && state.coverageAssuranceLevel === 'self_reconciled') {
    return serverResult('structurally_invalid', ['PARTIAL_PROCESSING_WITH_POSITIVE_ASSURANCE']);
  }

  if (state.enumerationState === 'stale') return serverResult('validation_stale', ['ENUMERATION_STALE']);
  if (state.enumerationState === 'failed') return serverResult('structurally_invalid', ['ENUMERATION_FAILED']);
  if (state.enumerationState === 'invalid') return serverResult('structurally_invalid', ['ENUMERATION_INVALID']);
  if (state.pageTopologyState === 'stale') return serverResult('validation_stale', ['PAGE_TOPOLOGY_STALE']);
  if (state.pageTopologyState === 'invalid') return serverResult('structurally_invalid', ['PAGE_TOPOLOGY_INVALID']);
  if (state.sourceDomainAccountingState === 'stale') return serverResult('validation_stale', ['SOURCE_DOMAIN_ACCOUNTING_STALE']);
  if (state.sourceDomainAccountingState === 'invalid') return serverResult('structurally_invalid', ['SOURCE_DOMAIN_ACCOUNTING_INVALID']);
  if (state.reconciliationState === 'stale') return serverResult('validation_stale', ['RECONCILIATION_STALE']);
  if (state.reconciliationState === 'invalid') return serverResult('structurally_invalid', ['RECONCILIATION_INVALID']);

  if (state.reconciliationState === 'reconciliation_mismatched') {
    return serverResult('reconciliation_mismatched', ['RECONCILIATION_MISMATCHED']);
  }
  if (state.reconciliationState === 'reconciliation_review_required') {
    return serverResult('review_required', ['RECONCILIATION_REVIEW_REQUIRED']);
  }

  if (state.capacity.result === 'exceeded' || state.capacity.result === 'incompatible') {
    return serverResult('structurally_invalid', ['TERMINAL_STRUCTURAL_INVARIANT_FAILURE']);
  }

  const exactStructuralInputs = (
    state.processingState === 'complete'
    && state.enumerationState === 'enumerated'
    && state.pageTopologyState === 'resolved'
    && state.sourceDomainAccountingState === 'accounted'
    && state.reconciliationState === 'reconciliation_matched'
    && state.attemptStructureState === 'assessable_attempts'
    && state.capacity.result === 'compatible_and_sufficient'
    && state.blockingLimitations.length === 0
  );

  if (exactStructuralInputs && state.coverageAssuranceLevel === 'self_reconciled') {
    return serverResult('trusted_self_reconciled', [], 'self_reconciled');
  }
  if (exactStructuralInputs && state.coverageAssuranceLevel === 'unknown') {
    return serverResult('trusted_observed_only');
  }

  const exactLegacyInputs = (
    state.processingState === 'complete'
    && state.enumerationState === 'unresolved'
    && state.pageTopologyState === 'unsupported'
    && state.sourceDomainAccountingState === 'unresolved'
    && state.reconciliationState === 'not_available'
    && state.coverageAssuranceLevel === 'unknown'
    && state.attemptStructureState === 'assessable_attempts'
    && state.capacity.result === 'unknown'
    && state.blockingLimitations.length === 0
  );
  if (exactLegacyInputs) return serverResult('legacy_observed_only');

  const recognizedIncomplete = (
    state.processingState === 'partial'
    || state.enumerationState === 'unresolved'
    || state.pageTopologyState === 'unsupported'
    || state.sourceDomainAccountingState === 'unresolved'
    || state.reconciliationState === 'not_available'
    || state.attemptStructureState === 'unknown'
    || state.capacity.result === 'compatible_and_sufficient_for_processed_scope_only'
    || state.capacity.result === 'unknown'
    || state.blockingLimitations.length > 0
  );
  if (recognizedIncomplete && state.coverageAssuranceLevel === 'unknown') {
    return serverResult('structural_unknown', ['STRUCTURE_RECOGNIZED_INCOMPLETE']);
  }

  const exactTerminalContentInputs = (
    state.processingState === 'complete'
    && state.enumerationState === 'enumerated'
    && state.pageTopologyState === 'resolved'
    && state.sourceDomainAccountingState === 'accounted'
    && state.capacity.result === 'compatible_and_sufficient'
    && state.blockingLimitations.length === 0
  );

  if (
    exactTerminalContentInputs
    && state.attemptStructureState === 'no_assessable_content'
    && state.reconciliationState === 'reconciliation_no_assessable_content'
  ) return serverResult('no_assessable_content');

  if (
    exactTerminalContentInputs
    && state.attemptStructureState === 'blank_attempts'
    && state.reconciliationState === 'reconciliation_matched'
  ) return serverResult('blank_attempts');

  return serverResult('structurally_invalid', ['TERMINAL_STRUCTURAL_INVARIANT_FAILURE']);
}

function compareStoredAndRecomputedServerClassV1(snapshot) {
  const serverState = snapshot && snapshot.serverState ? snapshot.serverState : snapshot;
  const stored = snapshot && (
    snapshot.storedServerStructuralUseClass !== undefined
      ? snapshot.storedServerStructuralUseClass
      : snapshot.serverStructuralUseClass
  );
  const recomputed = deriveServerStructuralUseClassV1(serverState);
  const mismatch = stored !== recomputed.serverClass;
  const diagnostics = recomputed.diagnostics.slice();
  if (mismatch) diagnostics.push('SERVER_STRUCTURAL_USE_CLASS_MISMATCH');
  return {
    storedServerStructuralUseClass: stored,
    recomputedServerStructuralUseClass: recomputed.serverClass,
    effectiveServerStructuralUseClass: recomputed.serverClass,
    effectiveCoverageAssuranceLevel: recomputed.effectiveCoverageAssuranceLevel,
    diagnostics,
    authoritySnapshotValid: !mismatch,
    storedPositiveUseProhibited: mismatch && POSITIVE_SERVER_CLASSES.has(stored),
  };
}

function localResult(kind, serverClass, localDiagnostics, localBlockReason = null) {
  const localEffectiveUseClass = kind === 'use_server_class' ? { kind, serverClass } : { kind };
  return { localEffectiveUseClass, localBlockReason, localDiagnostics };
}

function deriveLocalEffectiveUseClassV1(serverClass, localState) {
  if (!ENUMS.serverStructuralUseClass.includes(serverClass)) {
    return localResult('local_use_blocked', serverClass, ['CLIENT_SERVER_CLASS_UNKNOWN'], 'CLIENT_SERVER_CLASS_UNKNOWN');
  }
  if (!localState || typeof localState !== 'object') {
    return localResult('local_use_blocked', serverClass, ['CLIENT_LOCAL_VALIDATION_UNKNOWN'], 'CLIENT_LOCAL_VALIDATION_UNKNOWN');
  }
  if (localState.clientLocalValidationResult === 'unsupported' || localState.schemaSupported !== true) {
    return localResult('local_schema_unsupported', serverClass, ['CLIENT_LOCAL_SCHEMA_UNSUPPORTED'], 'CLIENT_LOCAL_SCHEMA_UNSUPPORTED');
  }
  if (localState.clientLocalValidationResult === 'stale' || localState.payloadFresh !== true) {
    return localResult('local_payload_stale', serverClass, ['CLIENT_LOCAL_PAYLOAD_STALE'], 'CLIENT_LOCAL_PAYLOAD_STALE');
  }
  if (localState.payloadIntegrityValid !== true) {
    return localResult('local_use_blocked', serverClass, ['CLIENT_LOCAL_PAYLOAD_INTEGRITY_INVALID'], 'CLIENT_LOCAL_PAYLOAD_INTEGRITY_INVALID');
  }
  if (localState.clientLocalValidationResult === 'rejected') {
    return localResult('local_use_blocked', serverClass, ['CLIENT_LOCAL_VALIDATION_REJECTED'], 'CLIENT_LOCAL_VALIDATION_REJECTED');
  }
  if (localState.clientLocalValidationResult !== 'accepted') {
    return localResult('local_use_blocked', serverClass, ['CLIENT_LOCAL_VALIDATION_UNKNOWN'], 'CLIENT_LOCAL_VALIDATION_UNKNOWN');
  }
  return localResult('use_server_class', serverClass, []);
}

const EXCLUDED_FINGERPRINT_KEYS = new Set([
  'authoritySnapshotFingerprint',
  'authorityRevisionId',
  'issuedAt',
  'browserState',
  'clientCacheState',
  'cacheState',
  'renderingState',
  'urlQueryParameters',
  'queryParameters',
  'schemaSupported',
  'payloadFresh',
  'payloadIntegrityValid',
]);

function fingerprintProjection(value, active = new WeakSet()) {
  if (Array.isArray(value)) {
    if (active.has(value)) throw rccCanonicalError('CYCLIC_REFERENCE');
    active.add(value);
    try {
      return value.map((child) => fingerprintProjection(child, active));
    } finally {
      active.delete(value);
    }
  }
  if (value && typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return value;
    if (Reflect.ownKeys(value).some((key) => typeof key !== 'string')) return value;
    if (active.has(value)) throw rccCanonicalError('CYCLIC_REFERENCE');
    active.add(value);
    try {
      const result = {};
      for (const [key, child] of Object.entries(value)) {
        if (EXCLUDED_FINGERPRINT_KEYS.has(key) || /^(client|local)/i.test(key) || key === 'rcCPilotLocalState') continue;
        result[key] = fingerprintProjection(child, active);
      }
      return result;
    } finally {
      active.delete(value);
    }
  }
  return value;
}

function computeAuthoritySnapshotFingerprintV1(snapshot) {
  return rccSha256Hex(rccCanonicalSerialize(fingerprintProjection(snapshot)));
}

function verifyAuthoritySnapshotFingerprintV1(snapshot) {
  try {
    if (!snapshot || !/^[0-9a-f]{64}$/.test(snapshot.authoritySnapshotFingerprint || '')) return false;
    if (snapshot.authorityRevisionId !== buildAuthorityRevisionIdV1(snapshot.authoritySnapshotFingerprint)) return false;
    const actual = computeAuthoritySnapshotFingerprintV1(snapshot);
    return crypto.timingSafeEqual(Buffer.from(actual, 'ascii'), Buffer.from(snapshot.authoritySnapshotFingerprint, 'ascii'));
  } catch (_error) {
    return false;
  }
}

function buildAuthorityRevisionIdV1(fingerprint) {
  if (!/^[0-9a-f]{64}$/.test(fingerprint || '')) throw new TypeError('RCC authority fingerprint must be 64 lowercase hexadecimal characters');
  return `rccar_${fingerprint}`;
}

const service = Object.freeze({
  getRCCPilotConfig,
  rccCanonicalize,
  rccCanonicalSerialize,
  rccSha256Hex,
  validateRCCServerStateV1,
  requiredRCCServerFieldMissing,
  unknownRCCServerEnumValue,
  deriveServerStructuralUseClassV1,
  compareStoredAndRecomputedServerClassV1,
  deriveLocalEffectiveUseClassV1,
  computeAuthoritySnapshotFingerprintV1,
  verifyAuthoritySnapshotFingerprintV1,
  buildAuthorityRevisionIdV1,
});

exports.service = service;
exports.__rccTest = Object.freeze({
  ...service,
  RC_C_CONTRACT_VERSION,
  RC_C_SCHEMA_VERSION,
  RC_C_ENUMERATION_METHOD_VERSION,
  RC_C_QUALITY_THRESHOLD_VERSION,
  RC_C_GEOMETRY_TOLERANCE_VERSION,
  RC_C_AUTHORITY_ISSUER,
  ENUMS,
  REQUIRED_SERVER_FIELDS,
});
