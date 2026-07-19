'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { service } = require('../netlify/functions/rc-c-pilot');
const analyzeTest = require('../netlify/functions/analyze-homework').__rccTest;

const FIXTURES = path.join(__dirname, 'fixtures', 'rc-c-pilot');
const acceptedFixture = readJson('envelope', 'accepted-single-page.json');
const rejectedFixture = readJson('envelope', 'unsupported-cases.json');
const sourceCases = readJson('source-domain', 'gap-overlap-cases.json');
const q16Gold = readJson('q16-source-gap', 'worksheet-q16-source.gold.json');
const q16Mutation = readJson('q16-source-gap', 'worksheet-q16-source-gap.mutation.json');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${passed} - ${name}`);
  } catch (error) {
    console.error(`FAIL - ${name}`);
    throw error;
  }
}

function readJson(...parts) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, ...parts), 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function rect(minX, minY, maxX, maxY) {
  return [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }];
}

function observation() {
  return clone(acceptedFixture.baseObservation);
}

function candidates(count, lastRegion) {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const y = lastRegion && number === count ? lastRegion.minY : 0.08 + index * (0.78 / Math.max(count, 16));
    const height = lastRegion && number === count ? lastRegion.maxY - lastRegion.minY : 0.025;
    return {
      candidateId: `candidate-${number}`,
      rawNumberToken: `${number}.`,
      canonicalNumber: number,
      numberingStyle: 'dot',
      promptRegionId: `observed-prompt-${number}`,
      promptPolygon: rect(0.1, y, 0.5, y + height),
      answerRegionId: `observed-answer-${number}`,
      answerPolygon: rect(0.55, y, 0.85, y + height),
      answerFormat: 'numeric_or_operator',
      attemptDisposition: 'answered',
      containsCandidateInk: true,
      contentType: 'maths_single_line'
    };
  });
}

function normalized(input = observation()) {
  const result = service.normalizePilotObservationV1(input);
  assert.deepStrictEqual(result.diagnostics, []);
  assert.strictEqual(result.ok, true);
  return result.normalizedObservation;
}

function expectDiagnostic(result, diagnostic) {
  assert.strictEqual(result.ok, false);
  assert.deepStrictEqual(result.diagnostics, [diagnostic]);
}

function dataUrlForFixture() {
  const bytes = fs.readFileSync(path.join(FIXTURES, 'q16-source-gap', q16Gold.exactSourceImage));
  return { bytes, dataUrl: `data:image/png;base64,${bytes.toString('base64')}` };
}

function accountedSourceDomain(overrides = {}) {
  return {
    methodVersion: 'pilot_source_partition_v1',
    transformVersion: 'rc-c-pilot-geometry-v1',
    toleranceVersion: 'pilot_source_accounting_tolerance_v1',
    pageDomain: { minX: 0.05, minY: 0.05, maxX: 0.95, maxY: 0.95 },
    leaves: [{
      leafId: 'leaf', polygon: rect(0.05, 0.05, 0.95, 0.95), areaRatio: 1, adjacency: [],
      sourceLeafClass: 'background_whitespace', exclusionReason: null, containsCandidateInk: false,
      normalizedBox: { minX: 0.05, minY: 0.05, maxX: 0.95, maxY: 0.95 }
    }],
    uncoveredAreaRatio: 0,
    largestConnectedUncoveredComponentRatio: 0,
    uncoveredContainsCandidateInk: false,
    leafInteriorOverlapRatio: 0,
    allTransformsAndTolerancesCurrent: true,
    ...overrides
  };
}

test('fixture manifests cover every required accepted and rejected boundary', () => {
  assert.deepStrictEqual(acceptedFixture.acceptedCases, [
    'minimum_supported_dimensions', 'maximum_supported_dimensions', 'exact_quality_thresholds',
    'one_item', 'twelve_items', 'orientation_0_90_180_270', 'skew_minus_3_plus_3',
    'page_area_0_55_0_98'
  ]);
  const names = new Set(rejectedFixture.cases.map(([name]) => name));
  for (const required of [
    'zero_images', 'multiple_images', 'unsupported_mime', 'malformed_data_url', 'oversize_bytes',
    'too_small_dimensions', 'too_large_dimensions', 'over_20_megapixels', 'unsupported_orientation',
    'excessive_skew', 'page_too_small_or_large', 'clipped_page_edge', 'boundary_touching_region',
    'multiple_columns', 'zero_assessable_items', 'more_than_12_items', 'mixed_numbering',
    'duplicate_number', 'missing_sequence_number', 'grouped_or_multipart', 'table', 'diagram',
    'geometry', 'free_form_long_answer', 'unsupported_answer_format', 'unresolved_source_leaf',
    'uncovered_ink', 'excessive_uncovered_area', 'excessive_overlap', 'stale_method_or_transform'
  ]) assert(names.has(required), required);
});

test('exact one-image envelope and bounded PNG metadata decoding', () => {
  expectDiagnostic(service.validatePilotImageCountV1([]), 'PILOT_IMAGE_COUNT_NOT_ONE');
  expectDiagnostic(service.validatePilotImageCountV1(['a', 'b']), 'PILOT_IMAGE_COUNT_NOT_ONE');
  assert.strictEqual(service.validatePilotImageCountV1(['a']).ok, true);
  const image = dataUrlForFixture();
  const decoded = service.decodePilotImageMetadataV1(image.dataUrl);
  assert.strictEqual(decoded.ok, true);
  assert.deepStrictEqual(decoded.metadata, { mime: 'image/png', width: 1200, height: 1600, byteLength: image.bytes.length });
  expectDiagnostic(service.decodePilotImageMetadataV1('data:image/gif;base64,AAAA'), 'UNSUPPORTED_IMAGE_MIME');
  expectDiagnostic(service.decodePilotImageMetadataV1('not-a-data-url'), 'MALFORMED_IMAGE_DATA_URL');
  expectDiagnostic(service.decodePilotImageMetadataV1('data:image/png;base64,iVBORw0KGgo='), 'IMAGE_DECODE_FAILED');
  const tooLarge = Buffer.alloc(10 * 1024 * 1024 + 1).toString('base64');
  expectDiagnostic(service.decodePilotImageMetadataV1(`data:image/png;base64,${tooLarge}`), 'IMAGE_FILE_SIZE_EXCEEDED');
});

test('accepted envelope dimensions, quality, item count, orientation, skew, and page ratio boundaries', () => {
  const base = observation();
  for (const metadata of [{ width: 1200, height: 1600 }, { width: 4000, height: 5000 }]) {
    assert.strictEqual(service.validatePilotEnvelopeV1(metadata, normalized(base)).ok, true);
  }
  const twelve = observation();
  twelve.candidateBands = candidates(12);
  for (const orientationDegrees of [0, 90, 180, 270]) {
    for (const skewDegrees of [-3, 3]) {
      for (const pageAreaRatio of [0.55, 0.98]) {
        const current = clone(twelve);
        Object.assign(current, { orientationDegrees, skewDegrees, pageAreaRatio });
        assert.strictEqual(service.validatePilotEnvelopeV1({ width: 4000, height: 5000 }, normalized(current)).ok, true);
      }
    }
  }
});

test('envelope and quality failures are exact and fail closed', () => {
  const base = normalized();
  expectDiagnostic(service.validatePilotEnvelopeV1({ width: 1199, height: 1600 }, base), 'IMAGE_DIMENSIONS_UNSUPPORTED');
  expectDiagnostic(service.validatePilotEnvelopeV1({ width: 4001, height: 5000 }, base), 'IMAGE_DIMENSIONS_UNSUPPORTED');
  expectDiagnostic(service.validatePilotEnvelopeV1({ width: 3500, height: 6000 }, base), 'IMAGE_PIXEL_COUNT_EXCEEDED');
  for (const [change, code] of [
    [{ logicalPageCount: 2 }, 'LOGICAL_PAGE_COUNT_UNSUPPORTED'],
    [{ skewDegrees: 3.001 }, 'SKEW_EXCEEDS_LIMIT'],
    [{ pageAreaRatio: 0.549 }, 'PAGE_AREA_RATIO_UNSUPPORTED']
  ]) expectDiagnostic(service.validatePilotEnvelopeV1({ width: 1200, height: 1600 }, { ...base, ...change }), code);
  for (const [quality, code] of [
    [{ sharpnessPass: false }, 'QUALITY_SHARPNESS_FAILED'],
    [{ contrastPass: false }, 'QUALITY_CONTRAST_FAILED'],
    [{ glareOrSolidClippingRatio: 0.020001 }, 'GLARE_OR_SOLID_CLIPPING_EXCEEDED'],
    [{ materialCompressionDamage: true }, 'MATERIAL_COMPRESSION_DAMAGE']
  ]) expectDiagnostic(service.validatePilotEnvelopeV1({ width: 1200, height: 1600 }, { ...base, quality: { ...base.quality, ...quality } }), code);
  const clipped = clone(base); clipped.pagePolygon = rect(0, 0.05, 0.95, 0.95);
  expectDiagnostic(service.validatePilotEnvelopeV1({ width: 1200, height: 1600 }, clipped), 'PAGE_EDGE_CLIPPED');
  const touching = clone(base); touching.candidateBands[0].promptPolygon = rect(0.05, 0.1, 0.5, 0.14);
  expectDiagnostic(service.validatePilotEnvelopeV1({ width: 1200, height: 1600 }, touching), 'REGION_TOUCHES_PAGE_BOUNDARY');
  const zero = clone(base); zero.candidateBands[0].contentType = 'non_assessable';
  expectDiagnostic(service.validatePilotEnvelopeV1({ width: 1200, height: 1600 }, zero), 'ASSESSABLE_ITEM_COUNT_UNSUPPORTED');
  const thirteen = clone(base); thirteen.candidateBands = candidates(13);
  expectDiagnostic(service.validatePilotEnvelopeV1({ width: 1200, height: 1600 }, thirteen), 'ASSESSABLE_ITEM_COUNT_UNSUPPORTED');
  const columns = clone(base); columns.candidateBands = candidates(2); columns.candidateBands[1].promptPolygon = rect(0.6, 0.2, 0.8, 0.23);
  expectDiagnostic(service.validatePilotEnvelopeV1({ width: 1200, height: 1600 }, columns), 'MULTIPLE_READING_COLUMNS');
});

test('closed observation schema rejects authority fields and unknown enums', () => {
  const injected = observation();
  injected.enumerationState = 'enumerated';
  expectDiagnostic(service.normalizePilotObservationV1(injected), 'OBSERVATION_SCHEMA_INVALID');
  for (const field of ['pageTopologyState', 'sourceDomainAccountingState', 'reconciliationState', 'coverageAssuranceLevel', 'serverStructuralUseClass', 'localEffectiveUseClass', 'authoritySnapshotFingerprint', 'authorityRevisionId']) {
    const current = observation(); current[field] = 'attacker-controlled';
    expectDiagnostic(service.normalizePilotObservationV1(current), 'OBSERVATION_SCHEMA_INVALID');
  }
  for (const [field, value, code] of [
    ['numberingStyle', 'roman', 'OBSERVATION_NUMBERING_STYLE_UNKNOWN'],
    ['answerFormat', 'essay', 'OBSERVATION_ANSWER_FORMAT_UNKNOWN'],
    ['answerFormat', 'free_form_long_answer', 'FREE_FORM_LONG_ANSWER_UNSUPPORTED'],
    ['contentType', 'table', 'TABLE_TOPOLOGY_UNSUPPORTED'],
    ['contentType', 'diagram', 'DIAGRAM_TOPOLOGY_UNSUPPORTED'],
    ['contentType', 'geometry', 'GEOMETRY_TOPOLOGY_UNSUPPORTED'],
    ['contentType', 'grouped', 'GROUPED_OR_MULTIPART_UNSUPPORTED'],
    ['contentType', 'unsupported', 'UNSUPPORTED_CONTENT_TYPE']
  ]) {
    const current = observation(); current.candidateBands[0][field] = value;
    expectDiagnostic(service.normalizePilotObservationV1(current), code);
  }
});

test('enumeration preserves source order and derives stable immutable IDs', () => {
  const current = observation(); current.candidateBands = candidates(12);
  const value = normalized(current);
  const first = service.enumerateNumberedBandsV1(value);
  const second = service.enumerateNumberedBandsV1(value);
  assert.strictEqual(first.ok, true);
  assert.strictEqual(service.rccCanonicalSerialize(first), service.rccCanonicalSerialize(second));
  assert.deepStrictEqual(first.itemLedger.map((item) => item.canonicalNumber), Array.from({ length: 12 }, (_, index) => index + 1));
  assert(first.itemLedger.every((item) => /^rcci_[0-9a-f]{64}$/.test(item.itemId)));
  assert.strictEqual(service.validatePilotItemSequenceV1(first.itemLedger).ok, true);
});

test('enumeration rejects mixed, duplicate, missing and token mismatch without inference', () => {
  for (const [mutate, code] of [
    [(bands) => { bands[1].numberingStyle = 'close_paren'; bands[1].rawNumberToken = '2)'; }, 'MIXED_NUMBERING_STYLES'],
    [(bands) => { bands[1].canonicalNumber = 1; bands[1].rawNumberToken = '1.'; }, 'DUPLICATE_CANONICAL_NUMBER'],
    [(bands) => { bands[1].canonicalNumber = 3; bands[1].rawNumberToken = '3.'; }, 'NUMBER_SEQUENCE_GAP'],
    [(bands) => { bands[1].rawNumberToken = '3.'; }, 'NUMBER_TOKEN_MISMATCH']
  ]) {
    const current = observation(); current.candidateBands = candidates(2); mutate(current.candidateBands);
    expectDiagnostic(service.enumerateNumberedBandsV1(normalized(current)), code);
  }
});

test('topology proves one page, one column, region ownership and canonical order', () => {
  const current = observation(); current.candidateBands = candidates(4);
  const value = normalized(current);
  const ledger = service.enumerateNumberedBandsV1(value).itemLedger;
  const topology = service.validateOnePageTopologyV1(value, ledger);
  assert.strictEqual(topology.ok, true);
  assert.deepStrictEqual(clone(topology.topology), {
    geometryToleranceVersion: 'rc-c-pilot-geometry-v1', itemCount: 4, logicalPageCount: 1,
    pageTopologyState: 'resolved', readingColumnCount: 1, sourceImageCount: 1
  });
  const overlap = clone(ledger); overlap[1].promptPolygon = clone(overlap[0].promptPolygon);
  expectDiagnostic(service.validateOnePageTopologyV1(value, overlap), 'TOPOLOGY_REGION_OVERLAP');
  const reordered = [ledger[1], ledger[0], ...ledger.slice(2)];
  expectDiagnostic(service.validateOnePageTopologyV1(value, reordered), 'ITEM_SEQUENCE_INVALID');
});

test('source partition and accounting enforce exact thresholds and limitation', () => {
  const partition = service.partitionSourceDomainV1(normalized());
  assert.strictEqual(partition.ok, true);
  const accounted = service.accountSourceDomainV1(partition.sourceDomain);
  assert.strictEqual(accounted.ok, true);
  assert.strictEqual(accounted.sourceDomainAccounting.method_exhausted, true);
  assert.deepStrictEqual(accounted.sourceDomainAccounting.limitations, ['INDEPENDENT_SOURCE_COMPLETENESS_NOT_CLAIMED']);
  for (const fixture of sourceCases.cases) {
    const result = service.accountSourceDomainV1(accountedSourceDomain({
      uncoveredAreaRatio: fixture.uncoveredAreaRatio,
      largestConnectedUncoveredComponentRatio: fixture.largestConnectedUncoveredComponentRatio,
      uncoveredContainsCandidateInk: fixture.uncoveredContainsCandidateInk,
      leafInteriorOverlapRatio: fixture.leafInteriorOverlapRatio
    }));
    if (fixture.expected === 'accounted') assert.strictEqual(result.sourceDomainAccounting.sourceDomainAccountingState, 'accounted');
    else expectDiagnostic(result, fixture.expected);
  }
  expectDiagnostic(service.accountSourceDomainV1(accountedSourceDomain({ transformVersion: 'stale' })), 'SOURCE_DOMAIN_METHOD_OR_TRANSFORM_STALE');
  const unresolved = observation(); unresolved.sourceLeaves[0].sourceLeafClass = 'unresolved';
  expectDiagnostic(service.partitionSourceDomainV1(normalized(unresolved)), 'SOURCE_DOMAIN_UNRESOLVED_LEAF');
});

test('overlap and uncovered geometry are derived by production partition code', () => {
  const overlap = observation(); overlap.sourceLeaves.push({ ...clone(overlap.sourceLeaves[0]), leafId: 'duplicate-domain' });
  const overlapPartition = service.partitionSourceDomainV1(normalized(overlap));
  assert(overlapPartition.sourceDomain.leafInteriorOverlapRatio > 0.001);
  expectDiagnostic(service.accountSourceDomainV1(overlapPartition.sourceDomain), 'SOURCE_DOMAIN_OVERLAP_EXCEEDED');
  const gap = observation(); gap.sourceLeaves[0].polygon = rect(0.05, 0.05, 0.95, 0.8); gap.sourceLeaves[0].areaRatio = 0.8333333333;
  const gapPartition = service.partitionSourceDomainV1(normalized(gap));
  expectDiagnostic(service.accountSourceDomainV1(gapPartition.sourceDomain), 'SOURCE_DOMAIN_UNCOVERED_AREA_EXCEEDED');
});

test('source and effective fingerprints are deterministic, comprehensive, and exclude local state', () => {
  const image = dataUrlForFixture();
  const sourceFingerprint = service.computeSourceImageFingerprintV1(image.bytes);
  assert.strictEqual(sourceFingerprint, q16Gold.artifactHash);
  assert.notStrictEqual(sourceFingerprint, service.computeSourceImageFingerprintV1(Buffer.concat([image.bytes, Buffer.from([0])])));
  const value = normalized();
  const envelope = service.validatePilotEnvelopeV1(acceptedFixture.baseImageMetadata, value).envelope;
  const ledger = service.enumerateNumberedBandsV1(value).itemLedger;
  const topology = service.validateOnePageTopologyV1(value, ledger).topology;
  const sourceDomain = service.partitionSourceDomainV1(value).sourceDomain;
  const inputs = {
    sourceImageFingerprint: sourceFingerprint,
    normalizedObservation: value,
    methodVersions: { enumeration: 'pilot_numbered_bands_v1', source: 'pilot_source_partition_v1' },
    transform: 'rc-c-pilot-geometry-v1',
    toleranceVersions: { geometry: 'rc-c-pilot-geometry-v1', source: 'pilot_source_accounting_tolerance_v1' },
    envelopeResult: envelope,
    itemLedger: ledger,
    topology,
    sourceDomain,
    sourceDomainAccountingInputs: clone(sourceDomain),
    localState: { selected: true }
  };
  const original = service.computeEffectiveInputFingerprintV1(inputs);
  assert.strictEqual(original, service.computeEffectiveInputFingerprintV1(clone(inputs)));
  const localChange = clone(inputs); localChange.localState.selected = false;
  assert.strictEqual(original, service.computeEffectiveInputFingerprintV1(localChange));
  for (const key of ['sourceImageFingerprint', 'normalizedObservation', 'methodVersions', 'transform', 'toleranceVersions', 'envelopeResult', 'itemLedger', 'topology', 'sourceDomain', 'sourceDomainAccountingInputs']) {
    const changed = clone(inputs);
    if (typeof changed[key] === 'string') changed[key] += '-changed';
    else if (Array.isArray(changed[key])) changed[key][0].coveredMutation = true;
    else changed[key].coveredMutation = true;
    assert.notStrictEqual(original, service.computeEffectiveInputFingerprintV1(changed), key);
  }
});

test('accepted pipeline is byte-identical across repeated normalization and every derived stage', () => {
  const run = () => {
    const value = normalized();
    const envelope = service.validatePilotEnvelopeV1(acceptedFixture.baseImageMetadata, value);
    const enumeration = service.enumerateNumberedBandsV1(value);
    const topology = service.validateOnePageTopologyV1(value, enumeration.itemLedger);
    const partition = service.partitionSourceDomainV1(value);
    const accounting = service.accountSourceDomainV1(partition.sourceDomain);
    const fingerprint = service.computeEffectiveInputFingerprintV1({
      sourceImageFingerprint: q16Gold.artifactHash, normalizedObservation: value,
      methodVersions: { enumeration: 'pilot_numbered_bands_v1', source: 'pilot_source_partition_v1' },
      transform: 'rc-c-pilot-geometry-v1', toleranceVersions: { source: 'pilot_source_accounting_tolerance_v1' },
      envelopeResult: envelope.envelope, itemLedger: enumeration.itemLedger,
      topology: topology.topology, sourceDomain: partition.sourceDomain
    });
    return service.rccCanonicalSerialize({ value, envelope, enumeration, topology, partition, accounting, fingerprint });
  };
  assert.strictEqual(run(), run());
});

test('Q16 gold is independently marked and artifact-bound', () => {
  assert.strictEqual(q16Gold.fixtureId, 'q16_source_gap_compared_ledger_v1');
  assert.strictEqual(q16Gold.expectedRegionClassification, 'assessable_candidate');
  assert.strictEqual(q16Gold.expectedLedgerCardinality, 16);
  assert.strictEqual(q16Gold.fixtureVersion, 1);
  assert(q16Gold.reviewerProvenance.reviewerId);
  const image = dataUrlForFixture();
  assert.strictEqual(crypto.createHash('sha256').update(image.bytes).digest('hex'), q16Gold.artifactHash);
  assert.deepStrictEqual(q16Mutation.retainedIndependentGoldDomain, q16Gold.independentlyHumanMarkedNormalizedPageDomain);
  assert.deepStrictEqual(q16Mutation.removedOrUnclassifiedRegion, q16Gold.independentlyMarkedQ16SourceRegion);
  assert.strictEqual(q16Mutation.reconciliationAttemptedAgainstGoldRegion, true);
});

test('Q16 exact source-gap path reaches the mandated compared-ledger result through services', () => {
  const region = q16Gold.independentlyMarkedQ16SourceRegion;
  const current = observation();
  current.candidateBands = candidates(16, region);
  current.sourceLeaves = [
    ['above', rect(0.05, 0.05, 0.95, region.minY), ['left', 'right']],
    ['below', rect(0.05, region.maxY, 0.95, 0.95), ['left', 'right']],
    ['left', rect(0.05, region.minY, region.minX, region.maxY), ['above', 'below']],
    ['right', rect(region.maxX, region.minY, 0.95, region.maxY), ['above', 'below']]
  ].map(([leafId, polygon, adjacency]) => ({
    leafId,
    polygon,
    areaRatio: ((polygon[1].x - polygon[0].x) * (polygon[2].y - polygon[1].y)) / 0.81,
    adjacency,
    sourceLeafClass: 'assessable_candidate',
    exclusionReason: null,
    containsCandidateInk: true
  }));
  const runMutation = () => {
    const value = normalized(clone(current));
    const envelope = service.validatePilotEnvelopeV1({ width: 1200, height: 1600 }, value);
    const harnessLedger = service.enumerateNumberedBandsV1(value, { harnessOnly: true });
    const topology = service.validateOnePageTopologyV1(value, harnessLedger.itemLedger);
    const partition = service.partitionSourceDomainV1(value);
    const accounting = partition.ok ? service.accountSourceDomainV1(partition.sourceDomain) : partition;
    const exact = service.buildFailClosedStructureStateV1(accounting.diagnostics[0]);
    const effectiveInputFingerprint = service.computeEffectiveInputFingerprintV1({
      sourceImageFingerprint: q16Gold.artifactHash,
      normalizedObservation: value,
      methodVersions: { enumeration: 'pilot_numbered_bands_v1', source: 'pilot_source_partition_v1' },
      transform: 'rc-c-pilot-geometry-v1',
      toleranceVersions: { source: 'pilot_source_accounting_tolerance_v1' },
      envelopeResult: envelope,
      itemLedger: harnessLedger.itemLedger,
      topology: topology.topology,
      sourceDomain: partition.sourceDomain
    });
    return { value, envelope, harnessLedger, topology, partition, accounting, exact, effectiveInputFingerprint };
  };
  const firstRun = runMutation();
  const secondRun = runMutation();
  assert.strictEqual(service.rccCanonicalSerialize(firstRun), service.rccCanonicalSerialize(secondRun));
  expectDiagnostic(service.enumerateNumberedBandsV1(firstRun.value), 'ASSESSABLE_ITEM_COUNT_UNSUPPORTED');
  const { envelope, harnessLedger, topology, partition, accounting, exact } = firstRun;
  expectDiagnostic(envelope, 'ASSESSABLE_ITEM_COUNT_UNSUPPORTED');
  assert.strictEqual(harnessLedger.ok, true);
  assert.strictEqual(harnessLedger.itemLedger.length, q16Gold.expectedLedgerCardinality);
  assert.strictEqual(topology.ok, true);
  assert.strictEqual(partition.ok, true);
  expectDiagnostic(accounting, 'SOURCE_DOMAIN_GAP_UNRESOLVED');
  assert.deepStrictEqual(clone(exact), {
    coverageAssuranceLevel: 'unknown',
    diagnostic: 'SOURCE_DOMAIN_GAP_UNRESOLVED',
    enumerationState: 'unresolved',
    limitations: ['INDEPENDENT_SOURCE_COMPLETENESS_NOT_CLAIMED'],
    localEffectiveUseClass: { kind: 'use_server_class', serverClass: 'reconciliation_mismatched' },
    method_exhausted: false,
    pageTopologyState: 'unsupported',
    positiveParentDisplayProhibited: true,
    reconciliationState: 'reconciliation_mismatched',
    serverStructuralUseClass: 'reconciliation_mismatched',
    sourceDomainAccountingState: 'unresolved'
  });
  assert.strictEqual(service.rccCanonicalSerialize(exact), service.rccCanonicalSerialize(service.buildFailClosedStructureStateV1(accounting.diagnostics[0])));
});

test('pilot feature requires both gates and feature-off preserves RC-B prompt/response seams', () => {
  assert.strictEqual(analyzeTest.isRCCPilotRequestedV1({ rcCPilotRequested: true }, { RC_C_PILOT_ENABLED: '1' }), true);
  assert.strictEqual(analyzeTest.isRCCPilotRequestedV1({ rcCPilotRequested: false }, { RC_C_PILOT_ENABLED: '1' }), false);
  assert.strictEqual(analyzeTest.isRCCPilotRequestedV1({ rcCPilotRequested: true }, { RC_C_PILOT_ENABLED: '0' }), false);
  assert.strictEqual(analyzeTest.isRCCPilotRequestedV1({}, {}), false);
  const prompt = analyzeTest.buildRCCPilotObservationPromptV1();
  assert(prompt.includes('RCC_PILOT_OBSERVATION_V1_BEGIN'));
  assert(prompt.includes('untrusted observation'));
  assert(!prompt.includes('rcCPilotAuthority'));
});

test('model observation extraction is closed and cannot set deterministic structure or authority', () => {
  const current = observation();
  const text = `parent text\nRCC_PILOT_OBSERVATION_V1_BEGIN\n${JSON.stringify(current)}\nRCC_PILOT_OBSERVATION_V1_END`;
  assert.strictEqual(analyzeTest.extractRCCPilotObservationV1(text).ok, true);
  current.reconciliationState = 'reconciliation_matched';
  const injected = `RCC_PILOT_OBSERVATION_V1_BEGIN\n${JSON.stringify(current)}\nRCC_PILOT_OBSERVATION_V1_END`;
  expectDiagnostic(analyzeTest.extractRCCPilotObservationV1(injected), 'OBSERVATION_SCHEMA_INVALID');
});

console.log(`PASS rc-c-pilot-enumeration: ${passed}/${passed} deterministic assertions`);
