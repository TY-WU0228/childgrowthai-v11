'use strict';

const crypto = require('crypto');
const zlib = require('zlib');
const { types } = require('util');

const RC_C_CONTRACT_VERSION = 'rc-c-v1-frozen';
const RC_C_SCHEMA_VERSION = 1;
const RC_C_ENUMERATION_METHOD_VERSION = 'pilot_numbered_bands_v1';
const RC_C_QUALITY_THRESHOLD_VERSION = 'rc-c-pilot-quality-v1';
const RC_C_GEOMETRY_TOLERANCE_VERSION = 'rc-c-pilot-geometry-v1';
const RC_C_AUTHORITY_ISSUER = 'coverage-authority-service';
const RC_C_CANONICAL_MAX_DEPTH = 128;
const RC_C_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const RC_C_MAX_IMAGE_WIDTH = 6000;
const RC_C_MAX_IMAGE_HEIGHT = 6000;
const RC_C_MAX_DECODED_PIXELS = 20000000;
const RC_C_MAX_IMAGE_CHANNELS = 4;
const RC_C_MAX_RAW_OUTPUT_BYTES = 80000000;
const RC_C_DECODE_TIMEOUT_SECONDS = 3;
const RC_C_MAX_GLARE_OR_SOLID_CLIPPING_RATIO = 0.02;
const RC_C_SOURCE_ACCOUNTING_METHOD_VERSION = 'pilot_source_partition_v1';
const RC_C_SOURCE_ACCOUNTING_TOLERANCE_VERSION = 'pilot_source_accounting_tolerance_v1';
const INDEPENDENT_SOURCE_COMPLETENESS_LIMITATION = 'INDEPENDENT_SOURCE_COMPLETENESS_NOT_CLAIMED';

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

function rccSafeReflect(operation) {
  try {
    return operation();
  } catch (_error) {
    throw rccCanonicalError('TRAVERSAL_FAILURE');
  }
}

function rccIsCanonicalError(error) {
  return error instanceof TypeError && /^RCC_CANONICAL_UNSUPPORTED:[A-Z_]+$/.test(error.message);
}

function rccValidateDataDescriptor(descriptor, enumerableRequired) {
  if (!descriptor || typeof descriptor !== 'object') throw rccCanonicalError('PROPERTY_DESCRIPTOR');
  if (
    Object.prototype.hasOwnProperty.call(descriptor, 'get')
    || Object.prototype.hasOwnProperty.call(descriptor, 'set')
  ) throw rccCanonicalError('ACCESSOR_PROPERTY');
  if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
    throw rccCanonicalError('PROPERTY_DESCRIPTOR');
  }
  if (enumerableRequired && descriptor.enumerable !== true) {
    throw rccCanonicalError('PROPERTY_DESCRIPTOR');
  }
  return descriptor;
}

function rccTraverseCanonical(value, excludeObjectKey) {
  const active = new WeakSet();

  function canonicalize(current, depth) {
    if (depth > RC_C_CANONICAL_MAX_DEPTH) throw rccCanonicalError('MAX_DEPTH_EXCEEDED');
    if (current === null || typeof current === 'string' || typeof current === 'boolean') return current;
    if (typeof current === 'number') {
      if (!Number.isFinite(current)) throw rccCanonicalError('NON_FINITE_NUMBER');
      return Object.is(current, -0) ? 0 : current;
    }
    if (current === undefined) throw rccCanonicalError('UNDEFINED');
    if ((typeof current === 'object' || typeof current === 'function') && types.isProxy(current)) {
      throw rccCanonicalError('PROXY');
    }
    if (typeof current === 'function') throw rccCanonicalError('FUNCTION');
    if (typeof current === 'symbol') throw rccCanonicalError('SYMBOL');
    if (typeof current === 'bigint') throw rccCanonicalError('BIGINT');

    if (Array.isArray(current)) {
      const prototype = rccSafeReflect(() => Reflect.getPrototypeOf(current));
      if (prototype !== Array.prototype) throw rccCanonicalError('ARRAY_PROTOTYPE');
      if (active.has(current)) throw rccCanonicalError('CYCLIC_REFERENCE');
      active.add(current);
      try {
        const ownKeys = rccSafeReflect(() => Reflect.ownKeys(current));
        if (ownKeys.some((key) => typeof key !== 'string')) throw rccCanonicalError('SYMBOL_KEY');
        const descriptors = new Map();
        for (const key of ownKeys) {
          descriptors.set(key, rccSafeReflect(() => Reflect.getOwnPropertyDescriptor(current, key)));
        }
        for (const key of ownKeys) {
          rccValidateDataDescriptor(descriptors.get(key), key !== 'length');
        }
        const lengthDescriptor = rccValidateDataDescriptor(descriptors.get('length'), false);
        const length = lengthDescriptor.value;
        if (!Number.isSafeInteger(length) || length < 0 || length > 0xffffffff) {
          throw rccCanonicalError('PROPERTY_DESCRIPTOR');
        }
        if (ownKeys.length !== length + 1) {
          const expectedIndexCount = ownKeys.filter((key) => /^(0|[1-9][0-9]*)$/.test(key)).length;
          if (expectedIndexCount < length) throw rccCanonicalError('SPARSE_ARRAY');
          throw rccCanonicalError('PROPERTY_DESCRIPTOR');
        }
        for (let index = 0; index < length; index += 1) {
          const key = String(index);
          if (!descriptors.has(key)) throw rccCanonicalError('SPARSE_ARRAY');
          rccValidateDataDescriptor(descriptors.get(key), true);
        }
        for (const key of ownKeys) {
          if (key !== 'length' && !/^(0|[1-9][0-9]*)$/.test(key)) {
            throw rccCanonicalError('PROPERTY_DESCRIPTOR');
          }
          if (key !== 'length' && Number(key) >= length) throw rccCanonicalError('PROPERTY_DESCRIPTOR');
        }
        const result = new Array(length);
        for (let index = 0; index < length; index += 1) {
          result[index] = canonicalize(descriptors.get(String(index)).value, depth + 1);
        }
        return result;
      } finally {
        active.delete(current);
      }
    }

    const prototype = rccSafeReflect(() => Reflect.getPrototypeOf(current));
    if (prototype === Date.prototype) throw rccCanonicalError('DATE');
    if (prototype === RegExp.prototype) throw rccCanonicalError('REGEXP');
    if (prototype === Map.prototype) throw rccCanonicalError('MAP');
    if (prototype === Set.prototype) throw rccCanonicalError('SET');
    if (Buffer.isBuffer(current) || ArrayBuffer.isView(current)) throw rccCanonicalError('BUFFER_OR_TYPED_ARRAY');
    if (typeof current === 'object') {
      if (prototype !== Object.prototype && prototype !== null) throw rccCanonicalError('OBJECT_PROTOTYPE');
      if (active.has(current)) throw rccCanonicalError('CYCLIC_REFERENCE');
      active.add(current);
      try {
        const ownKeys = rccSafeReflect(() => Reflect.ownKeys(current));
        if (ownKeys.some((key) => typeof key !== 'string')) throw rccCanonicalError('SYMBOL_KEY');
        const descriptors = new Map();
        for (const key of ownKeys) {
          const descriptor = rccSafeReflect(() => Reflect.getOwnPropertyDescriptor(current, key));
          descriptors.set(key, rccValidateDataDescriptor(descriptor, true));
        }
        const result = Object.create(null);
        for (const key of ownKeys.slice().sort()) {
          const child = canonicalize(descriptors.get(key).value, depth + 1);
          if (!excludeObjectKey || !excludeObjectKey(key)) result[key] = child;
        }
        return result;
      } finally {
        active.delete(current);
      }
    }
    throw rccCanonicalError('UNKNOWN_TYPE');
  }

  try {
    return canonicalize(value, 0);
  } catch (error) {
    if (rccIsCanonicalError(error)) throw error;
    throw rccCanonicalError('TRAVERSAL_FAILURE');
  }
}

