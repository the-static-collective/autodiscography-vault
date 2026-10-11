/**
 * Fail-closed, source-bound provider-lineage claim auditor.
 *
 * This tests structured UI observations supplied by a collector; it cannot
 * prove the collector actually saw the page. A "supported" result means only
 * that independently identified UI observations are internally consistent.
 * Never infer musical ancestry from titles, neighboring cards, style, or sound.
 */
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const TYPES = Object.freeze({
  cover_of: 'Cover of',
  extend_of: 'Extend of',
  remix_of: 'Remix of',
});
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
function canonical(id) { return 'https://suno.com/song/' + id; }
function exactTime(value) {
  return typeof value === 'string' && ISO.test(value) &&
    !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().startsWith(value.slice(0,19))
    ? Date.parse(value) : null;
}
function result(status, reasonCode) {
  return Object.freeze({status, reasonCode, promoteToConfirmedEdge: false});
}

/**
 * Input:
 * claim: {subjectId, parentId, kind};
 * subject: {pageUrl, selectedTrackId, scope, relationLabel, relationHref, createdAt};
 * parent: {pageUrl, selectedTrackId, scope, createdAt};
 *
 * Every datum is an observation, not a free-form AI conclusion.
 * createdAt is exact ISO UTC if available; null means unknown, never "4mo ago".
 */
export function auditLineageClaim({claim, subject, parent} = {}) {
  if (!claim || typeof claim !== 'object' ||
      !UUID.test(claim.subjectId ?? '') || !UUID.test(claim.parentId ?? '') ||
      !Object.hasOwn(TYPES,claim.kind)) {
    return result('invalid', 'invalid_claim');
  }
  if (claim.subjectId === claim.parentId) return result('contradicted','self_parent');
  if (!subject || !parent) return result('unverified', 'missing_direct_page');
  if (subject.scope !== 'selected-track-detail' ||
      parent.scope !== 'selected-track-detail') {
    return result('misattributed','non_selected_detail_surface');
  }
  if (subject.selectedTrackId !== claim.subjectId ||
      subject.pageUrl !== canonical(claim.subjectId)) {
    return result('misattributed','subject_detail_identity_mismatch');
  }
  if (parent.selectedTrackId !== claim.parentId ||
      parent.pageUrl !== canonical(claim.parentId)) {
    return result('misattributed','parent_detail_identity_mismatch');
  }
  const childTime=exactTime(subject.createdAt);
  const parentTime=exactTime(parent.createdAt);
  // A future-created Suno generation cannot be the direct parent generation.
  // Preserve the UI report, but never promote the chronological contradiction.
  if (childTime !== null && parentTime !== null && parentTime > childTime) {
    return result('contradicted', 'parent_newer_than_child');
  }
  if (subject.relationLabel !== TYPES[claim.kind] ||
      subject.relationHref !== canonical(claim.parentId)) {
    return result('unverified', 'no_matching_relation_in_selected_detail');
  }
  if (childTime === null || parentTime === null) {
    return result('unverified', 'exact_chronology_unavailable');
  }
  // Even with two internally consistent source-identified observations, we
  // have not independently authenticated the browser agent's interpretation.
  return Object.freeze({
    status: 'supported_provider_claim',
    reasonCode: 'direct_ui_link_and_chronology_agree',
    promoteToConfirmedEdge: false,
  });
}
