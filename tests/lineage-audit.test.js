import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { auditLineageClaim } from '../packages/lineage-audit/index.js';

const SUBJECT='11111111-1111-4111-8111-111111111111';
const PARENT='22222222-2222-4222-8222-222222222222';
const url=id=>'https://suno.com/song/'+id;
const fixture=()=>({
  claim:{subjectId:SUBJECT,parentId:PARENT,kind:'cover_of'},
  subject:{pageUrl:url(SUBJECT),selectedTrackId:SUBJECT,scope:'selected-track-detail',
    relationLabel:'Cover of',relationHref:url(PARENT),
    createdAt:'2026-10-09T21:46:00Z'},
  parent:{pageUrl:url(PARENT),selectedTrackId:PARENT,scope:'selected-track-detail',
    createdAt:'2026-06-04T19:20:00Z'},
});

test('chronology inversion quarantines false provider ancestry',()=>{
  const f=fixture();
  f.subject.createdAt='2026-06-04T19:20:00Z';
  f.parent.createdAt='2026-10-09T21:46:00Z';
  const audit=auditLineageClaim(f);
  assert.equal(audit.status,'contradicted');
  assert.equal(audit.reasonCode,'parent_newer_than_child');
  assert.equal(audit.promoteToConfirmedEdge,false);
});
test('missing direct Cover of label cannot become genealogy',()=>{
  const f=fixture();
  f.subject.relationLabel=null;
  f.subject.relationHref=null;
  assert.equal(auditLineageClaim(f).reasonCode,'no_matching_relation_in_selected_detail');
});
test('sidebar context cannot be attributed to selected song',()=>{
  const f=fixture();
  f.subject.scope='sidebar';
  assert.equal(auditLineageClaim(f).reasonCode,'non_selected_detail_surface');
});
test('stale or neighboring panel identity is rejected',()=>{
  const f=fixture();
  f.subject.selectedTrackId=PARENT;
  assert.equal(auditLineageClaim(f).reasonCode,'subject_detail_identity_mismatch');
});
test('a link to a different provider ID cannot count as a parent',()=>{
  const f=fixture();
  f.subject.relationHref=url(SUBJECT);
  assert.equal(auditLineageClaim(f).reasonCode,'no_matching_relation_in_selected_detail');
});
test('source with no verified parent page is not corroborated',()=>{
  const f=fixture();
  f.parent.pageUrl=url(SUBJECT);
  assert.equal(auditLineageClaim(f).reasonCode,'parent_detail_identity_mismatch');
});
test('relative time cannot establish chronology',()=>{
  const f=fixture();
  f.subject.createdAt='4mo ago';
  assert.equal(auditLineageClaim(f).reasonCode,'exact_chronology_unavailable');
});
test('same title never contributes lineage evidence',()=>{
  const f=fixture();
  f.subject.title='matching title';
  f.parent.title='matching title';
  f.subject.relationHref=null;
  assert.equal(auditLineageClaim(f).status,'unverified');
});
test('two matching page observations support a provider claim, not a proven edge',()=>{
  const audit=auditLineageClaim(fixture());
  assert.equal(audit.status,'supported_provider_claim');
  assert.equal(audit.promoteToConfirmedEdge,false);
});
test('self-ancestry is contradicted',()=>{
  const f=fixture();
  f.claim.parentId=SUBJECT;
  assert.equal(auditLineageClaim(f).reasonCode,'self_parent');
});
test('no pages supplied: no evidence',()=>{
  const f=fixture();
  delete f.subject;
  assert.equal(auditLineageClaim(f).status,'unverified');
});
