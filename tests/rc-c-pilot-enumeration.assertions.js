'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const rccPilotModule = require('../netlify/functions/rc-c-pilot');
const { service } = rccPilotModule;
const rccTestService = rccPilotModule.__rccTest;
const analyzeTest = require('../netlify/functions/analyze-homework').__rccTest;
const { buildFixtures: buildImageDecodeFixtures } = require('./fixtures/rc-c-pilot/image-decode/fixture-builder');

const FIXTURES = path.join(__dirname, 'fixtures', 'rc-c-pilot');
const acceptedFixture = readJson('envelope', 'accepted-single-page.json');
const rejectedFixture = readJson('envelope', 'unsupported-cases.json');
const sourceCases = readJson('source-domain', 'gap-overlap-cases.json');
const q16Gold = readJson('q16-source-gap', 'worksheet-q16-source.gold.json');
const q16Mutation = readJson('q16-source-gap', 'worksheet-q16-source-gap.mutation.json');
const imageDecodeManifest = readJson('image-decode', 'manifest.json');

let passed = 0;
const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

async function expectRepeatedAsyncRejection(run, diagnostic) {
  const first = await run();
  const second = await run();
  expectDiagnostic(first, diagnostic);
  expectDiagnostic(second, diagnostic);
  assert.strictEqual(service.rccCanonicalSerialize(first), service.rccCanonicalSerialize(second));
  const serialized = JSON.stringify(first);
  assert(!/(?:sharp|libvips|vips|stack|\\\\|\/[A-Za-z0-9_.-]+\/|timestamp|random|issuedAt)/i.test(serialized));
  assert.notStrictEqual(first.sourceDomainAccountingState, 'accounted');
  assert.notStrictEqual(first.method_exhausted, true);
  assert.notStrictEqual(first.coverageAssuranceLevel, 'self_reconciled');
  assert.strictEqual(first.rcCPilotAuthority, undefined);
  return first;
}

function readJson(...parts) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, ...parts), 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function identityContext(overrides = {}) {
  return {
    sourceImageFingerprint: q16Gold.artifactHash,
    methodVersion: 'pilot_numbered_bands_v1',
    ...overrides
  };
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

function expectRepeatedRejection(run, diagnostic) {
  const first = run();
  const second = run();
  expectDiagnostic(first, diagnostic);
  expectDiagnostic(second, diagnostic);
  assert.strictEqual(service.rccCanonicalSerialize(first), service.rccCanonicalSerialize(second));
  const serialized = JSON.stringify(first);
  assert(!/(?:timestamp|random|issuedAt)/i.test(serialized));
  assert.notStrictEqual(first.sourceDomainAccountingState, 'accounted');
  assert.notStrictEqual(first.method_exhausted, true);
  assert.notStrictEqual(first.coverageAssuranceLevel, 'self_reconciled');
  return first;
}

const TEST_PNG_CRC_TABLE = Array.from({ length: 256 }, (_unused, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});

function testPngCrc(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ TEST_PNG_CRC_TABLE[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  typeBytes.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(testPngCrc(Buffer.concat([typeBytes, data])), 8 + data.length);
  return result;
}

function makePng(options = {}) {
  const width = options.width || 1;
  const height = options.height || 1;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = options.raw || Buffer.concat(Array.from({ length: height }, () => Buffer.from([0, 0, 0, 0, 0])));
  const chunks = [pngChunk('IHDR', ihdr), ...(options.beforeIdat || [])];
  if (!options.omitIdat) chunks.push(pngChunk('IDAT', zlib.deflateSync(raw)));
  chunks.push(...(options.afterIdat || []), pngChunk('IEND', Buffer.alloc(0)));
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), ...chunks]);
}

function makeSizedPng(byteLength) {
  const base = makePng();
  const payloadLength = byteLength - base.length - 12;
  assert(payloadLength >= 0);
  return makePng({ beforeIdat: [pngChunk('raNd', Buffer.alloc(payloadLength))] });
}

function imageUrl(mime, bytes) {
  return `data:${mime};base64,${bytes.toString('base64')}`;
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
  assert.strictEqual(imageDecodeManifest.fixtureVersion, 'rc-c-image-decode-v1');
  assert.strictEqual(imageDecodeManifest.fixtures.length, 15);
});

test('trusted image fixture builder is byte-exact and manifest-bound', async () => {
  const fixtures = await buildImageDecodeFixtures();
  assert.deepStrictEqual(Object.keys(fixtures), imageDecodeManifest.fixtures.map((fixture) => fixture.filename));
  for (const fixture of imageDecodeManifest.fixtures) {
    const bytes = fixtures[fixture.filename];
    assert.strictEqual(bytes.length, fixture.byteSize, fixture.filename);
    assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex'), fixture.sha256, fixture.filename);
    assert(fixture.purpose && fixture.expected);
  }
});