function rccCanonicalize(value) {
  return rccTraverseCanonical(value, null);
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

function fingerprintProjection(value) {
  return rccTraverseCanonical(value, (key) => (
    EXCLUDED_FINGERPRINT_KEYS.has(key) || /^(client|local)/i.test(key) || key === 'rcCPilotLocalState'
  ));
}

function computeAuthoritySnapshotFingerprintV1(snapshot) {
  return rccSha256Hex(rccCanonicalSerialize(fingerprintProjection(snapshot)));
}

function verifyAuthoritySnapshotFingerprintV1(snapshot) {
  try {
    const safeSnapshot = rccCanonicalize(snapshot);
    const fingerprint = safeSnapshot.authoritySnapshotFingerprint;
    const revisionId = safeSnapshot.authorityRevisionId;
    if (!/^[0-9a-f]{64}$/.test(fingerprint || '')) return false;
    if (revisionId !== buildAuthorityRevisionIdV1(fingerprint)) return false;
    const actual = computeAuthoritySnapshotFingerprintV1(safeSnapshot);
    return crypto.timingSafeEqual(Buffer.from(actual, 'ascii'), Buffer.from(fingerprint, 'ascii'));
  } catch (_error) {
    return false;
  }
}

function buildAuthorityRevisionIdV1(fingerprint) {
  if (!/^[0-9a-f]{64}$/.test(fingerprint || '')) throw new TypeError('RCC authority fingerprint must be 64 lowercase hexadecimal characters');
  return `rccar_${fingerprint}`;
}

const OBSERVATION_KEYS = Object.freeze([
  'schemaVersion', 'logicalPageCount', 'pagePolygon', 'orientationDegrees', 'skewDegrees',
  'pageAreaRatio', 'quality', 'candidateBands', 'sourceLeaves',
]);
const QUALITY_KEYS = Object.freeze([
  'sharpnessPass', 'contrastPass', 'glareOrSolidClippingRatio', 'materialCompressionDamage',
]);
const CANDIDATE_KEYS = Object.freeze([
  'candidateId', 'rawNumberToken', 'canonicalNumber', 'numberingStyle', 'promptRegionId',
  'promptPolygon', 'answerRegionId', 'answerPolygon', 'answerFormat', 'attemptDisposition',
  'containsCandidateInk', 'contentType',
]);
const SOURCE_LEAF_KEYS = Object.freeze([
  'leafId', 'polygon', 'areaRatio', 'adjacency', 'sourceLeafClass', 'exclusionReason',
  'containsCandidateInk',
]);
const NUMBERING_STYLES = Object.freeze(['dot', 'close_paren', 'q_prefix']);
const ANSWER_FORMATS = Object.freeze([
  'numeric_or_operator', 'tick_or_circle', 'english_up_to_five_words',
]);
const CONTENT_TYPES = Object.freeze([
  'maths_single_line', 'maths_comparison', 'maths_fill', 'maths_multiple_choice',
  'english_spelling', 'english_fill', 'english_true_false', 'english_multiple_choice',
  'non_assessable', 'unsupported',
]);
const EXCLUSION_REASONS = Object.freeze([
  'outer_margin', 'page_header', 'page_footer', 'printed_instruction', 'decoration',
]);

function fail(code, extra = {}) {
  return Object.freeze({ ok: false, diagnostics: Object.freeze([code]), ...extra });
}

function pass(extra = {}) {
  return Object.freeze({ ok: true, diagnostics: Object.freeze([]), ...extra });
}

function exactKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = keys.slice().sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function finiteNumber(value, minimum = -Infinity, maximum = Infinity) {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function normalizePolygonV1(polygon) {
  if (!Array.isArray(polygon) || polygon.length !== 4) return null;
  const points = [];
  for (const point of polygon) {
    if (!exactKeys(point, ['x', 'y']) || !finiteNumber(point.x, 0, 1) || !finiteNumber(point.y, 0, 1)) return null;
    points.push({ x: Object.is(point.x, -0) ? 0 : point.x, y: Object.is(point.y, -0) ? 0 : point.y });
  }
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const box = { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
  const corners = new Set(points.map((point) => `${point.x},${point.y}`));
  if (
    box.minX === box.maxX || box.minY === box.maxY
    || !corners.has(`${box.minX},${box.minY}`) || !corners.has(`${box.maxX},${box.minY}`)
    || !corners.has(`${box.maxX},${box.maxY}`) || !corners.has(`${box.minX},${box.maxY}`)
  ) return null;
  return [
    { x: box.minX, y: box.minY },
    { x: box.maxX, y: box.minY },
    { x: box.maxX, y: box.maxY },
    { x: box.minX, y: box.maxY },
  ];
}

function polygonBoxV1(polygon) {
  const xs = polygon.map((point) => point.x);
  const ys = polygon.map((point) => point.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

function boxAreaV1(box) {
  return Math.max(0, box.maxX - box.minX) * Math.max(0, box.maxY - box.minY);
}

function intersectionAreaV1(left, right) {
  return Math.max(0, Math.min(left.maxX, right.maxX) - Math.max(left.minX, right.minX))
    * Math.max(0, Math.min(left.maxY, right.maxY) - Math.max(left.minY, right.minY));
}

const PNG_CRC_TABLE = Object.freeze(Array.from({ length: 256 }, (_unused, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
}));

function pngCrc32V1(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ PNG_CRC_TABLE[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function pilotImageBoundsDiagnosticV1(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0
    || width > RC_C_MAX_IMAGE_WIDTH || height > RC_C_MAX_IMAGE_HEIGHT) return 'IMAGE_DIMENSIONS_UNSUPPORTED';
  if (width > Math.floor(RC_C_MAX_DECODED_PIXELS / height)) return 'IMAGE_PIXEL_COUNT_EXCEEDED';
  return null;
}

function preflightPilotImageMetadataV1(dataUrl) {
  if (typeof dataUrl !== 'string') return fail('MALFORMED_IMAGE_DATA_URL');
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match || match[2].length % 4 !== 0) {
    if (/^data:image\//.test(dataUrl) && !/^data:image\/(?:jpeg|png|webp);/.test(dataUrl)) return fail('UNSUPPORTED_IMAGE_MIME');
    return fail('MALFORMED_IMAGE_DATA_URL');
  }
  let bytes;
  try {
    bytes = Buffer.from(match[2], 'base64');
    if (!bytes.length || bytes.toString('base64') !== match[2]) return fail('MALFORMED_IMAGE_DATA_URL');
  } catch (_error) {
    return fail('MALFORMED_IMAGE_DATA_URL');
  }
  if (bytes.length > RC_C_MAX_IMAGE_BYTES) return fail('IMAGE_FILE_SIZE_EXCEEDED');
  const mime = match[1];
  const signatureFormat = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
    ? 'image/png'
    : bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8
      ? 'image/jpeg'
      : bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
        ? 'image/webp'
        : null;
  if (signatureFormat && signatureFormat !== mime) return fail('IMAGE_FORMAT_MIME_MISMATCH');
  let width;
  let height;
  if (mime === 'image/png') {
    if (bytes.length < 45 || !bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
      || bytes.readUInt32BE(8) !== 13 || bytes.toString('ascii', 12, 16) !== 'IHDR') return fail('IMAGE_DECODE_FAILED');
    width = bytes.readUInt32BE(16);
    height = bytes.readUInt32BE(20);
    const bitDepth = bytes[24];
    const colorType = bytes[25];
    const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
    if (!channels || bytes[26] !== 0 || bytes[27] !== 0 || bytes[28] !== 0
      || !({ 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] }[colorType]).includes(bitDepth)) return fail('IMAGE_DECODE_FAILED');
    let offset = 8;
    let sawIhdr = false;
    let sawIend = false;
    let sawPlte = false;
    let sawIdat = false;
    let endedIdatRun = false;
    const idat = [];
    while (offset + 12 <= bytes.length) {
      const length = bytes.readUInt32BE(offset);
      if (length > RC_C_MAX_IMAGE_BYTES || length > bytes.length - offset - 12) return fail('IMAGE_DECODE_FAILED');
      const end = offset + 12 + length;
      const type = bytes.toString('ascii', offset + 4, offset + 8);
      if (!/^[A-Za-z]{4}$/.test(type)) return fail('IMAGE_DECODE_FAILED');
      const crcExpected = bytes.readUInt32BE(offset + 8 + length);
      const crcActual = pngCrc32V1(bytes.subarray(offset + 4, offset + 8 + length));
      if (crcExpected !== crcActual) return fail('IMAGE_DECODE_FAILED');
      if (type === 'IHDR') {
        if (sawIhdr || offset !== 8 || length !== 13) return fail('IMAGE_DECODE_FAILED');
        sawIhdr = true;
      } else if (!sawIhdr) return fail('IMAGE_DECODE_FAILED');
      else if (type === 'PLTE') {
        if (sawPlte || sawIdat || length < 3 || length > 768 || length % 3 !== 0 || [0, 4].includes(colorType)) return fail('IMAGE_DECODE_FAILED');
        sawPlte = true;
      } else if (type === 'IDAT') {
        if (endedIdatRun || (colorType === 3 && !sawPlte)) return fail('IMAGE_DECODE_FAILED');
        sawIdat = true;
        idat.push(bytes.subarray(offset + 8, offset + 8 + length));
      }
      else if (type === 'IEND') {
        if (!sawIdat || length !== 0 || end !== bytes.length) return fail('IMAGE_DECODE_FAILED');
        sawIend = true;
        break;
      } else {
        if (type[0] === type[0].toUpperCase()) return fail('IMAGE_DECODE_FAILED');
        if (sawIdat) endedIdatRun = true;
      }
      offset = end;
    }
    if (!sawIhdr || !sawIend || !sawIdat || !idat.length || (colorType === 3 && !sawPlte)) return fail('IMAGE_DECODE_FAILED');
    const boundsDiagnostic = pilotImageBoundsDiagnosticV1(width, height);
    if (boundsDiagnostic) return fail(boundsDiagnostic);
    const rowBytes = Math.ceil(width * channels * bitDepth / 8);
    const expectedInflatedLength = height * (rowBytes + 1);
    if (!Number.isSafeInteger(expectedInflatedLength) || expectedInflatedLength > 100000000) return fail('IMAGE_DECODE_FAILED');
    try {
      const inflated = zlib.inflateSync(Buffer.concat(idat), { maxOutputLength: expectedInflatedLength + 1 });
      if (inflated.length !== expectedInflatedLength) return fail('IMAGE_DECODE_FAILED');
      for (let row = 0; row < height; row += 1) if (inflated[row * (rowBytes + 1)] > 4) return fail('IMAGE_DECODE_FAILED');
    } catch (_error) {
      return fail('IMAGE_DECODE_FAILED');
    }
  } else if (mime === 'image/jpeg') {
    if (bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) return fail('IMAGE_DECODE_FAILED');
    let offset = 2;
    let sawSof = false;
    let sawSos = false;
    let sawDqt = false;
    let sawDht = false;
    let frameComponents = null;
    let scanDataBytes = 0;
    const quantizationTables = new Set();
    const dcHuffmanTables = new Set();
    const acHuffmanTables = new Set();
    while (offset + 3 < bytes.length - 2) {
      if (bytes[offset] !== 0xff) return fail('IMAGE_DECODE_FAILED');
      while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
      if (offset >= bytes.length - 2) return fail('IMAGE_DECODE_FAILED');
      const marker = bytes[offset++];
      if (marker === 0x00 || marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) return fail('IMAGE_DECODE_FAILED');
      if (offset + 2 > bytes.length) return fail('IMAGE_DECODE_FAILED');
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || length > bytes.length - offset) return fail('IMAGE_DECODE_FAILED');
      if (marker === 0xda) {
        if (!sawSof || !sawDqt || !sawDht || sawSos || !frameComponents) return fail('IMAGE_DECODE_FAILED');
        const componentCount = bytes[offset + 2];
        if (componentCount < 1 || componentCount !== frameComponents.size || length !== 6 + 2 * componentCount) return fail('IMAGE_DECODE_FAILED');
        const scanIds = new Set();
        for (let index = 0; index < componentCount; index += 1) {
          const componentId = bytes[offset + 3 + index * 2];
          const tables = bytes[offset + 4 + index * 2];
          if (!frameComponents.has(componentId) || scanIds.has(componentId) || !quantizationTables.has(frameComponents.get(componentId))
            || !dcHuffmanTables.has(tables >> 4) || !acHuffmanTables.has(tables & 0x0f)) return fail('IMAGE_DECODE_FAILED');
          scanIds.add(componentId);
        }
        if (bytes[offset + length - 3] !== 0 || bytes[offset + length - 2] !== 63 || bytes[offset + length - 1] !== 0) return fail('IMAGE_DECODE_FAILED');
        sawSos = true;
        offset += length;
        while (offset < bytes.length - 2) {
          if (bytes[offset] !== 0xff) {
            scanDataBytes += 1;
            offset += 1;
            continue;
          }
          if (offset + 1 >= bytes.length - 2) return fail('IMAGE_DECODE_FAILED');
          const next = bytes[offset + 1];
          if (next === 0x00) {
            scanDataBytes += 1;
            offset += 2;
            continue;
          }
          if (next >= 0xd0 && next <= 0xd7) {
            offset += 2;
            continue;
          }
          return fail('IMAGE_DECODE_FAILED');
        }
        break;
      }
      if (marker === 0xc0) {
        if (sawSof || length < 11 || bytes[offset + 2] !== 8) return fail('IMAGE_DECODE_FAILED');
        const componentCount = bytes[offset + 7];
        if (![1, 3].includes(componentCount) || length !== 8 + 3 * componentCount) return fail('IMAGE_DECODE_FAILED');
        height = bytes.readUInt16BE(offset + 3);
        width = bytes.readUInt16BE(offset + 5);
        frameComponents = new Map();
        for (let index = 0; index < componentCount; index += 1) {
          const componentId = bytes[offset + 8 + index * 3];
          const sampling = bytes[offset + 9 + index * 3];
          const quantTable = bytes[offset + 10 + index * 3];
          if (frameComponents.has(componentId) || (sampling >> 4) < 1 || (sampling >> 4) > 4 || (sampling & 0x0f) < 1 || (sampling & 0x0f) > 4 || quantTable > 3) return fail('IMAGE_DECODE_FAILED');
          frameComponents.set(componentId, quantTable);
        }
        sawSof = true;
      } else if ([0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) return fail('IMAGE_DECODE_FAILED');
      else if (marker === 0xdb) {
        let position = offset + 2;
        while (position < offset + length) {
          const precisionAndId = bytes[position++];
          const tableBytes = (precisionAndId >> 4) === 0 ? 64 : (precisionAndId >> 4) === 1 ? 128 : 0;
          if (!tableBytes || (precisionAndId & 0x0f) > 3 || position + tableBytes > offset + length) return fail('IMAGE_DECODE_FAILED');
          quantizationTables.add(precisionAndId & 0x0f);
          position += tableBytes;
        }
        if (position !== offset + length) return fail('IMAGE_DECODE_FAILED');
        sawDqt = true;
      } else if (marker === 0xc4) {
        let position = offset + 2;
        while (position < offset + length) {
          const table = bytes[position++];
          if ((table >> 4) > 1 || (table & 0x0f) > 3 || position + 16 > offset + length) return fail('IMAGE_DECODE_FAILED');
          let symbols = 0;
          for (let index = 0; index < 16; index += 1) symbols += bytes[position + index];
          position += 16;
          if (!symbols || position + symbols > offset + length) return fail('IMAGE_DECODE_FAILED');
          position += symbols;
          ((table >> 4) === 0 ? dcHuffmanTables : acHuffmanTables).add(table & 0x0f);
        }
        if (position !== offset + length) return fail('IMAGE_DECODE_FAILED');
        sawDht = true;
      } else if (![0xe0, 0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xeb, 0xec, 0xed, 0xee, 0xef, 0xfe].includes(marker)) return fail('IMAGE_DECODE_FAILED');
      offset += length;
    }
    if (!sawSof || !sawSos || !scanDataBytes || offset !== bytes.length - 2) return fail('IMAGE_DECODE_FAILED');
    const boundsDiagnostic = pilotImageBoundsDiagnosticV1(width, height);
    if (boundsDiagnostic) return fail(boundsDiagnostic);
  } else {
    if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'RIFF'
      || bytes.toString('ascii', 8, 12) !== 'WEBP' || bytes.readUInt32LE(4) + 8 !== bytes.length) return fail('IMAGE_DECODE_FAILED');
    let offset = 12;
    let vp8xDimensions = null;
    let imageDimensions = null;
    let imageDataKind = null;
    let chunkIndex = 0;
    let alphaSeen = false;
    const chunkKinds = new Set();
    while (offset < bytes.length) {
      if (offset + 8 > bytes.length) return fail('IMAGE_DECODE_FAILED');
      const kind = bytes.toString('ascii', offset, offset + 4);
      const length = bytes.readUInt32LE(offset + 4);
      const paddedLength = length + (length & 1);
      if (length > RC_C_MAX_IMAGE_BYTES || paddedLength > bytes.length - offset - 8) return fail('IMAGE_DECODE_FAILED');
      const start = offset + 8;
      const end = start + length;
      if ((length & 1) && bytes[end] !== 0) return fail('IMAGE_DECODE_FAILED');
      if (chunkKinds.has(kind) && ['VP8X', 'VP8 ', 'VP8L', 'ALPH', 'ICCP', 'EXIF', 'XMP '].includes(kind)) return fail('IMAGE_DECODE_FAILED');
      chunkKinds.add(kind);
      if (kind === 'VP8X') {
        if (chunkIndex !== 0 || vp8xDimensions || length !== 10 || (bytes[start] & ~0x3c) !== 0
          || bytes[start + 1] !== 0 || bytes[start + 2] !== 0 || bytes[start + 3] !== 0) return fail('IMAGE_DECODE_FAILED');
        vp8xDimensions = { width: 1 + bytes.readUIntLE(start + 4, 3), height: 1 + bytes.readUIntLE(start + 7, 3) };
      } else if (kind === 'VP8 ') {
        if (imageDataKind || length < 11 || (bytes[start] & 1) !== 0
          || bytes[start + 3] !== 0x9d || bytes[start + 4] !== 0x01 || bytes[start + 5] !== 0x2a) return fail('IMAGE_DECODE_FAILED');
        const frameTag = bytes[start] | (bytes[start + 1] << 8) | (bytes[start + 2] << 16);
        if (((frameTag >> 1) & 7) > 3 || ((frameTag >> 4) & 1) !== 1) return fail('IMAGE_DECODE_FAILED');
        const firstPartitionLength = frameTag >>> 5;
        if (!firstPartitionLength || 10 + firstPartitionLength > length) return fail('IMAGE_DECODE_FAILED');
        imageDimensions = { width: bytes.readUInt16LE(start + 6) & 0x3fff, height: bytes.readUInt16LE(start + 8) & 0x3fff };
        imageDataKind = kind;
      } else if (kind === 'VP8L') {
        if (imageDataKind || alphaSeen || length < 6 || bytes[start] !== 0x2f) return fail('IMAGE_DECODE_FAILED');
        const bits = bytes.readUInt32LE(start + 1);
        if ((bits >>> 29) !== 0) return fail('IMAGE_DECODE_FAILED');
        imageDimensions = { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
        imageDataKind = kind;
      } else if (kind === 'ALPH') {
        if (imageDataKind || !vp8xDimensions || length < 2) return fail('IMAGE_DECODE_FAILED');
        alphaSeen = true;
      } else if (kind === 'ANIM' || kind === 'ANMF') return fail('IMAGE_DECODE_FAILED');
      else if (!['ICCP', 'EXIF', 'XMP '].includes(kind)) return fail('IMAGE_DECODE_FAILED');
      offset = end + (length & 1);
      chunkIndex += 1;
    }
    if (offset !== bytes.length || !imageDataKind || !imageDimensions) return fail('IMAGE_DECODE_FAILED');
    if (alphaSeen && (imageDataKind !== 'VP8 ' || !vp8xDimensions || (bytes[20] & 0x10) === 0)) return fail('IMAGE_DECODE_FAILED');
    if (vp8xDimensions && (vp8xDimensions.width !== imageDimensions.width || vp8xDimensions.height !== imageDimensions.height)) return fail('IMAGE_DECODE_FAILED');
    ({ width, height } = imageDimensions);
    const boundsDiagnostic = pilotImageBoundsDiagnosticV1(width, height);
    if (boundsDiagnostic) return fail(boundsDiagnostic);
  }
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return fail('IMAGE_DECODE_FAILED');
  return pass({ metadata: Object.freeze({ mime, width, height, byteLength: bytes.length }), imageBytes: bytes });
}

async function decodePilotImageWithTrustedDecoderV1(imageBytes, expectedMime) {
  if (!Buffer.isBuffer(imageBytes) || !imageBytes.length || imageBytes.length > RC_C_MAX_IMAGE_BYTES) {
    return fail('IMAGE_DECODE_FAILED');
  }
  const expectedFormats = Object.freeze({ 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' });
  if (!Object.prototype.hasOwnProperty.call(expectedFormats, expectedMime)) return fail('UNSUPPORTED_IMAGE_MIME');
  try {
    // Lazy loading keeps feature-off requests independent of the native module.
    // When RC-C is enabled, any load or native failure is caught and fails closed.
    const sharp = require('sharp');
    const pipeline = sharp(imageBytes, {
      failOn: 'warning',
      limitInputPixels: RC_C_MAX_DECODED_PIXELS,
      limitInputChannels: RC_C_MAX_IMAGE_CHANNELS,
      pages: 1,
      animated: false,
      unlimited: false,
      sequentialRead: true,
      ignoreIcc: true,
    });
    const metadata = await pipeline.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format)) return fail('UNSUPPORTED_IMAGE_MIME');
    if (metadata.format !== expectedFormats[expectedMime]) return fail('IMAGE_FORMAT_MIME_MISMATCH');
    const pages = metadata.pages === undefined ? 1 : metadata.pages;
    if (pages !== 1) return fail('IMAGE_DECODE_FAILED');
    const boundsDiagnostic = pilotImageBoundsDiagnosticV1(metadata.width, metadata.height);
    if (boundsDiagnostic) return fail(boundsDiagnostic);
    if (!Number.isInteger(metadata.channels) || metadata.channels < 1 || metadata.channels > RC_C_MAX_IMAGE_CHANNELS) {
      return fail('IMAGE_DECODE_FAILED');
    }
    const decoded = await pipeline.raw().timeout({ seconds: RC_C_DECODE_TIMEOUT_SECONDS }).toBuffer({ resolveWithObject: true });
    if (!decoded || !Buffer.isBuffer(decoded.data) || !decoded.info
      || decoded.info.width !== metadata.width || decoded.info.height !== metadata.height
      || !Number.isInteger(decoded.info.channels) || decoded.info.channels < 1
      || decoded.info.channels > RC_C_MAX_IMAGE_CHANNELS
      || metadata.width > Math.floor(RC_C_MAX_RAW_OUTPUT_BYTES / metadata.height / decoded.info.channels)) {
      return fail('IMAGE_DECODE_FAILED');
    }
    const expectedRawBytes = metadata.width * metadata.height * decoded.info.channels;
    if (decoded.data.length !== expectedRawBytes || decoded.data.length > RC_C_MAX_RAW_OUTPUT_BYTES) return fail('IMAGE_DECODE_FAILED');
    return pass({ metadata: Object.freeze({
      mime: expectedMime,
      width: metadata.width,
      height: metadata.height,
      byteLength: imageBytes.length,
      channels: metadata.channels,
      pages,
      decodedChannels: decoded.info.channels,
      decodedByteLength: decoded.data.length,
    }) });
  } catch (_error) {
    return fail('IMAGE_DECODE_FAILED');
  }
}

async function decodePilotImageMetadataV1(dataUrl) {
  const preflight = preflightPilotImageMetadataV1(dataUrl);
  if (!preflight.ok) return preflight;
  const decoded = await decodePilotImageWithTrustedDecoderV1(preflight.imageBytes, preflight.metadata.mime);
  if (!decoded.ok) return decoded;
  return pass({ metadata: Object.freeze({
    mime: decoded.metadata.mime,
    width: decoded.metadata.width,
    height: decoded.metadata.height,
    byteLength: decoded.metadata.byteLength,
  }), imageBytes: preflight.imageBytes });
}

function validatePilotImageCountV1(images) {
  return Array.isArray(images) && images.length === 1
    ? pass({ imageCount: 1 })
    : fail('PILOT_IMAGE_COUNT_NOT_ONE', { imageCount: Array.isArray(images) ? images.length : null });
}

function normalizePilotObservationV1(observation) {
  if (!exactKeys(observation, OBSERVATION_KEYS)) return fail('OBSERVATION_SCHEMA_INVALID');
  if (observation.schemaVersion !== 1) return fail('OBSERVATION_SCHEMA_VERSION_UNSUPPORTED');
  if (!Number.isInteger(observation.logicalPageCount) || ![0, 90, 180, 270].includes(observation.orientationDegrees)
    || !finiteNumber(observation.skewDegrees) || !finiteNumber(observation.pageAreaRatio, 0, 1)) return fail('OBSERVATION_SCALAR_INVALID');
  const pagePolygon = normalizePolygonV1(observation.pagePolygon);
  if (!pagePolygon) return fail('OBSERVATION_PAGE_POLYGON_INVALID');
  if (!exactKeys(observation.quality, QUALITY_KEYS)
    || typeof observation.quality.sharpnessPass !== 'boolean' || typeof observation.quality.contrastPass !== 'boolean'
    || !finiteNumber(observation.quality.glareOrSolidClippingRatio, 0, 1)
    || typeof observation.quality.materialCompressionDamage !== 'boolean') return fail('OBSERVATION_QUALITY_INVALID');
  if (!Array.isArray(observation.candidateBands) || !Array.isArray(observation.sourceLeaves)) return fail('OBSERVATION_COLLECTION_INVALID');
  const candidateIds = new Set();
  const regionIds = new Set();
  const candidateBands = [];
  for (const band of observation.candidateBands) {
    if (!exactKeys(band, CANDIDATE_KEYS)) return fail('OBSERVATION_CANDIDATE_SCHEMA_INVALID');
    if (typeof band.candidateId !== 'string' || !band.candidateId || candidateIds.has(band.candidateId)) return fail('OBSERVATION_CANDIDATE_ID_INVALID');
    if (typeof band.rawNumberToken !== 'string' || !band.rawNumberToken || !Number.isInteger(band.canonicalNumber) || band.canonicalNumber < 1) return fail('OBSERVATION_NUMBER_INVALID');
    if (!NUMBERING_STYLES.includes(band.numberingStyle)) return fail('OBSERVATION_NUMBERING_STYLE_UNKNOWN');
    if (!ANSWER_FORMATS.includes(band.answerFormat)) {
      if (band.answerFormat === 'free_form_long_answer') return fail('FREE_FORM_LONG_ANSWER_UNSUPPORTED');
      return fail('OBSERVATION_ANSWER_FORMAT_UNKNOWN');
    }
    if (!ENUMS.attemptDisposition.includes(band.attemptDisposition) || typeof band.containsCandidateInk !== 'boolean') return fail('OBSERVATION_ATTEMPT_INVALID');
    if (!CONTENT_TYPES.includes(band.contentType)) {
      const special = { table: 'TABLE_TOPOLOGY_UNSUPPORTED', diagram: 'DIAGRAM_TOPOLOGY_UNSUPPORTED', geometry: 'GEOMETRY_TOPOLOGY_UNSUPPORTED', grouped: 'GROUPED_OR_MULTIPART_UNSUPPORTED', multipart: 'GROUPED_OR_MULTIPART_UNSUPPORTED' };
      return fail(special[band.contentType] || 'OBSERVATION_CONTENT_TYPE_UNKNOWN');
    }
    if (band.contentType === 'unsupported') return fail('UNSUPPORTED_CONTENT_TYPE');
    const promptPolygon = normalizePolygonV1(band.promptPolygon);
    const answerPolygon = band.answerPolygon === null ? null : normalizePolygonV1(band.answerPolygon);
    if (typeof band.promptRegionId !== 'string' || !band.promptRegionId || regionIds.has(band.promptRegionId) || !promptPolygon) return fail('OBSERVATION_PROMPT_REGION_INVALID');
    regionIds.add(band.promptRegionId);
    if (band.answerRegionId === null || band.answerPolygon === null) {
      if (band.answerRegionId !== null || band.answerPolygon !== null || band.attemptDisposition !== 'blank') return fail('OBSERVATION_ANSWER_REGION_INVALID');
    } else if (typeof band.answerRegionId !== 'string' || !band.answerRegionId || regionIds.has(band.answerRegionId) || !answerPolygon) return fail('OBSERVATION_ANSWER_REGION_INVALID');
    else regionIds.add(band.answerRegionId);
    candidateIds.add(band.candidateId);
    candidateBands.push({ ...band, promptPolygon, answerPolygon });
  }
  const leafIds = new Set();
  const sourceLeaves = [];
  for (const leaf of observation.sourceLeaves) {
    if (!exactKeys(leaf, SOURCE_LEAF_KEYS)) return fail('OBSERVATION_SOURCE_LEAF_SCHEMA_INVALID');
    const polygon = normalizePolygonV1(leaf.polygon);
    if (typeof leaf.leafId !== 'string' || !leaf.leafId || leafIds.has(leaf.leafId) || !polygon
      || !finiteNumber(leaf.areaRatio, 0, 1) || !Array.isArray(leaf.adjacency)
      || leaf.adjacency.some((id) => typeof id !== 'string') || new Set(leaf.adjacency).size !== leaf.adjacency.length
      || !ENUMS.sourceLeafClass.includes(leaf.sourceLeafClass) || typeof leaf.containsCandidateInk !== 'boolean') return fail('OBSERVATION_SOURCE_LEAF_INVALID');
    const excluded = leaf.sourceLeafClass === 'excluded_outer_margin';
    if (leaf.sourceLeafClass === 'unsupported' && leaf.exclusionReason !== null) return sourceDomainFailureV1('SOURCE_DOMAIN_UNSUPPORTED_LEAF');
    if ((excluded && !EXCLUSION_REASONS.includes(leaf.exclusionReason)) || (!excluded && leaf.exclusionReason !== null)) return fail('OBSERVATION_EXCLUSION_REASON_INVALID');
    leafIds.add(leaf.leafId);
    sourceLeaves.push({ ...leaf, polygon, adjacency: leaf.adjacency.slice() });
  }
  if (sourceLeaves.some((leaf) => leaf.adjacency.some((id) => !leafIds.has(id)))) return fail('OBSERVATION_SOURCE_ADJACENCY_INVALID');
  const normalizedObservation = rccCanonicalize({
    schemaVersion: 1,
    logicalPageCount: observation.logicalPageCount,
    pagePolygon,
    orientationDegrees: observation.orientationDegrees,
    skewDegrees: Object.is(observation.skewDegrees, -0) ? 0 : observation.skewDegrees,
    pageAreaRatio: observation.pageAreaRatio,
    quality: { ...observation.quality },
    candidateBands,
    sourceLeaves,
  });
  return pass({ normalizedObservation });
}

function assessableBandsV1(observation) {
  return observation.candidateBands.filter((band) => band.contentType !== 'non_assessable');
}

function validatePilotEnvelopeV1(imageMetadata, observation) {
  if (!imageMetadata || !Number.isInteger(imageMetadata.width) || !Number.isInteger(imageMetadata.height)) return fail('IMAGE_METADATA_INVALID');
  if (!observation || !Array.isArray(observation.pagePolygon) || !observation.quality
    || !Array.isArray(observation.candidateBands)) return fail('ENVELOPE_OBSERVATION_INVALID');
  const shortEdge = Math.min(imageMetadata.width, imageMetadata.height);
  const longEdge = Math.max(imageMetadata.width, imageMetadata.height);
  if (shortEdge < 1200 || shortEdge > 4000 || longEdge > 6000) return fail('IMAGE_DIMENSIONS_UNSUPPORTED');
  if (imageMetadata.width * imageMetadata.height > 20000000) return fail('IMAGE_PIXEL_COUNT_EXCEEDED');
  if (!observation || observation.logicalPageCount !== 1) return fail('LOGICAL_PAGE_COUNT_UNSUPPORTED');
  if (![0, 90, 180, 270].includes(observation.orientationDegrees)) return fail('ORIENTATION_UNSUPPORTED');
  if (!finiteNumber(observation.skewDegrees) || Math.abs(observation.skewDegrees) > 3) return fail('SKEW_EXCEEDS_LIMIT');
  if (!finiteNumber(observation.pageAreaRatio, 0.55, 0.98)) return fail('PAGE_AREA_RATIO_UNSUPPORTED');
  if (!observation.quality.sharpnessPass) return fail('QUALITY_SHARPNESS_FAILED');
  if (!observation.quality.contrastPass) return fail('QUALITY_CONTRAST_FAILED');
  if (observation.quality.glareOrSolidClippingRatio > RC_C_MAX_GLARE_OR_SOLID_CLIPPING_RATIO) return fail('GLARE_OR_SOLID_CLIPPING_EXCEEDED');
  if (observation.quality.materialCompressionDamage) return fail('MATERIAL_COMPRESSION_DAMAGE');
  const pageBox = polygonBoxV1(observation.pagePolygon);
  if (pageBox.minX <= 0 || pageBox.minY <= 0 || pageBox.maxX >= 1 || pageBox.maxY >= 1) return fail('PAGE_EDGE_CLIPPED');
  const assessable = assessableBandsV1(observation);
  if (assessable.length < 1 || assessable.length > 12) return fail('ASSESSABLE_ITEM_COUNT_UNSUPPORTED');
  const promptBoxes = [];
  for (const band of assessable) {
    for (const polygon of [band.promptPolygon, band.answerPolygon].filter(Boolean)) {
      const box = polygonBoxV1(polygon);
      if (box.minX <= pageBox.minX || box.minY <= pageBox.minY || box.maxX >= pageBox.maxX || box.maxY >= pageBox.maxY) return fail('REGION_TOUCHES_PAGE_BOUNDARY');
    }
    promptBoxes.push(polygonBoxV1(band.promptPolygon));
  }
  const commonLeft = Math.max(...promptBoxes.map((box) => box.minX));
  const commonRight = Math.min(...promptBoxes.map((box) => box.maxX));
  if (commonLeft >= commonRight) return fail('MULTIPLE_READING_COLUMNS');
  return pass({ envelope: rccCanonicalize({
    imageWidth: imageMetadata.width, imageHeight: imageMetadata.height, logicalPageCount: 1,
    assessableItemCount: assessable.length, orientationDegrees: observation.orientationDegrees,
    skewDegrees: observation.skewDegrees, pageAreaRatio: observation.pageAreaRatio,
    qualityThresholdVersion: RC_C_QUALITY_THRESHOLD_VERSION, accepted: true,
  }) });
}

function parseNumberTokenV1(token, style) {
  const patterns = { dot: /^([1-9][0-9]*)\.$/, close_paren: /^([1-9][0-9]*)\)$/, q_prefix: /^[Qq]([1-9][0-9]*)$/ };
  const match = patterns[style].exec(token.trim());
  return match ? Number(match[1]) : null;
}

function enumerateNumberedBandsBoundedV1(observation, identityContext, maximumItems) {
  if (!observation || !Array.isArray(observation.candidateBands)) return fail('ENUMERATION_INPUT_INVALID');
  const sourceImageFingerprint = identityContext && identityContext.sourceImageFingerprint;
  const methodVersion = identityContext && identityContext.methodVersion;
  if (!/^[0-9a-f]{64}$/.test(sourceImageFingerprint || '') || typeof methodVersion !== 'string' || !methodVersion) return fail('ENUMERATION_IDENTITY_CONTEXT_INVALID');
  const bands = assessableBandsV1(observation);
  if (bands.length < 1 || bands.length > maximumItems) return fail('ASSESSABLE_ITEM_COUNT_UNSUPPORTED');
  const styles = new Set(bands.map((band) => band.numberingStyle));
  if (styles.size !== 1) return fail('MIXED_NUMBERING_STYLES');
  const numbers = [];
  for (const band of bands) {
    const parsed = parseNumberTokenV1(band.rawNumberToken, band.numberingStyle);
    if (parsed === null || parsed !== band.canonicalNumber) return fail('NUMBER_TOKEN_MISMATCH');
    numbers.push(parsed);
  }
  if (new Set(numbers).size !== numbers.length) return fail('DUPLICATE_CANONICAL_NUMBER');
  for (let index = 1; index < numbers.length; index += 1) {
    if (numbers[index] !== numbers[index - 1] + 1) return fail('NUMBER_SEQUENCE_GAP');
  }
  const candidateRegions = bands.flatMap((band) => [band.promptPolygon, band.answerPolygon].filter(Boolean).map(polygonBoxV1));
  for (let left = 0; left < candidateRegions.length; left += 1) {
    for (let right = left + 1; right < candidateRegions.length; right += 1) {
      if (intersectionAreaV1(candidateRegions[left], candidateRegions[right]) > 0) return fail('AMBIGUOUS_OR_OVERLAPPING_CANDIDATE_BANDS');
    }
  }
  const itemLedger = bands.map((band, sourceOrder) => {
    const itemIdentity = {
      sourceImageFingerprint,
      methodVersion,
      sourceOrder,
      canonicalNumber: band.canonicalNumber,
      numberingStyle: band.numberingStyle,
      contentType: band.contentType,
      answerFormat: band.answerFormat,
      promptPolygon: band.promptPolygon,
      answerPolygon: band.answerPolygon,
    };
    const itemId = `rcci_${rccSha256Hex(rccCanonicalSerialize(itemIdentity))}`;
    const promptRegionId = `rccpr_${rccSha256Hex(rccCanonicalSerialize({ ...itemIdentity, regionRole: 'prompt', regionPolygon: band.promptPolygon }))}`;
    const answerRegionId = band.answerPolygon
      ? `rccar_${rccSha256Hex(rccCanonicalSerialize({ ...itemIdentity, regionRole: 'answer', regionPolygon: band.answerPolygon }))}`
      : null;
    return rccCanonicalize({
      itemId,
      promptRegionId,
      answerRegionId,
      sourceCandidateId: band.candidateId,
      sourceOrder,
      canonicalNumber: band.canonicalNumber,
      numberingStyle: band.numberingStyle,
      promptPolygon: band.promptPolygon,
      answerPolygon: band.answerPolygon,
      answerFormat: band.answerFormat,
      attemptDisposition: band.attemptDisposition,
      contentType: band.contentType,
    });
  });
  const validation = validatePilotItemSequenceV1(itemLedger);
  return validation.ok ? pass({ itemLedger: Object.freeze(itemLedger) }) : validation;
}

function enumerateNumberedBandsV1(observation, identityContext) {
  return enumerateNumberedBandsBoundedV1(observation, identityContext, 12);
}

function enumerateNumberedBandsForQ16FixtureV1(observation, identityContext) {
  return enumerateNumberedBandsBoundedV1(observation, identityContext, 16);
}

function validatePilotItemSequenceV1(itemLedger) {
  if (!Array.isArray(itemLedger) || itemLedger.length < 1 || itemLedger.length > 16) return fail('ITEM_LEDGER_CARDINALITY_INVALID');
  const itemIds = new Set();
  const regionIds = new Set();
  for (let index = 0; index < itemLedger.length; index += 1) {
    const item = itemLedger[index];
    if (!item || item.sourceOrder !== index || (index > 0 && item.canonicalNumber !== itemLedger[index - 1].canonicalNumber + 1)) return fail('ITEM_SEQUENCE_INVALID');
    if (itemIds.has(item.itemId) || regionIds.has(item.promptRegionId) || (item.answerRegionId && regionIds.has(item.answerRegionId))) return fail('ITEM_IDENTITY_NOT_UNIQUE');
    if (item.attemptDisposition === 'answered' && (!item.answerRegionId || !item.answerPolygon)) return fail('ANSWERED_ITEM_REGION_MISSING');
    if (item.attemptDisposition === 'blank' && ((item.answerRegionId === null) !== (item.answerPolygon === null))) return fail('BLANK_ITEM_REGION_INVALID');
    itemIds.add(item.itemId);
    regionIds.add(item.promptRegionId);
    if (item.answerRegionId) regionIds.add(item.answerRegionId);
  }
  return pass({ itemCount: itemLedger.length });
}

function validateOnePageTopologyV1(observation, itemLedger) {
  if (!observation || observation.logicalPageCount !== 1) return fail('TOPOLOGY_LOGICAL_PAGE_COUNT_UNSUPPORTED');
  const sequence = validatePilotItemSequenceV1(itemLedger);
  if (!sequence.ok) return sequence;
  const pageBox = polygonBoxV1(observation.pagePolygon);
  const regions = [];
  for (const item of itemLedger) {
    for (const [kind, polygon] of [['prompt', item.promptPolygon], ['answer', item.answerPolygon]]) {
      if (!polygon) continue;
      const box = polygonBoxV1(polygon);
      if (box.minX <= pageBox.minX || box.minY <= pageBox.minY || box.maxX >= pageBox.maxX || box.maxY >= pageBox.maxY) return fail('TOPOLOGY_REGION_CROSSES_PAGE_BOUNDARY');
      regions.push({ itemId: item.itemId, kind, box });
    }
  }
  for (let left = 0; left < regions.length; left += 1) {
    for (let right = left + 1; right < regions.length; right += 1) {
      if (intersectionAreaV1(regions[left].box, regions[right].box) > 0) return fail('TOPOLOGY_REGION_OVERLAP');
    }
  }
  const promptBoxes = itemLedger.map((item) => polygonBoxV1(item.promptPolygon));
  if (Math.max(...promptBoxes.map((box) => box.minX)) >= Math.min(...promptBoxes.map((box) => box.maxX))) return fail('MULTIPLE_READING_COLUMNS');
  return pass({ topology: rccCanonicalize({
    sourceImageCount: 1, logicalPageCount: 1, readingColumnCount: 1,
    itemCount: itemLedger.length, pageTopologyState: 'resolved',
    geometryToleranceVersion: RC_C_GEOMETRY_TOLERANCE_VERSION,
  }) });
}

function sourceDomainFailureV1(code, state = 'unresolved') {
  return fail(code, {
    sourceDomainAccountingState: state,
    method_exhausted: false,
    coverageAssuranceLevel: 'unknown',
    limitations: Object.freeze([INDEPENDENT_SOURCE_COMPLETENESS_LIMITATION]),
  });
}

function partitionSourceDomainV1(observation) {
  if (!observation || !Array.isArray(observation.sourceLeaves)) return fail('SOURCE_DOMAIN_INPUT_INVALID');
  if (observation.sourceLeaves.some((leaf) => leaf.sourceLeafClass === 'unsupported')) return sourceDomainFailureV1('SOURCE_DOMAIN_UNSUPPORTED_LEAF');
  if (observation.sourceLeaves.some((leaf) => leaf.sourceLeafClass === 'unresolved')) return sourceDomainFailureV1('SOURCE_DOMAIN_UNRESOLVED_LEAF');
  const pageBox = polygonBoxV1(observation.pagePolygon);
  const pageArea = boxAreaV1(pageBox);
  if (!(pageArea > 0)) return fail('SOURCE_DOMAIN_PAGE_INVALID');
  const leaves = observation.sourceLeaves.map((leaf) => ({
    ...leaf,
    box: polygonBoxV1(leaf.polygon),
  }));
  if (leaves.some((leaf) => leaf.box.minX < pageBox.minX || leaf.box.minY < pageBox.minY || leaf.box.maxX > pageBox.maxX || leaf.box.maxY > pageBox.maxY)) return fail('SOURCE_LEAF_OUTSIDE_PAGE_DOMAIN');
  if (leaves.some((leaf) => Math.abs(leaf.areaRatio - boxAreaV1(leaf.box) / pageArea) > 1e-9)) return fail('SOURCE_LEAF_AREA_RATIO_INVALID');
  for (let left = 0; left < leaves.length; left += 1) {
    const actual = [];
    for (let right = 0; right < leaves.length; right += 1) {
      if (left === right) continue;
      const a = leaves[left].box;
      const b = leaves[right].box;
      const verticalEdge = (a.maxX === b.minX || b.maxX === a.minX) && Math.min(a.maxY, b.maxY) > Math.max(a.minY, b.minY);
      const horizontalEdge = (a.maxY === b.minY || b.maxY === a.minY) && Math.min(a.maxX, b.maxX) > Math.max(a.minX, b.minX);
      if (verticalEdge || horizontalEdge) actual.push(leaves[right].leafId);
    }
    if (actual.sort().join('\u0000') !== leaves[left].adjacency.slice().sort().join('\u0000')) return fail('SOURCE_DOMAIN_ADJACENCY_INVALID');
  }
  const xs = [...new Set([pageBox.minX, pageBox.maxX, ...leaves.flatMap((leaf) => [leaf.box.minX, leaf.box.maxX])])].sort((a, b) => a - b);
  const ys = [...new Set([pageBox.minY, pageBox.maxY, ...leaves.flatMap((leaf) => [leaf.box.minY, leaf.box.maxY])])].sort((a, b) => a - b);
  let uncoveredArea = 0;
  let overlapArea = 0;
  const uncoveredCells = [];
  for (let xi = 0; xi < xs.length - 1; xi += 1) {
    for (let yi = 0; yi < ys.length - 1; yi += 1) {
      const cell = { minX: xs[xi], maxX: xs[xi + 1], minY: ys[yi], maxY: ys[yi + 1] };
      if (cell.minX < pageBox.minX || cell.maxX > pageBox.maxX || cell.minY < pageBox.minY || cell.maxY > pageBox.maxY) continue;
      const area = boxAreaV1(cell);
      const covering = leaves.filter((leaf) => leaf.box.minX <= cell.minX && leaf.box.maxX >= cell.maxX && leaf.box.minY <= cell.minY && leaf.box.maxY >= cell.maxY);
      if (!covering.length) {
        uncoveredArea += area;
        uncoveredCells.push(cell);
      } else if (covering.length > 1) overlapArea += area * (covering.length - 1);
    }
  }
  const candidateBoxes = observation.candidateBands.filter((band) => band.containsCandidateInk).flatMap((band) => [band.promptPolygon, band.answerPolygon].filter(Boolean).map(polygonBoxV1));
  const uncoveredContainsCandidateInk = uncoveredCells.some((cell) => candidateBoxes.some((box) => intersectionAreaV1(cell, box) > 0));
  const uncoveredAreaRatio = uncoveredArea / pageArea;
  const overlapAreaRatio = overlapArea / pageArea;
  const components = [];
  const remaining = new Set(uncoveredCells.map((_cell, index) => index));
  while (remaining.size) {
    const pending = [remaining.values().next().value];
    remaining.delete(pending[0]);
    let componentArea = 0;
    while (pending.length) {
      const index = pending.pop();
      const cell = uncoveredCells[index];
      componentArea += boxAreaV1(cell);
      for (const otherIndex of Array.from(remaining)) {
        const other = uncoveredCells[otherIndex];
        const verticalEdge = (cell.maxX === other.minX || other.maxX === cell.minX)
          && Math.min(cell.maxY, other.maxY) > Math.max(cell.minY, other.minY);
        const horizontalEdge = (cell.maxY === other.minY || other.maxY === cell.minY)
          && Math.min(cell.maxX, other.maxX) > Math.max(cell.minX, other.minX);
        if (verticalEdge || horizontalEdge) {
          remaining.delete(otherIndex);
          pending.push(otherIndex);
        }
      }
    }
    components.push(componentArea / pageArea);
  }
  const sourceDomain = rccCanonicalize({
    methodVersion: RC_C_SOURCE_ACCOUNTING_METHOD_VERSION,
    transformVersion: RC_C_GEOMETRY_TOLERANCE_VERSION,
    toleranceVersion: RC_C_SOURCE_ACCOUNTING_TOLERANCE_VERSION,
    pageDomain: pageBox,
    leaves: leaves.map(({ box, ...leaf }) => ({ ...leaf, normalizedBox: box })),
    uncoveredAreaRatio,
    largestConnectedUncoveredComponentRatio: components.length ? Math.max(...components) : 0,
    uncoveredContainsCandidateInk,
    leafInteriorOverlapRatio: overlapAreaRatio,
    allTransformsAndTolerancesCurrent: true,
  });
  return pass({ sourceDomain });
}

function accountSourceDomainV1(sourceDomain) {
  if (!sourceDomain || sourceDomain.methodVersion !== RC_C_SOURCE_ACCOUNTING_METHOD_VERSION
    || sourceDomain.transformVersion !== RC_C_GEOMETRY_TOLERANCE_VERSION
    || sourceDomain.toleranceVersion !== RC_C_SOURCE_ACCOUNTING_TOLERANCE_VERSION
    || sourceDomain.allTransformsAndTolerancesCurrent !== true) return fail('SOURCE_DOMAIN_METHOD_OR_TRANSFORM_STALE', {
    sourceDomainAccountingState: 'stale', method_exhausted: false,
    coverageAssuranceLevel: 'unknown',
    limitations: Object.freeze([INDEPENDENT_SOURCE_COMPLETENESS_LIMITATION]),
  });
  const unsupportedLeaf = sourceDomain.leaves.some((leaf) => leaf.sourceLeafClass === 'unsupported');
  const unresolvedLeaf = sourceDomain.leaves.some((leaf) => leaf.sourceLeafClass === 'unresolved');
  const undeclaredExclusion = sourceDomain.leaves.some((leaf) => leaf.sourceLeafClass === 'excluded_outer_margin' && !EXCLUSION_REASONS.includes(leaf.exclusionReason));
  const excludedCandidateInk = sourceDomain.leaves.some((leaf) => leaf.sourceLeafClass === 'excluded_outer_margin' && leaf.containsCandidateInk);
  let code = null;
  if (unsupportedLeaf) code = 'SOURCE_DOMAIN_UNSUPPORTED_LEAF';
  else if (unresolvedLeaf) code = 'SOURCE_DOMAIN_UNRESOLVED_LEAF';
  else if (undeclaredExclusion) code = 'SOURCE_DOMAIN_EXCLUSION_UNDECLARED';
  else if (sourceDomain.uncoveredContainsCandidateInk || excludedCandidateInk) code = 'SOURCE_DOMAIN_GAP_UNRESOLVED';
  else if (sourceDomain.uncoveredAreaRatio > 0.005) code = 'SOURCE_DOMAIN_UNCOVERED_AREA_EXCEEDED';
  else if (sourceDomain.largestConnectedUncoveredComponentRatio > 0.0025) code = 'SOURCE_DOMAIN_UNCOVERED_COMPONENT_EXCEEDED';
  else if (sourceDomain.leafInteriorOverlapRatio > 0.001) code = 'SOURCE_DOMAIN_OVERLAP_EXCEEDED';
  const limitations = Object.freeze([INDEPENDENT_SOURCE_COMPLETENESS_LIMITATION]);
  if (code) return fail(code, { sourceDomainAccountingState: 'unresolved', method_exhausted: false, coverageAssuranceLevel: 'unknown', limitations });
  return pass({
    sourceDomainAccounting: rccCanonicalize({
      sourceDomainAccountingState: 'accounted', method_exhausted: true,
      uncoveredAreaRatio: sourceDomain.uncoveredAreaRatio,
      largestConnectedUncoveredComponentRatio: sourceDomain.largestConnectedUncoveredComponentRatio,
      uncoveredContainsCandidateInk: false,
      leafInteriorOverlapRatio: sourceDomain.leafInteriorOverlapRatio,
      limitations: [INDEPENDENT_SOURCE_COMPLETENESS_LIMITATION],
    }),
  });
}

function computeSourceImageFingerprintV1(imageBytes) {
  if (!Buffer.isBuffer(imageBytes) && !(imageBytes instanceof Uint8Array)) throw new TypeError('RCC source image bytes required');
  return crypto.createHash('sha256').update(imageBytes).digest('hex');
}

function computeEffectiveInputFingerprintV1(inputs) {
  if (!inputs || typeof inputs !== 'object') throw new TypeError('RCC effective inputs required');
  const covered = {
    sourceImageFingerprint: inputs.sourceImageFingerprint,
    normalizedObservation: inputs.normalizedObservation,
    methodVersions: inputs.methodVersions,
    transform: inputs.transform,
    toleranceVersions: inputs.toleranceVersions,
    envelopeResult: inputs.envelopeResult,
    itemLedger: inputs.itemLedger,
    topology: inputs.topology,
    sourceDomain: inputs.sourceDomain,
    sourceDomainAccountingInputs: inputs.sourceDomainAccountingInputs === undefined
      ? inputs.sourceDomain
      : inputs.sourceDomainAccountingInputs,
  };
  return rccSha256Hex(rccCanonicalSerialize(covered));
}

function buildFailClosedStructureStateV1(code) {
  if (typeof code !== 'string' || !/^[A-Z0-9_]+$/.test(code)) throw new TypeError('RCC closed diagnostic required');
  const mismatch = code === 'SOURCE_DOMAIN_GAP_UNRESOLVED';
  const serverClass = mismatch ? 'reconciliation_mismatched' : 'structural_unknown';
  return rccCanonicalize({
    diagnostic: code,
    enumerationState: 'unresolved',
    pageTopologyState: 'unsupported',
    sourceDomainAccountingState: 'unresolved',
    method_exhausted: false,
    reconciliationState: mismatch ? 'reconciliation_mismatched' : 'not_available',
    coverageAssuranceLevel: 'unknown',
    serverStructuralUseClass: serverClass,
    localEffectiveUseClass: { kind: 'use_server_class', serverClass },
    positiveParentDisplayProhibited: true,
    limitations: [INDEPENDENT_SOURCE_COMPLETENESS_LIMITATION],
  });
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
  decodePilotImageMetadataV1,
  decodePilotImageWithTrustedDecoderV1,
  validatePilotImageCountV1,
  normalizePilotObservationV1,
  validatePilotEnvelopeV1,
  enumerateNumberedBandsV1,
  validatePilotItemSequenceV1,
  validateOnePageTopologyV1,
  partitionSourceDomainV1,
  accountSourceDomainV1,
  computeSourceImageFingerprintV1,
  computeEffectiveInputFingerprintV1,
  buildFailClosedStructureStateV1,
});

exports.service = service;
exports.__rccTest = Object.freeze({
  ...service,
  enumerateNumberedBandsForQ16FixtureV1,
  RC_C_CONTRACT_VERSION,
  RC_C_SCHEMA_VERSION,
  RC_C_ENUMERATION_METHOD_VERSION,
  RC_C_QUALITY_THRESHOLD_VERSION,
  RC_C_GEOMETRY_TOLERANCE_VERSION,
  RC_C_AUTHORITY_ISSUER,
  RC_C_CANONICAL_MAX_DEPTH,
  RC_C_MAX_IMAGE_BYTES,
  RC_C_MAX_GLARE_OR_SOLID_CLIPPING_RATIO,
  RC_C_SOURCE_ACCOUNTING_METHOD_VERSION,
  RC_C_SOURCE_ACCOUNTING_TOLERANCE_VERSION,
  INDEPENDENT_SOURCE_COMPLETENESS_LIMITATION,
  ENUMS,
  REQUIRED_SERVER_FIELDS,
});
