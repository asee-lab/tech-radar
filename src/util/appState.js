let manifest = null
let versions = null
let blipHistory = null
let currentVersionId = null

function setManifestData({ manifest: m, versions: v, blipHistory: h, currentVersionId: c }) {
  manifest = m
  versions = v
  blipHistory = h
  currentVersionId = c
}

function setCurrentVersionId(id) {
  currentVersionId = id
}

function getManifest() {
  return manifest
}

function getVersions() {
  return versions
}

function getBlipHistory() {
  return blipHistory
}

function getCurrentVersionId() {
  return currentVersionId
}

function isManifestMode() {
  return manifest !== null
}

function findBlipAcrossVersions(blipNameLower) {
  if (!blipHistory) return null
  return blipHistory.get(blipNameLower) || null
}

module.exports = {
  setManifestData,
  setCurrentVersionId,
  getManifest,
  getVersions,
  getBlipHistory,
  getCurrentVersionId,
  isManifestMode,
  findBlipAcrossVersions,
}