test('exact one-image envelope and bounded PNG metadata decoding', async () => {
  expectRepeatedRejection(() => service.validatePilotImageCountV1([]), 'PILOT_IMAGE_COUNT_NOT_ONE');
  expectRepeatedRejection(() => service.validatePilotImageCountV1(['a', 'b']), 'PILOT_IMAGE_COUNT_NOT_ONE');
  assert.strictEqual(service.validatePilotImageCountV1(['a']).ok, true);
  const image = dataUrlForFixture();
  const decoded = await service.decodePilotImageMetadataV1(image.dataUrl);
  assert.strictEqual(decoded.ok, true);
  assert.deepStrictEqual(decoded.metadata, { mime: 'image/png', width: 1200, height: 1600, byteLength: image.bytes.length });
  await expectRepeatedAsyncRejection(() => service.decodePilotImageMetadataV1('data:image/gif;base64,AAAA'), 'UNSUPPORTED_IMAGE_MIME');
  await expectRepeatedAsyncRejection(() => service.decodePilotImageMetadataV1('not-a-data-url'), 'MALFORMED_IMAGE_DATA_URL');
  await expectRepeatedAsyncRejection(() => service.decodePilotImageMetadataV1('data:image/png;base64,iVBORw0KGgo='), 'IMAGE_DECODE_FAILED');
  const tooLarge = Buffer.alloc(10 * 1024 * 1024 + 1).toString('base64');
  await expectRepeatedAsyncRejection(() => service.decodePilotImageMetadataV1(`data:image/png;base64,${tooLarge}`), 'IMAGE_FILE_SIZE_EXCEEDED');
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
  expectRepeatedRejection(() => service.validatePilotEnvelopeV1({ width: 1199, height: 1600 }, base), 'IMAGE_DIMENSIONS_UNSUPPORTED');
  expectRepeatedRejection(() => service.validatePilotEnvelopeV1({ width: 4001, height: 5000 }, base), 'IMAGE_DIMENSIONS_UNSUPPORTED');
  expectRepeatedRejection(() => service.validatePilotEnvelopeV1({ width: 3500, height: 6000 }, base), 'IMAGE_PIXEL_COUNT_EXCEEDED');
  for (const [change, code] of [
    [{ logicalPageCount: 2 }, 'LOGICAL_PAGE_COUNT_UNSUPPORTED'],
    [{ skewDegrees: 3.001 }, 'SKEW_EXCEEDS_LIMIT'],
    [{ pageAreaRatio: 0.549 }, 'PAGE_AREA_RATIO_UNSUPPORTED']
  ]) expectRepeatedRejection(() => service.validatePilotEnvelopeV1({ width: 1200, height: 1600 }, { ...base, ...change }), code);
  for (const [quality, code] of [
    [{ sharpnessPass: false }, 'QUALITY_SHARPNESS_FAILED'],
    [{ contrastPass: false }, 'QUALITY_CONTRAST_FAILED'],
    [{ glareOrSolidClippingRatio: 0.020001 }, 'GLARE_OR_SOLID_CLIPPING_EXCEEDED'],
    [{ materialCompressionDamage: true }, 'MATERIAL_COMPRESSION_DAMAGE']
  ]) expectRepeatedRejection(() => service.validatePilotEnvelopeV1({ width: 1200, height: 1600 }, { ...base, quality: { ...base.quality, ...quality } }), code);
  const clipped = clone(base); clipped.pagePolygon = rect(0, 0.05, 0.95, 0.95);
  expectRepeatedRejection(() => service.validatePilotEnvelopeV1({ width: 1200, height: 1600 }, clipped), 'PAGE_EDGE_CLIPPED');
  const touching = clone(base); touching.candidateBands[0].promptPolygon = rect(0.05, 0.1, 0.5, 0.14);
  expectRepeatedRejection(() => service.validatePilotEnvelopeV1({ width: 1200, height: 1600 }, touching), 'REGION_TOUCHES_PAGE_BOUNDARY');
  const zero = clone(base); zero.candidateBands[0].contentType = 'non_assessable';
  expectRepeatedRejection(() => service.validatePilotEnvelopeV1({ width: 1200, height: 1600 }, zero), 'ASSESSABLE_ITEM_COUNT_UNSUPPORTED');
  const thirteen = clone(base); thirteen.candidateBands = candidates(13);
  expectRepeatedRejection(() => service.validatePilotEnvelopeV1({ width: 1200, height: 1600 }, thirteen), 'ASSESSABLE_ITEM_COUNT_UNSUPPORTED');
  const columns = clone(base); columns.candidateBands = candidates(2); columns.candidateBands[1].promptPolygon = rect(0.6, 0.2, 0.8, 0.23);
  expectRepeatedRejection(() => service.validatePilotEnvelopeV1({ width: 1200, height: 1600 }, columns), 'MULTIPLE_READING_COLUMNS');
});

test('closed observation schema rejects authority fields and unknown enums', () => {
  const injected = observation();
  injected.enumerationState = 'enumerated';
  expectRepeatedRejection(() => service.normalizePilotObservationV1(injected), 'OBSERVATION_SCHEMA_INVALID');
  for (const field of ['pageTopologyState', 'sourceDomainAccountingState', 'reconciliationState', 'coverageAssuranceLevel', 'serverStructuralUseClass', 'localEffectiveUseClass', 'authoritySnapshotFingerprint', 'authorityRevisionId']) {
    const current = observation(); current[field] = 'attacker-controlled';
    expectRepeatedRejection(() => service.normalizePilotObservationV1(current), 'OBSERVATION_SCHEMA_INVALID');
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
    expectRepeatedRejection(() => service.normalizePilotObservationV1(current), code);
  }
});

test('enumeration preserves source order and derives stable immutable IDs', () => {
  const current = observation(); current.candidateBands = candidates(12);
  const value = normalized(current);
  const first = service.enumerateNumberedBandsV1(value, identityContext());
  const second = service.enumerateNumberedBandsV1(value, identityContext());
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
    expectRepeatedRejection(() => service.enumerateNumberedBandsV1(normalized(current), identityContext()), code);
  }
});

