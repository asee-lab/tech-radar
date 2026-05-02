const QueryParams = require('../util/queryParamProcessor')

function constructSheetUrl(sheetName) {
  const noParamsUrl = window.location.href.substring(0, window.location.href.indexOf(window.location.search))
  const queryParams = QueryParams(window.location.search.substring(1))
  const sheetUrl =
    noParamsUrl +
    '?' +
    ((queryParams.documentId && `documentId=${encodeURIComponent(queryParams.documentId)}`) ||
      (queryParams.sheetId && `sheetId=${encodeURIComponent(queryParams.sheetId)}`) ||
      '') +
    '&sheetName=' +
    encodeURIComponent(sheetName)
  return sheetUrl
}

function getDocumentOrSheetId() {
  const queryParams = QueryParams(window.location.search.substring(1))
  return queryParams.documentId ?? queryParams.sheetId
}

function getSheetName() {
  const queryParams = QueryParams(window.location.search.substring(1))
  return queryParams.sheetName
}

function getVersion() {
  const queryParams = QueryParams(window.location.search.substring(1))
  return queryParams.version
}

function getBlipParam() {
  const queryParams = QueryParams(window.location.search.substring(1))
  return queryParams.blip
}

function isSearchView() {
  const queryParams = QueryParams(window.location.search.substring(1))
  return queryParams.view === 'search'
}

function constructSearchUrl(versionId) {
  const base = window.location.pathname
  const version = versionId ? `&version=${encodeURIComponent(versionId)}` : ''
  return `${base}?view=search${version}`
}

function constructVersionUrl(versionId) {
  const base = window.location.pathname
  return `${base}?version=${encodeURIComponent(versionId)}`
}

function constructBlipDetailUrl(blipIdentifier) {
  const base = window.location.pathname
  return `${base}?blip=${encodeURIComponent(blipIdentifier)}`
}

module.exports = {
  constructSheetUrl,
  getDocumentOrSheetId,
  getSheetName,
  getVersion,
  getBlipParam,
  isSearchView,
  constructSearchUrl,
  constructVersionUrl,
  constructBlipDetailUrl,
}