test('topology proves one page, one column, region ownership and canonical order', () => {
  const current = observation(); current.candidateBands = candidates(4);
  const value = normalized(current);
  const ledger = service.enumerateNumberedBandsV1(value, identityContext()).itemLedger;
  const topology = service.validateOnePageTopologyV1(value, ledger);
  assert.strictEqual(topology.ok, true);
  assert.deepStrictEqual(clone(topology.topology), {
    geometryToleranceVersion: 'rc-c-pilot-geometry-v1', itemCount: 4, logicalPageCount: 1,
    pageTopologyState: 'resolved', readingColumnCount: 1, sourceImageCount: 1
  });
  const overlap = clone(ledger); overlap[1].promptPolygon = clone(overlap[0].promptPolygon);
  expectRepeatedRejection(() => service.validateOnePageTopologyV1(value, overlap), 'TOPOLOGY_REGION_OVERLAP');
  const reordered = [ledger[1], ledger[0], ...ledger.slice(2)];
  expectRepeatedRejection(() => service.validateOnePageTopologyV1(value, reordered), 'ITEM_SEQUENCE_INVALID');
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
    else expectRepeatedRejection(() => service.accountSourceDomainV1(accountedSourceDomain({
      uncoveredAreaRatio: fixture.uncoveredAreaRatio,
      largestConnectedUncoveredComponentRatio: fixture.largestConnectedUncoveredComponentRatio,
      uncoveredContainsCandidateInk: fixture.uncoveredContainsCandidateInk,
      leafInteriorOverlapRatio: fixture.leafInteriorOverlapRatio
    })), fixture.expected);
  }
  expectRepeatedRejection(() => service.accountSourceDomainV1(accountedSourceDomain({ transformVersion: 'stale' })), 'SOURCE_DOMAIN_METHOD_OR_TRANSFORM_STALE');
  const unresolved = observation(); unresolved.sourceLeaves[0].sourceLeafClass = 'unresolved';
  expectRepeatedRejection(() => service.partitionSourceDomainV1(normalized(unresolved)), 'SOURCE_DOMAIN_UNRESOLVED_LEAF');
});

test('overlap and uncovered geometry are derived by production partition code', () => {
  const overlap = observation(); overlap.sourceLeaves.push({ ...clone(overlap.sourceLeaves[0]), leafId: 'duplicate-domain' });
  const overlapPartition = service.partitionSourceDomainV1(normalized(overlap));
  assert(overlapPartition.sourceDomain.leafInteriorOverlapRatio > 0.001);
  expectRepeatedRejection(() => service.accountSourceDomainV1(overlapPartition.sourceDomain), 'SOURCE_DOMAIN_OVERLAP_EXCEEDED');
  const gap = observation(); gap.sourceLeaves[0].polygon = rect(0.05, 0.05, 0.95, 0.8); gap.sourceLeaves[0].areaRatio = 0.8333333333;
  const gapPartition = service.partitionSourceDomainV1(normalized(gap));
  expectRepeatedRejection(() => service.accountSourceDomainV1(gapPartition.sourceDomain), 'SOURCE_DOMAIN_UNCOVERED_AREA_EXCEEDED');
});

test('source and effective fingerprints are deterministic, comprehensive, and exclude local state', () => {
  const image = dataUrlForFixture();
  const sourceFingerprint = service.computeSourceImageFingerprintV1(image.bytes);
  assert.strictEqual(sourceFingerprint, q16Gold.artifactHash);
  assert.notStrictEqual(sourceFingerprint, service.computeSourceImageFingerprintV1(Buffer.concat([image.bytes, Buffer.from([0])])));
  const value = normalized();
  const envelope = service.validatePilotEnvelopeV1(acceptedFixture.baseImageMetadata, value).envelope;
  const ledger = service.enumerateNumberedBandsV1(value, identityContext()).itemLedger;
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
    const enumeration = service.enumerateNumberedBandsV1(value, identityContext());
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
    const harnessLedger = rccTestService.enumerateNumberedBandsForQ16FixtureV1(value, identityContext());
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
  expectRepeatedRejection(() => service.enumerateNumberedBandsV1(firstRun.value, identityContext()), 'ASSESSABLE_ITEM_COUNT_UNSUPPORTED');
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

test('pilot feature requires both gates and feature-off preserves RC-B prompt/response seams', async () => {
  assert.strictEqual(analyzeTest.isRCCPilotRequestedV1({ rcCPilotRequested: true }, { RC_C_PILOT_ENABLED: '1' }), true);
  assert.strictEqual(analyzeTest.isRCCPilotRequestedV1({ rcCPilotRequested: false }, { RC_C_PILOT_ENABLED: '1' }), false);
  assert.strictEqual(analyzeTest.isRCCPilotRequestedV1({ rcCPilotRequested: true }, { RC_C_PILOT_ENABLED: '0' }), false);
  assert.strictEqual(analyzeTest.isRCCPilotRequestedV1({}, {}), false);
  const prompt = analyzeTest.buildRCCPilotObservationPromptV1();
  assert(prompt.includes('RCC_PILOT_OBSERVATION_V1_BEGIN'));
  assert(prompt.includes('untrusted observation'));
  assert(!prompt.includes('rcCPilotAuthority'));
  const previous = process.env.RC_C_PILOT_ENABLED;
  try {
    process.env.RC_C_PILOT_ENABLED = '0';
    assert.strictEqual(await analyzeTest.buildRCCPilotStructureContextV1(
      { rcCPilotRequested: true }, ['not-an-image'], 'not-an-observation'), null);
    process.env.RC_C_PILOT_ENABLED = '1';
    assert.strictEqual(await analyzeTest.buildRCCPilotStructureContextV1(
      { rcCPilotRequested: false }, ['not-an-image'], 'not-an-observation'), null);
  } finally {
    if (previous === undefined) delete process.env.RC_C_PILOT_ENABLED;
    else process.env.RC_C_PILOT_ENABLED = previous;
  }
});

test('model observation extraction is closed and cannot set deterministic structure or authority', () => {
  const current = observation();
  const text = `parent text\nRCC_PILOT_OBSERVATION_V1_BEGIN\n${JSON.stringify(current)}\nRCC_PILOT_OBSERVATION_V1_END`;
  assert.strictEqual(analyzeTest.extractRCCPilotObservationV1(text).ok, true);
  current.reconciliationState = 'reconciliation_matched';
  const injected = `RCC_PILOT_OBSERVATION_V1_BEGIN\n${JSON.stringify(current)}\nRCC_PILOT_OBSERVATION_V1_END`;
  expectRepeatedRejection(() => analyzeTest.extractRCCPilotObservationV1(injected), 'OBSERVATION_SCHEMA_INVALID');
});

test('trusted decoder fully decodes valid JPEG, PNG, and single-frame WebP', async () => {
  const fixtures = await buildImageDecodeFixtures();
  for (const [mime, bytes, dimensions] of [
    ['image/png', fixtures['valid.png'], [2, 2]],
    ['image/jpeg', fixtures['valid-baseline.jpeg'], [1, 1]],
    ['image/webp', fixtures['valid-single-frame.webp'], [2, 2]]
  ]) {
    const first = await service.decodePilotImageWithTrustedDecoderV1(bytes, mime);
    const second = await service.decodePilotImageWithTrustedDecoderV1(bytes, mime);
    assert.strictEqual(first.ok, true, mime);
    assert.deepStrictEqual([first.metadata.width, first.metadata.height], dimensions);
    assert.strictEqual(first.metadata.pages, 1);
    assert(first.metadata.channels >= 1 && first.metadata.channels <= 4);
    assert.strictEqual(first.metadata.decodedByteLength,
      first.metadata.width * first.metadata.height * first.metadata.decodedChannels);
    assert(first.metadata.decodedByteLength <= 80000000);
    assert.strictEqual(service.rccCanonicalSerialize(first), service.rccCanonicalSerialize(second));
  }
});

test('trusted decoder rejects malformed compressed payloads deterministically without native leakage', async () => {
  const fixtures = await buildImageDecodeFixtures();
  for (const [name, filename, mime] of [
    ['oversubscribed JPEG Huffman table', 'invalid-oversubscribed-huffman.jpeg', 'image/jpeg'],
    ['truncated JPEG entropy stream', 'invalid-truncated-entropy.jpeg', 'image/jpeg'],
    ['invalid JPEG entropy data', 'invalid-entropy-byte-stuffing.jpeg', 'image/jpeg'],
    ['marker-only JPEG', 'invalid-marker-only.jpeg', 'image/jpeg'],
    ['invalid VP8 payload', 'invalid-vp8.webp', 'image/webp'],
    ['truncated VP8 payload', 'invalid-truncated-vp8.webp', 'image/webp'],
    ['invalid VP8L payload', 'invalid-vp8l.webp', 'image/webp'],
    ['VP8X without subordinate frame', 'invalid-vp8x-no-frame.webp', 'image/webp'],
    ['animated WebP', 'invalid-animated.webp', 'image/webp'],
    ['malformed PNG compressed stream', 'invalid-compressed.png', 'image/png'],
  ]) {
    assert(name);
    await expectRepeatedAsyncRejection(
      () => service.decodePilotImageWithTrustedDecoderV1(fixtures[filename], mime),
      'IMAGE_DECODE_FAILED',
    );
  }
  await expectRepeatedAsyncRejection(
    () => service.decodePilotImageWithTrustedDecoderV1(fixtures['valid.png'], 'image/jpeg'),
    'IMAGE_FORMAT_MIME_MISMATCH',
  );
  await expectRepeatedAsyncRejection(
    () => service.decodePilotImageWithTrustedDecoderV1(Buffer.alloc(0), 'image/png'),
    'IMAGE_DECODE_FAILED',
  );
  await expectRepeatedAsyncRejection(
    () => service.decodePilotImageWithTrustedDecoderV1(Buffer.alloc(10 * 1024 * 1024 + 1), 'image/png'),
    'IMAGE_DECODE_FAILED',
  );
});

test('input and decoded image resource boundaries are deterministic', async () => {
  const fixtures = await buildImageDecodeFixtures();
  const belowBytes = makeSizedPng(10 * 1024 * 1024 - 1);
  const exactBytes = makeSizedPng(10 * 1024 * 1024);
  const aboveBytes = makeSizedPng(10 * 1024 * 1024 + 1);
  assert.strictEqual((await service.decodePilotImageMetadataV1(imageUrl('image/png', belowBytes))).ok, true);
  assert.strictEqual((await service.decodePilotImageMetadataV1(imageUrl('image/png', exactBytes))).ok, true);
  await expectRepeatedAsyncRejection(() => service.decodePilotImageMetadataV1(imageUrl('image/png', aboveBytes)), 'IMAGE_FILE_SIZE_EXCEEDED');
  await expectRepeatedAsyncRejection(
    () => service.decodePilotImageMetadataV1(imageUrl('image/png', fixtures['excessive-width.png'])),
    'IMAGE_DIMENSIONS_UNSUPPORTED',
  );
  await expectRepeatedAsyncRejection(
    () => service.decodePilotImageMetadataV1(imageUrl('image/png', fixtures['excessive-pixels.png'])),
    'IMAGE_PIXEL_COUNT_EXCEEDED',
  );
});

test('envelope dimension, pixel, skew, area, clipping, image-count, and production-count boundaries execute exactly', () => {
  const base = normalized();
  const accepted = (metadata, value = base) => {
    const first = service.validatePilotEnvelopeV1(metadata, value);
    const second = service.validatePilotEnvelopeV1(metadata, value);
    assert.strictEqual(first.ok, true);
    assert.strictEqual(service.rccCanonicalSerialize(first), service.rccCanonicalSerialize(second));
  };
  accepted({ width: 1200, height: 1600 });
  accepted({ width: 1201, height: 1600 });
  expectRepeatedRejection(() => service.validatePilotEnvelopeV1({ width: 1199, height: 1600 }, base), 'IMAGE_DIMENSIONS_UNSUPPORTED');
  accepted({ width: 3999, height: 5000 });
  accepted({ width: 4000, height: 5000 });
  expectRepeatedRejection(() => service.validatePilotEnvelopeV1({ width: 4001, height: 4998 }, base), 'IMAGE_DIMENSIONS_UNSUPPORTED');
  accepted({ width: 3000, height: 6000 });
  expectRepeatedRejection(() => service.validatePilotEnvelopeV1({ width: 3000, height: 6001 }, base), 'IMAGE_DIMENSIONS_UNSUPPORTED');
  accepted({ width: 4000, height: 5000 });
  expectRepeatedRejection(() => service.validatePilotEnvelopeV1({ width: 4000, height: 5001 }, base), 'IMAGE_PIXEL_COUNT_EXCEEDED');

  for (const skewDegrees of [-3, -2.999, 2.999, 3]) accepted({ width: 1200, height: 1600 }, { ...base, skewDegrees });
  expectRepeatedRejection(() => service.validatePilotEnvelopeV1({ width: 1200, height: 1600 }, { ...base, skewDegrees: -3.001 }), 'SKEW_EXCEEDS_LIMIT');
  expectRepeatedRejection(() => service.validatePilotEnvelopeV1({ width: 1200, height: 1600 }, { ...base, skewDegrees: 3.001 }), 'SKEW_EXCEEDS_LIMIT');
  for (const pageAreaRatio of [0.55, 0.551, 0.979, 0.98]) accepted({ width: 1200, height: 1600 }, { ...base, pageAreaRatio });
  expectRepeatedRejection(() => service.validatePilotEnvelopeV1({ width: 1200, height: 1600 }, { ...base, pageAreaRatio: 0.549 }), 'PAGE_AREA_RATIO_UNSUPPORTED');
  expectRepeatedRejection(() => service.validatePilotEnvelopeV1({ width: 1200, height: 1600 }, { ...base, pageAreaRatio: 0.981 }), 'PAGE_AREA_RATIO_UNSUPPORTED');

  const justInside = clone(base);
  justInside.candidateBands[0].promptPolygon = rect(0.050001, 0.1, 0.5, 0.14);
  accepted({ width: 1200, height: 1600 }, justInside);
  const touching = clone(base);
  touching.candidateBands[0].promptPolygon = rect(0.05, 0.1, 0.5, 0.14);
  expectRepeatedRejection(() => service.validatePilotEnvelopeV1({ width: 1200, height: 1600 }, touching), 'REGION_TOUCHES_PAGE_BOUNDARY');

  assert.strictEqual(service.validatePilotImageCountV1(['one']).ok, true);
  expectRepeatedRejection(() => service.validatePilotImageCountV1([]), 'PILOT_IMAGE_COUNT_NOT_ONE');
  expectRepeatedRejection(() => service.validatePilotImageCountV1(['one', 'two']), 'PILOT_IMAGE_COUNT_NOT_ONE');
  for (const count of [1, 12]) {
    const current = clone(base); current.candidateBands = candidates(count);
    accepted({ width: 1200, height: 1600 }, current);
  }
  const thirteen = clone(base); thirteen.candidateBands = candidates(13);
  expectRepeatedRejection(() => service.validatePilotEnvelopeV1({ width: 1200, height: 1600 }, thirteen), 'ASSESSABLE_ITEM_COUNT_UNSUPPORTED');
});

test('unsupported and unresolved source leaves never account or exhaust the method', () => {
  const wholeUnsupported = observation();
  wholeUnsupported.sourceLeaves[0].sourceLeafClass = 'unsupported';
  const normalizedUnsupported = normalized(wholeUnsupported);
  const wholeResult = expectRepeatedRejection(() => service.partitionSourceDomainV1(normalizedUnsupported), 'SOURCE_DOMAIN_UNSUPPORTED_LEAF');
  assert.strictEqual(wholeResult.sourceDomainAccountingState, 'unresolved');
  assert.strictEqual(wholeResult.method_exhausted, false);
  assert.strictEqual(wholeResult.coverageAssuranceLevel, 'unknown');
  assert.deepStrictEqual(wholeResult.limitations, ['INDEPENDENT_SOURCE_COMPLETENESS_NOT_CLAIMED']);

  const mixed = observation();
  mixed.sourceLeaves = [
    { leafId: 'supported-half', polygon: rect(0.05, 0.05, 0.5, 0.95), areaRatio: 0.5, adjacency: ['unsupported-half'], sourceLeafClass: 'assessable_candidate', exclusionReason: null, containsCandidateInk: true },
    { leafId: 'unsupported-half', polygon: rect(0.5, 0.05, 0.95, 0.95), areaRatio: 0.5, adjacency: ['supported-half'], sourceLeafClass: 'unsupported', exclusionReason: null, containsCandidateInk: false }
  ];
  expectRepeatedRejection(() => service.partitionSourceDomainV1(normalized(mixed)), 'SOURCE_DOMAIN_UNSUPPORTED_LEAF');
  mixed.sourceLeaves[1].containsCandidateInk = true;
  expectRepeatedRejection(() => service.partitionSourceDomainV1(normalized(mixed)), 'SOURCE_DOMAIN_UNSUPPORTED_LEAF');

  const markedExclusion = observation();
  markedExclusion.sourceLeaves[0].sourceLeafClass = 'unsupported';
  markedExclusion.sourceLeaves[0].exclusionReason = 'decoration';
  expectRepeatedRejection(() => service.normalizePilotObservationV1(markedExclusion), 'SOURCE_DOMAIN_UNSUPPORTED_LEAF');

  const directUnsupported = accountedSourceDomain();
  directUnsupported.leaves[0].sourceLeafClass = 'unsupported';
  expectRepeatedRejection(() => service.accountSourceDomainV1(directUnsupported), 'SOURCE_DOMAIN_UNSUPPORTED_LEAF');
  const unresolved = observation(); unresolved.sourceLeaves[0].sourceLeafClass = 'unresolved';
  expectRepeatedRejection(() => service.partitionSourceDomainV1(normalized(unresolved)), 'SOURCE_DOMAIN_UNRESOLVED_LEAF');
});

test('source accounting exact thresholds and stale versions execute twice without positive state', () => {
  for (const values of [
    { uncoveredAreaRatio: 0.0049, largestConnectedUncoveredComponentRatio: 0.0024, leafInteriorOverlapRatio: 0.0009 },
    { uncoveredAreaRatio: 0.005, largestConnectedUncoveredComponentRatio: 0.0025, leafInteriorOverlapRatio: 0.001 }
  ]) assert.strictEqual(service.accountSourceDomainV1(accountedSourceDomain(values)).ok, true);
  expectRepeatedRejection(() => service.accountSourceDomainV1(accountedSourceDomain({ uncoveredAreaRatio: 0.0051, largestConnectedUncoveredComponentRatio: 0.002, leafInteriorOverlapRatio: 0 })), 'SOURCE_DOMAIN_UNCOVERED_AREA_EXCEEDED');
  expectRepeatedRejection(() => service.accountSourceDomainV1(accountedSourceDomain({ uncoveredAreaRatio: 0.0026, largestConnectedUncoveredComponentRatio: 0.0026 })), 'SOURCE_DOMAIN_UNCOVERED_COMPONENT_EXCEEDED');
  expectRepeatedRejection(() => service.accountSourceDomainV1(accountedSourceDomain({ leafInteriorOverlapRatio: 0.0011 })), 'SOURCE_DOMAIN_OVERLAP_EXCEEDED');
  assert.strictEqual(service.accountSourceDomainV1(accountedSourceDomain({ uncoveredContainsCandidateInk: false })).ok, true);
  expectRepeatedRejection(() => service.accountSourceDomainV1(accountedSourceDomain({ uncoveredAreaRatio: 0.0001, largestConnectedUncoveredComponentRatio: 0.0001, uncoveredContainsCandidateInk: true })), 'SOURCE_DOMAIN_GAP_UNRESOLVED');
  expectRepeatedRejection(() => service.accountSourceDomainV1(accountedSourceDomain({ methodVersion: 'stale' })), 'SOURCE_DOMAIN_METHOD_OR_TRANSFORM_STALE');
  expectRepeatedRejection(() => service.accountSourceDomainV1(accountedSourceDomain({ transformVersion: 'stale' })), 'SOURCE_DOMAIN_METHOD_OR_TRANSFORM_STALE');
  expectRepeatedRejection(() => service.accountSourceDomainV1(accountedSourceDomain({ toleranceVersion: 'stale' })), 'SOURCE_DOMAIN_METHOD_OR_TRANSFORM_STALE');
});

test('item and region IDs bind source, content, format, geometry, role, and method but ignore local fields', () => {
  const value = normalized();
  const baseLedger = service.enumerateNumberedBandsV1(value, identityContext()).itemLedger;
  const repeated = service.enumerateNumberedBandsV1(value, { methodVersion: 'pilot_numbered_bands_v1', sourceImageFingerprint: q16Gold.artifactHash }).itemLedger;
  assert.strictEqual(service.rccCanonicalSerialize(baseLedger), service.rccCanonicalSerialize(repeated));
  assert.notStrictEqual(baseLedger[0].promptRegionId, baseLedger[0].answerRegionId);

  const otherSource = service.enumerateNumberedBandsV1(value, identityContext({ sourceImageFingerprint: 'a'.repeat(64) })).itemLedger;
  assert.notStrictEqual(baseLedger[0].itemId, otherSource[0].itemId);
  assert.notStrictEqual(baseLedger[0].promptRegionId, otherSource[0].promptRegionId);

  const otherGeometryObservation = observation(); otherGeometryObservation.candidateBands[0].promptPolygon = rect(0.1, 0.08, 0.49, 0.105);
  const otherGeometry = service.enumerateNumberedBandsV1(normalized(otherGeometryObservation), identityContext()).itemLedger;
  assert.notStrictEqual(baseLedger[0].itemId, otherGeometry[0].itemId);
  assert.notStrictEqual(baseLedger[0].promptRegionId, otherGeometry[0].promptRegionId);
  assert.notStrictEqual(baseLedger[0].answerRegionId, otherGeometry[0].answerRegionId);

  const otherTypeObservation = observation(); otherTypeObservation.candidateBands[0].contentType = 'maths_fill';
  const otherType = service.enumerateNumberedBandsV1(normalized(otherTypeObservation), identityContext()).itemLedger;
  assert.notStrictEqual(baseLedger[0].itemId, otherType[0].itemId);
  assert.notStrictEqual(baseLedger[0].promptRegionId, otherType[0].promptRegionId);

  const otherMethod = service.enumerateNumberedBandsV1(value, identityContext({ methodVersion: 'pilot_numbered_bands_v2' })).itemLedger;
  assert.notStrictEqual(baseLedger[0].itemId, otherMethod[0].itemId);
  assert.notStrictEqual(baseLedger[0].answerRegionId, otherMethod[0].answerRegionId);

  const otherFormatObservation = observation(); otherFormatObservation.candidateBands[0].answerFormat = 'tick_or_circle';
  const otherFormat = service.enumerateNumberedBandsV1(normalized(otherFormatObservation), identityContext()).itemLedger;
  assert.notStrictEqual(baseLedger[0].answerRegionId, otherFormat[0].answerRegionId);

  const localContext = identityContext({ localSelection: 'ignored', clientCacheState: 'ignored' });
  assert.strictEqual(service.rccCanonicalSerialize(baseLedger), service.rccCanonicalSerialize(service.enumerateNumberedBandsV1(value, localContext).itemLedger));
});

test('rectangle corner sets canonicalize every ordering before geometry-dependent identity', () => {
  const canonicalPrompt = rect(0.1, 0.08, 0.5, 0.105);
  const canonicalAnswer = rect(0.55, 0.08, 0.85, 0.105);
  const perimeterOrders = [
    [0, 1, 2, 3], [1, 2, 3, 0], [2, 3, 0, 1], [3, 0, 1, 2],
    [0, 3, 2, 1], [3, 2, 1, 0], [2, 1, 0, 3], [1, 0, 3, 2],
  ];
  const crossingOrders = [[0, 2, 1, 3], [1, 3, 0, 2]];
  const order = (polygon, indices) => indices.map((index) => ({ ...polygon[index] }));
  const run = (indices) => {
    const input = observation();
    input.candidateBands[0].promptPolygon = order(canonicalPrompt, indices);
    input.candidateBands[0].answerPolygon = order(canonicalAnswer, indices);
    const normalizedObservation = normalized(input);
    const itemLedger = service.enumerateNumberedBandsV1(normalizedObservation, identityContext()).itemLedger;
    const topology = service.validateOnePageTopologyV1(normalizedObservation, itemLedger).topology;
    const effectiveInputFingerprint = service.computeEffectiveInputFingerprintV1({
      sourceImageFingerprint: q16Gold.artifactHash,
      normalizedObservation,
      methodVersions: { enumeration: 'pilot_numbered_bands_v1' },
      transform: 'rc-c-pilot-geometry-v1',
      toleranceVersions: { geometry: 'rc-c-pilot-geometry-v1' },
      envelopeResult: { accepted: true },
      itemLedger,
      topology,
      sourceDomain: { state: 'accounted' },
    });
    return { normalizedObservation, itemLedger, topology, effectiveInputFingerprint };
  };

  const baseline = run(perimeterOrders[0]);
  assert.deepStrictEqual(clone(baseline.normalizedObservation.candidateBands[0].promptPolygon), canonicalPrompt);
  assert.deepStrictEqual(clone(baseline.normalizedObservation.candidateBands[0].answerPolygon), canonicalAnswer);
  const baselineBytes = service.rccCanonicalSerialize(baseline);
  for (const indices of [...perimeterOrders, ...crossingOrders]) {
    const first = run(indices);
    const second = run(indices);
    assert.deepStrictEqual(clone(first.normalizedObservation.candidateBands[0].promptPolygon), canonicalPrompt);
    assert.deepStrictEqual(clone(first.normalizedObservation.candidateBands[0].answerPolygon), canonicalAnswer);
    assert.strictEqual(first.itemLedger[0].itemId, baseline.itemLedger[0].itemId);
    assert.strictEqual(first.itemLedger[0].promptRegionId, baseline.itemLedger[0].promptRegionId);
    assert.strictEqual(first.itemLedger[0].answerRegionId, baseline.itemLedger[0].answerRegionId);
    assert.deepStrictEqual(first.topology, baseline.topology);
    assert.strictEqual(first.effectiveInputFingerprint, baseline.effectiveInputFingerprint);
    assert.strictEqual(service.rccCanonicalSerialize(first), baselineBytes);
    assert.strictEqual(service.rccCanonicalSerialize(second), baselineBytes);
  }
});

test('rectangle canonicalization rejects malformed and incomplete corner sets', () => {
  const cases = [
    [{ x: 0.1, y: 0.08 }, { x: 0.5, y: 0.08 }, { x: 0.5, y: 0.105 }, { x: 0.5, y: 0.105 }],
    [{ x: 0.1, y: 0.08 }, { x: 0.5, y: 0.08 }, { x: 0.5, y: 0.105 }],
    [{ x: 0.1, y: 0.08 }, { x: 0.5, y: 0.08 }, { x: 0.5, y: 0.105 }, { x: 0.3, y: 0.105 }, { x: 0.1, y: 0.105 }],
    [{ x: 0.1, y: 0.08 }, { x: 0.5, y: 0.08 }, { x: 0.45, y: 0.105 }, { x: 0.1, y: 0.105 }],
    [{ x: 0.1, y: 0.08 }, { x: 0.1, y: 0.08 }, { x: 0.1, y: 0.105 }, { x: 0.1, y: 0.105 }],
    [{ x: 0.1, y: 0.08 }, { x: 0.5, y: 0.08 }, { x: 0.5, y: 0.08 }, { x: 0.1, y: 0.08 }],
    [{ x: 0.1, y: 0.08 }, { x: 1.01, y: 0.08 }, { x: 1.01, y: 0.105 }, { x: 0.1, y: 0.105 }],
    [{ x: 0.1, y: 0.08 }, { x: NaN, y: 0.08 }, { x: 0.5, y: 0.105 }, { x: 0.1, y: 0.105 }],
    [{ x: 0.1, y: 0.08 }, { x: Infinity, y: 0.08 }, { x: 0.5, y: 0.105 }, { x: 0.1, y: 0.105 }],
    [{ x: 0.1, y: 0.08 }, { x: '0.5', y: 0.08 }, { x: 0.5, y: 0.105 }, { x: 0.1, y: 0.105 }],
    [{ x: 0.1, y: 0.08 }, [0.5, 0.08], { x: 0.5, y: 0.105 }, { x: 0.1, y: 0.105 }],
  ];
  for (const polygon of cases) {
    const input = observation();
    input.candidateBands[0].promptPolygon = polygon;
    expectRepeatedRejection(() => service.normalizePilotObservationV1(input), 'OBSERVATION_PROMPT_REGION_INVALID');
  }
});

test('duplicate JSON keys fail closed at top-level and every nested observation object', () => {
  const validJson = JSON.stringify(observation());
  const wrap = (json) => `RCC_PILOT_OBSERVATION_V1_BEGIN\n${json}\nRCC_PILOT_OBSERVATION_V1_END`;
  assert.strictEqual(analyzeTest.extractRCCPilotObservationV1(wrap(validJson)).ok, true);
  for (const duplicateJson of [
    validJson.replace('"schemaVersion":1', '"schemaVersion":1,"schemaVersion":1'),
    validJson.replace('"schemaVersion":1', '"schemaVersion":1,"schemaVersion":2'),
    validJson.replace('"sharpnessPass":true', '"sharpnessPass":true,"sharpnessPass":true'),
    validJson.replace('"candidateId":"candidate-1"', '"candidateId":"candidate-1","candidateId":"candidate-1"'),
    validJson.replace('"leafId":"page-domain"', '"leafId":"page-domain","leafId":"other"'),
    validJson.replace('"x":0.05', '"x":0.05,"x":0.05')
  ]) expectRepeatedRejection(() => analyzeTest.extractRCCPilotObservationV1(wrap(duplicateJson)), 'OBSERVATION_DUPLICATE_KEY');
  expectRepeatedRejection(() => analyzeTest.extractRCCPilotObservationV1(wrap('{bad json')), 'OBSERVATION_BLOCK_JSON_INVALID');
  expectRepeatedRejection(() => analyzeTest.extractRCCPilotObservationV1(`${wrap(validJson)}\n${wrap(validJson)}`), 'OBSERVATION_BLOCK_MISSING');
});

test('production enumeration rejects 13 through 16 and Q16 allowance exists only under test exports', () => {
  assert.strictEqual(service.enumerateNumberedBandsForQ16FixtureV1, undefined);
  assert.strictEqual(typeof rccTestService.enumerateNumberedBandsForQ16FixtureV1, 'function');
  assert.strictEqual(analyzeTest.enumerateNumberedBandsForQ16FixtureV1, undefined);
  for (let count = 13; count <= 16; count += 1) {
    const current = observation(); current.candidateBands = candidates(count);
    const value = normalized(current);
    expectRepeatedRejection(() => service.enumerateNumberedBandsV1(value, identityContext()), 'ASSESSABLE_ITEM_COUNT_UNSUPPORTED');
  }
  const q16 = observation(); q16.candidateBands = candidates(16, q16Gold.independentlyMarkedQ16SourceRegion);
  const ledger = rccTestService.enumerateNumberedBandsForQ16FixtureV1(normalized(q16), identityContext());
  assert.strictEqual(ledger.ok, true);
  assert.strictEqual(ledger.itemLedger.length, 16);
});

(async () => {
  for (const { name, fn } of tests) {
    try {
      await fn();
      passed += 1;
      console.log(`PASS ${passed} - ${name}`);
    } catch (error) {
      console.error(`FAIL - ${name}`);
      throw error;
    }
  }
  console.log(`PASS rc-c-pilot-enumeration: ${passed}/${tests.length} deterministic assertions`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
